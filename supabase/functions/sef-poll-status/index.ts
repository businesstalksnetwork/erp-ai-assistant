import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { tenant_id, invoice_id } = await req.json();
    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Get SEF connection
    const { data: connection } = await supabase
      .from("sef_connections")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("is_active", true)
      .maybeSingle();

    if (!connection) {
      return new Response(JSON.stringify({ error: "SEF connection not configured" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get pending submissions
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
      return new Response(JSON.stringify({ success: true, polled: 0, message: "No pending submissions" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const results: any[] = [];

    for (const sub of submissions) {
      const requestId = (sub.request_payload as any)?.requestId;
      if (!requestId) continue;

      if (connection.environment === "sandbox") {
        // Sandbox: simulate acceptance
        const fakeSefId = `SEF-${Date.now()}`;
        await supabase.from("sef_submissions").update({
          status: "accepted", sef_invoice_id: fakeSefId,
          response_payload: { simulated: true, polled: true },
          resolved_at: new Date().toISOString(),
        }).eq("id", sub.id);

        await supabase.from("invoices").update({ sef_status: "accepted" }).eq("id", sub.invoice_id);
        results.push({ invoice_id: sub.invoice_id, status: "accepted", simulated: true });
      } else {
        // Production: real API call
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
          results.push({ invoice_id: sub.invoice_id, status: "error", error: err.message });
        }
      }

      // Rate limiter: max 3 calls/sec
      await sleep(334);
    }

    await supabase.from("sef_connections").update({ last_sync_at: new Date().toISOString() }).eq("id", connection.id);

    return new Response(JSON.stringify({ success: true, polled: results.length, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
