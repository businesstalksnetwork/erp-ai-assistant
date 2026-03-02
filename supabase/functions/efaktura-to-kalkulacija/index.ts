import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/error-handler.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });

    const { supplier_invoice_id, tenant_id, warehouse_id, default_markup } = await req.json();
    if (!supplier_invoice_id || !tenant_id) return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: membership } = await supabase.from("tenant_members").select("id").eq("user_id", user.id).eq("tenant_id", tenant_id).eq("status", "active").maybeSingle();
    if (!membership) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });

    const { data: invoice } = await supabase.from("supplier_invoices").select("*, supplier_invoice_lines(*)").eq("id", supplier_invoice_id).single();
    if (!invoice) return new Response(JSON.stringify({ error: "Invoice not found" }), { status: 404, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });

    // Create kalkulacija logic
    const kalkulacijaData = {
      tenant_id: tenant_id,
      supplier_id: invoice.supplier_id,
      supplier_invoice_id: invoice.id,
      warehouse_id: warehouse_id || null,
      invoice_number: invoice.invoice_number,
      invoice_date: invoice.invoice_date,
      due_date: invoice.due_date,
      total_amount: invoice.total_amount,
      total_tax: invoice.total_tax,
      total_discount: invoice.total_discount,
      currency: invoice.currency,
      payment_terms: invoice.payment_terms,
      notes: invoice.notes,
    };

    const { data: kalkulacija, error: kalkulacijaError } = await supabase.from("kalkulacije").insert(kalkulacijaData).select("*").single();
    if (kalkulacijaError) throw kalkulacijaError;

    if (invoice.supplier_invoice_lines && invoice.supplier_invoice_lines.length > 0) {
      const kalkulacijaLines = invoice.supplier_invoice_lines.map((line) => ({
        kalkulacija_id: kalkulacija.id,
        product_id: line.product_id,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unit_price,
        tax_rate: line.tax_rate,
        discount_rate: line.discount_rate,
        amount: line.amount,
        purchase_price: line.unit_price, // Set purchase_price from unit_price
        sale_price: line.unit_price * (1 + (default_markup || 0.2)), // Apply default markup
      }));

      const { error: kalkulacijaLinesError } = await supabase.from("kalkulacija_lines").insert(kalkulacijaLines);
      if (kalkulacijaLinesError) throw kalkulacijaLinesError;
    }

    return new Response(JSON.stringify({ success: true }), { headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });
  } catch (err) {
    return createErrorResponse(err, req, { logPrefix: "efaktura-to-kalkulacija" });
  }
});
