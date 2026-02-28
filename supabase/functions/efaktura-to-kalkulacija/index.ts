import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: authErr } = await userClient.auth.getClaims(token);
    if (authErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const user = { id: claimsData.claims.sub as string };

    const { supplier_invoice_id, tenant_id, warehouse_id, default_markup } = await req.json();
    if (!supplier_invoice_id || !tenant_id) {
      return new Response(JSON.stringify({ error: "supplier_invoice_id and tenant_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Verify membership
    const { data: membership } = await supabase
      .from("tenant_members").select("id")
      .eq("user_id", user.id).eq("tenant_id", tenant_id).eq("status", "active").maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get supplier invoice with lines
    const { data: invoice, error: invErr } = await supabase
      .from("supplier_invoices")
      .select("*, supplier_invoice_lines(*)")
      .eq("id", supplier_invoice_id)
      .eq("tenant_id", tenant_id)
      .single();

    if (invErr || !invoice) {
      return new Response(JSON.stringify({ error: "Supplier invoice not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const lines = (invoice as any).supplier_invoice_lines || [];
    if (lines.length === 0) {
      return new Response(JSON.stringify({ error: "No line items on supplier invoice" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Generate next kalkulacija number
    const { data: existing } = await supabase
      .from("kalkulacije")
      .select("kalkulacija_number")
      .eq("tenant_id", tenant_id)
      .order("created_at", { ascending: false })
      .limit(1);

    const lastNum = existing?.[0]?.kalkulacija_number?.replace(/\D/g, "") || "0";
    const nextNumber = `KLK-${String(parseInt(lastNum) + 1).padStart(4, "0")}`;

    // Create kalkulacija
    const markup = default_markup || 20;
    const { data: kalkulacija, error: klkErr } = await supabase
      .from("kalkulacije")
      .insert({
        tenant_id,
        kalkulacija_number: nextNumber,
        warehouse_id: warehouse_id || null,
        supplier_invoice_id: supplier_invoice_id,
        status: "draft",
        notes: `Auto-generated from eFaktura ${(invoice as any).invoice_number || supplier_invoice_id}`,
        created_by: user.id,
      })
      .select()
      .single();

    if (klkErr) throw klkErr;

    // Create kalkulacija items from supplier invoice lines
    const klkItems = lines
      .filter((l: any) => l.product_id)
      .map((l: any, idx: number) => {
        const purchasePrice = Number(l.unit_price) || 0;
        const pdvRate = Number(l.vat_rate) || 20;
        const retailPrice = Math.round(purchasePrice * (1 + markup / 100) * (1 + pdvRate / 100) * 100) / 100;
        return {
          kalkulacija_id: (kalkulacija as any).id,
          product_id: l.product_id,
          quantity: Number(l.quantity) || 1,
          purchase_price: purchasePrice,
          markup_percent: markup,
          pdv_rate: pdvRate,
          retail_price: retailPrice,
          sort_order: idx,
        };
      });

    if (klkItems.length > 0) {
      const { error: itemsErr } = await supabase.from("kalkulacija_items").insert(klkItems);
      if (itemsErr) throw itemsErr;
    }

    return new Response(JSON.stringify({
      success: true,
      kalkulacija_id: (kalkulacija as any).id,
      kalkulacija_number: nextNumber,
      items_created: klkItems.length,
      skipped_lines: lines.length - klkItems.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
