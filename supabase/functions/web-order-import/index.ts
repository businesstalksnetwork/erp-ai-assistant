import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key, x-connection-id",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();

    // Identify the connection via API key header or connection_id in body
    const apiKey = req.headers.get("x-api-key");
    const connectionId = req.headers.get("x-connection-id") || body.connection_id;

    let conn: any = null;

    if (apiKey) {
      const { data } = await supabase
        .from("web_connections")
        .select("*")
        .eq("api_key", apiKey)
        .eq("is_active", true)
        .single();
      conn = data;
    } else if (connectionId) {
      const { data } = await supabase
        .from("web_connections")
        .select("*")
        .eq("id", connectionId)
        .eq("is_active", true)
        .single();
      conn = data;
    }

    if (!conn) {
      return new Response(JSON.stringify({ error: "Connection not found or inactive" }), {
        status: 401, headers: corsHeaders,
      });
    }

    const tenantId = conn.tenant_id;
    const platform = conn.platform;

    // Parse order based on platform
    let orderData: {
      external_id: string;
      customer_name: string;
      customer_email: string;
      items: Array<{ sku: string; barcode?: string; quantity: number; price: number; name: string }>;
      total: number;
      currency: string;
      notes?: string;
    };

    if (platform === "shopify") {
      // Shopify orders/create webhook payload
      const o = body;
      orderData = {
        external_id: String(o.id || o.order_number),
        customer_name: o.customer ? `${o.customer.first_name || ""} ${o.customer.last_name || ""}`.trim() : "Web Customer",
        customer_email: o.customer?.email || o.email || "",
        items: (o.line_items || []).map((li: any) => ({
          sku: li.sku || "",
          barcode: li.barcode || "",
          quantity: li.quantity,
          price: Number(li.price),
          name: li.title || li.name,
        })),
        total: Number(o.total_price || 0),
        currency: o.currency || "RSD",
        notes: o.note || "",
      };
    } else if (platform === "woocommerce") {
      // WooCommerce order webhook payload
      const o = body;
      orderData = {
        external_id: String(o.id || o.number),
        customer_name: o.billing ? `${o.billing.first_name || ""} ${o.billing.last_name || ""}`.trim() : "Web Customer",
        customer_email: o.billing?.email || "",
        items: (o.line_items || []).map((li: any) => ({
          sku: li.sku || "",
          quantity: li.quantity,
          price: Number(li.price),
          name: li.name,
        })),
        total: Number(o.total || 0),
        currency: o.currency || "RSD",
        notes: o.customer_note || "",
      };
    } else {
      // Custom: expect standardized format
      orderData = {
        external_id: body.external_id || body.order_id || "",
        customer_name: body.customer_name || "Web Customer",
        customer_email: body.customer_email || "",
        items: body.items || [],
        total: Number(body.total || 0),
        currency: body.currency || "RSD",
        notes: body.notes || "",
      };
    }

    // Look up or create partner
    let partnerId: string | null = null;
    if (orderData.customer_email) {
      const { data: existing } = await supabase
        .from("partners")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("email", orderData.customer_email)
        .limit(1)
        .single();

      if (existing) {
        partnerId = existing.id;
      } else {
        const { data: newPartner } = await supabase
          .from("partners")
          .insert({
            tenant_id: tenantId,
            name: orderData.customer_name,
            email: orderData.customer_email,
            type: "customer",
          })
          .select("id")
          .single();
        partnerId = newPartner?.id || null;
      }
    }

    // Map items to products by SKU or barcode
    const orderLines: any[] = [];
    for (const item of orderData.items) {
      let productId: string | null = null;

      if (item.sku) {
        const { data } = await supabase
          .from("products")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("sku", item.sku)
          .limit(1)
          .single();
        productId = data?.id || null;
      }

      if (!productId && item.barcode) {
        const { data } = await supabase
          .from("products")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("barcode", item.barcode)
          .limit(1)
          .single();
        productId = data?.id || null;
      }

      orderLines.push({
        product_id: productId,
        product_name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        total: item.quantity * item.price,
      });
    }

    // Generate order number
    const { count } = await supabase
      .from("sales_orders")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId);
    const orderNumber = `WEB-${String((count || 0) + 1).padStart(5, "0")}`;

    // Create sales order
    const { data: salesOrder, error: soErr } = await supabase
      .from("sales_orders")
      .insert({
        tenant_id: tenantId,
        order_number: orderNumber,
        partner_id: partnerId,
        partner_name: orderData.customer_name,
        status: "confirmed",
        subtotal: orderData.total,
        tax_amount: 0,
        total: orderData.total,
        currency: orderData.currency,
        notes: orderData.notes,
        source: "web",
        web_connection_id: conn.id,
        external_order_id: orderData.external_id,
      })
      .select("id")
      .single();

    if (soErr) throw soErr;

    // Create order lines
    if (salesOrder && orderLines.length > 0) {
      const lines = orderLines.map((l, i) => ({
        sales_order_id: salesOrder.id,
        tenant_id: tenantId,
        product_id: l.product_id,
        product_name: l.product_name,
        quantity: l.quantity,
        unit_price: l.unit_price,
        total: l.total,
        sort_order: i + 1,
      }));

      await supabase.from("sales_order_lines").insert(lines);
    }

    // Create notification
    try {
      await supabase.from("notifications").insert({
        tenant_id: tenantId,
        title: `New web order: ${orderNumber}`,
        message: `Order from ${orderData.customer_name} (${platform}) - ${orderData.currency} ${orderData.total.toFixed(2)}`,
        type: "info",
      });
    } catch (_) {
      // Non-critical
    }

    return new Response(JSON.stringify({
      success: true,
      order_id: salesOrder?.id,
      order_number: orderNumber,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("web-order-import error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
