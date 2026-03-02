import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function pollSubmissionsForTenant(supabase: any, tenant_id: string, connection: any, invoice_id?: string) {
  let query = supabase
    .from("sef_submissions")
    .select("*")
    .eq("tenant_id", tenant_id)
    .in("status", ["submitted", "pending"])
    .order("created_at", { ascending: true });

  if (invoice_id) {
    query = query.eq("invoice_id", invoice_id);
  }

  const { data: submissions } = await query;
  if (!submissions || submissions.length === 0) {
    return { polled: 0, results: [] };
  }

  const results: any[] = [];

  for (const sub of submissions) {
    const requestId = (sub.request_payload as any)?.requestId;
    if (!requestId) continue;

    if (connection.environment === "sandbox") {
      const fakeSefId = `SEF-${Date.now()}`;
      await supabase.from("sef_submissions").update({
        status: "accepted", sef_invoice_id: fakeSefId,
        response_payload: { simulated: true, polled: true },
        resolved_at: new Date().toISOString(),
      }).eq("id", sub.id);

      await supabase.from("invoices").update({ sef_status: "accepted" }).eq("id", sub.invoice_id);
      results.push({ invoice_id: sub.invoice_id, status: "accepted", simulated: true });
    } else {
      try {
        const res = await fetch(`${connection.api_url}/publicApi/sales-invoice/status/${requestId}`, {
          headers: { "ApiKey": connection.api_key_encrypted, "Accept": "application/json" },
        });

        if (res.status === 429) {
          results.push({ invoice_id: sub.invoice_id, status: "rate_limited" });
          await sleep(1000);
          continue;
        }

        const body = await res.json();
        const sefStatus = body?.Status || body?.status;
        let newStatus = "submitted";

        if (sefStatus === "Approved" || sefStatus === "Sent" || sefStatus === "Registered") {
          newStatus = "accepted";
        } else if (sefStatus === "Rejected" || sefStatus === "Cancelled") {
          newStatus = "rejected";
        }

        await supabase.from("sef_submissions").update({
          status: newStatus,
          sef_invoice_id: body?.InvoiceId || body?.SalesInvoiceId || null,
          response_payload: body,
          resolved_at: newStatus !== "submitted" ? new Date().toISOString() : null,
        }).eq("id", sub.id);

        if (newStatus !== "submitted") {
          await supabase.from("invoices").update({ sef_status: newStatus }).eq("id", sub.invoice_id);
        }

        results.push({ invoice_id: sub.invoice_id, status: newStatus });
      } catch (err) {
        results.push({ invoice_id: sub.invoice_id, status: "error", error: (err as Error).message });
      }
    }

    await sleep(334);
  }

  await supabase.from("sef_connections").update({ last_sync_at: new Date().toISOString() }).eq("id", connection.id);

  return { polled: results.length, results };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // empty body for cron calls
    }

    const { tenant_id, invoice_id } = body;

    // CRON MODE: no tenant_id — poll all tenants with active SEF connections
    if (!tenant_id) {
      const cronSecret = req.headers.get("x-cron-secret");
      if (cronSecret !== Deno.env.get("CRON_SECRET")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: connections } = await supabase
        .from("sef_connections")
        .select("*")
        .eq("is_active", true);

      if (!connections || connections.length === 0) {
        return new Response(JSON.stringify({ success: true, mode: "cron", message: "No active SEF connections" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const allResults: any[] = [];
      for (const conn of connections) {
        const { polled, results } = await pollSubmissionsForTenant(supabase, conn.tenant_id, conn);
        if (polled > 0) {
          allResults.push({ tenant_id: conn.tenant_id, polled, results });
        }
      }

      return new Response(JSON.stringify({ success: true, mode: "cron", tenants_polled: allResults.length, details: allResults }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // USER MODE: validate JWT and tenant membership
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: membership } = await supabase
      .from("tenant_members").select("id")
      .eq("user_id", user.id).eq("tenant_id", tenant_id).eq("status", "active").maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: "Forbidden: not a member of this tenant" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: connection } = await supabase
      .from("sef_connections")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("is_active", true)
      .maybeSingle();

    if (!connection) {
      return new Response(JSON.stringify({ error: "SEF connection not configured" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { polled, results } = await pollSubmissionsForTenant(supabase, tenant_id, connection, invoice_id);

    return new Response(JSON.stringify({ success: true, polled, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
