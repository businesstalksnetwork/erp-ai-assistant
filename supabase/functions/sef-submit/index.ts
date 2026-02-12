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
    const { invoice_id, tenant_id, test } = await req.json();

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
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
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
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!invoice_id) {
      return new Response(JSON.stringify({ error: "invoice_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Build SEF payload (scaffold)
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
        request_payload: sefPayload,
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

      await supabase
        .from("sef_submissions")
        .update({
          status: "accepted",
          sef_invoice_id: fakeSefId,
          response_payload: { simulated: true, sef_id: fakeSefId },
          resolved_at: new Date().toISOString(),
        })
        .eq("id", submission.id);

      await supabase
        .from("invoices")
        .update({ sef_status: "accepted" })
        .eq("id", invoice_id);

      // Update connection last_sync
      await supabase
        .from("sef_connections")
        .update({ last_sync_at: new Date().toISOString(), last_error: null })
        .eq("id", connection.id);

      return new Response(
        JSON.stringify({
          success: true,
          status: "accepted",
          sef_invoice_id: fakeSefId,
          simulated: true,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Production mode: placeholder for real API call
    // TODO: POST to connection.api_url with sefPayload
    await supabase
      .from("sef_submissions")
      .update({ status: "submitted" })
      .eq("id", submission.id);

    await supabase
      .from("invoices")
      .update({ sef_status: "submitted" })
      .eq("id", invoice_id);

    return new Response(
      JSON.stringify({
        success: true,
        status: "submitted",
        message: "Production SEF submission - awaiting real API integration",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
