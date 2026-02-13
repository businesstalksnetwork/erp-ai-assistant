import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // JWT validation
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: caller }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { invoice_id, tenant_id, test, request_id } = await req.json();

    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify tenant membership
    const { data: membership } = await supabase
      .from("tenant_members").select("id")
      .eq("user_id", caller.id).eq("tenant_id", tenant_id).eq("status", "active").maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: "Forbidden: not a member of this tenant" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Look up SEF connection
    const { data: connection, error: connErr } = await supabase
      .from("sef_connections")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("is_active", true)
      .maybeSingle();

    if (connErr || !connection) {
      return new Response(
        JSON.stringify({ error: "SEF connection not configured or inactive" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Test mode: just verify connection is active
    if (test) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "SEF connection is active",
          environment: connection.environment,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!invoice_id) {
      return new Response(JSON.stringify({ error: "invoice_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Idempotency check ---
    const sefRequestId = request_id || crypto.randomUUID();

    const { data: existingSub } = await supabase
      .from("sef_submissions")
      .select("*")
      .eq("invoice_id", invoice_id)
      .eq("tenant_id", tenant_id)
      .in("status", ["pending", "submitted", "accepted"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingSub) {
      if (existingSub.status === "accepted") {
        return new Response(
          JSON.stringify({
            success: true, status: "accepted", sef_invoice_id: existingSub.sef_invoice_id,
            message: "Invoice already accepted by SEF", idempotent: true,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (existingSub.status === "pending" || existingSub.status === "submitted") {
        await supabase.from("sef_submissions").update({ status: "submitted" }).eq("id", existingSub.id);
        return new Response(
          JSON.stringify({
            success: true, status: existingSub.status,
            message: "Submission already in progress. Poll status to confirm.",
            submission_id: existingSub.id, idempotent: true,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Fetch invoice with lines
    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .select("*, invoice_lines(*)")
      .eq("id", invoice_id)
      .single();

    if (invErr || !invoice) {
      return new Response(
        JSON.stringify({ error: "Invoice not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build SEF payload
    const sefPayload = {
      invoiceNumber: invoice.invoice_number,
      invoiceDate: invoice.invoice_date,
      dueDate: invoice.due_date,
      partnerName: invoice.partner_name,
      partnerPib: invoice.partner_pib,
      currency: invoice.currency,
      subtotal: invoice.subtotal,
      taxAmount: invoice.tax_amount,
      total: invoice.total,
      lines: (invoice.invoice_lines || []).map((line: any) => ({
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unit_price,
        taxRate: line.tax_rate,
        total: line.total,
      })),
    };

    // Create submission record
    const { data: submission, error: subErr } = await supabase
      .from("sef_submissions")
      .insert({
        tenant_id,
        invoice_id,
        sef_connection_id: connection.id,
        status: "pending",
        request_payload: { ...sefPayload, requestId: sefRequestId },
      })
      .select()
      .single();

    if (subErr) {
      return new Response(JSON.stringify({ error: subErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sandbox mode: simulate acceptance
    if (connection.environment === "sandbox") {
      const fakeSefId = `SEF-${Date.now()}`;

      await supabase.from("sef_submissions").update({
        status: "accepted", sef_invoice_id: fakeSefId,
        response_payload: { simulated: true, sef_id: fakeSefId },
        resolved_at: new Date().toISOString(),
      }).eq("id", submission.id);

      await supabase.from("invoices").update({ sef_status: "accepted" }).eq("id", invoice_id);
      await supabase.from("sef_connections").update({ last_sync_at: new Date().toISOString(), last_error: null }).eq("id", connection.id);

      return new Response(
        JSON.stringify({ success: true, status: "accepted", sef_invoice_id: fakeSefId, simulated: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Production mode: real API call
    try {
      const uploadUrl = `${connection.api_url}/publicApi/sales-invoice/ubl/upload/${sefRequestId}`;
      const apiRes = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "ApiKey": connection.api_key_encrypted,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(sefPayload),
      });

      if (apiRes.status === 429) {
        await supabase.from("sef_submissions").update({
          status: "rate_limited",
          response_payload: { status: 429, message: "Rate limited" },
        }).eq("id", submission.id);

        await supabase.from("invoices").update({ sef_status: "submitted" }).eq("id", invoice_id);

        return new Response(JSON.stringify({
          success: false, status: "rate_limited",
          message: "SEF rate limit exceeded (3 req/sec). Retry after delay.",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const resBody = await apiRes.json().catch(() => ({ raw: await apiRes.text() }));

      if (apiRes.ok) {
        await supabase.from("sef_submissions").update({
          status: "submitted",
          response_payload: resBody,
        }).eq("id", submission.id);

        await supabase.from("invoices").update({ sef_status: "submitted" }).eq("id", invoice_id);
        await supabase.from("sef_connections").update({ last_sync_at: new Date().toISOString(), last_error: null }).eq("id", connection.id);

        return new Response(JSON.stringify({
          success: true, status: "submitted",
          message: "Upload success. Poll status endpoint to confirm acceptance.",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } else {
        await supabase.from("sef_submissions").update({
          status: "error",
          response_payload: resBody,
        }).eq("id", submission.id);

        await supabase.from("sef_connections").update({ last_error: JSON.stringify(resBody) }).eq("id", connection.id);

        return new Response(JSON.stringify({
          success: false, status: "error",
          message: `SEF API returned ${apiRes.status}`,
          details: resBody,
        }), { status: apiRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } catch (fetchErr) {
      await supabase.from("sef_submissions").update({
        status: "error",
        response_payload: { error: fetchErr.message },
      }).eq("id", submission.id);

      await supabase.from("sef_connections").update({ last_error: fetchErr.message }).eq("id", connection.id);

      return new Response(JSON.stringify({
        success: false, status: "error", message: fetchErr.message,
      }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
