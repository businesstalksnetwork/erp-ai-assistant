import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await anonClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { tenant_id, connection_id, sync_type = "full" } = await req.json();

    if (!tenant_id || !connection_id) {
      return new Response(JSON.stringify({ error: "tenant_id and connection_id required" }), { status: 400, headers: corsHeaders });
    }

    // Create sync log
    const { data: logEntry, error: logErr } = await supabase
      .from("web_sync_logs")
      .insert({ tenant_id, web_connection_id: connection_id, sync_type, status: "in_progress" })
      .select()
      .single();
    if (logErr) throw logErr;

    // Fetch connection
    const { data: conn } = await supabase
      .from("web_connections")
      .select("*")
      .eq("id", connection_id)
      .single();
    if (!conn) throw new Error("Connection not found");

    // Fetch products with web prices
    const { data: webPrices } = await supabase
      .from("web_prices")
      .select("*, products(id, name, name_sr, sku, barcode, description, unit_of_measure, default_sale_price)")
      .eq("tenant_id", tenant_id);

    // Fetch inventory totals
    const { data: stockRows } = await supabase
      .from("inventory_stock")
      .select("product_id, quantity_on_hand")
      .eq("tenant_id", tenant_id);

    const stockMap: Record<string, number> = {};
    (stockRows || []).forEach((r: any) => {
      stockMap[r.product_id] = (stockMap[r.product_id] || 0) + Number(r.quantity_on_hand);
    });

    // Build payload
    const products = (webPrices || []).map((wp: any) => ({
      sku: wp.products?.sku,
      barcode: wp.products?.barcode,
      name: wp.products?.name,
      description: wp.products?.description,
      price: Number(wp.price),
      compare_at_price: wp.compare_at_price ? Number(wp.compare_at_price) : null,
      inventory_quantity: stockMap[wp.product_id] || 0,
    }));

    let syncErrors: any[] = [];
    let productsSynced = 0;

    const platform = conn.platform;

    if (platform === "shopify") {
      // Shopify Admin REST API
      const storeUrl = conn.store_url.replace(/\/$/, "");
      const accessToken = conn.api_key; // Shopify uses access token

      for (const p of products) {
        try {
          // Search for existing product by SKU
          const searchRes = await fetch(
            `https://${storeUrl}/admin/api/2024-01/products.json?fields=id,variants&limit=1`,
            { headers: { "X-Shopify-Access-Token": accessToken, "Content-Type": "application/json" } }
          );

          // Create/update product
          const productPayload = {
            product: {
              title: p.name,
              body_html: p.description || "",
              variants: [{
                sku: p.sku || "",
                price: p.price.toFixed(2),
                compare_at_price: p.compare_at_price?.toFixed(2) || null,
                inventory_quantity: p.inventory_quantity,
                barcode: p.barcode || "",
              }],
            },
          };

          const createRes = await fetch(
            `https://${storeUrl}/admin/api/2024-01/products.json`,
            {
              method: "POST",
              headers: { "X-Shopify-Access-Token": accessToken, "Content-Type": "application/json" },
              body: JSON.stringify(productPayload),
            }
          );

          if (createRes.ok) {
            productsSynced++;
          } else {
            const errBody = await createRes.text();
            syncErrors.push({ sku: p.sku, error: errBody });
          }
        } catch (err) {
          syncErrors.push({ sku: p.sku, error: String(err) });
        }
      }
    } else if (platform === "woocommerce") {
      // WooCommerce REST API
      const storeUrl = conn.store_url.replace(/\/$/, "");
      const credentials = btoa(`${conn.api_key}:${conn.api_secret}`);

      for (const p of products) {
        try {
          const productPayload = {
            name: p.name,
            sku: p.sku || "",
            regular_price: p.price.toFixed(2),
            sale_price: p.compare_at_price ? p.price.toFixed(2) : "",
            description: p.description || "",
            stock_quantity: p.inventory_quantity,
            manage_stock: true,
          };

          const res = await fetch(
            `${storeUrl}/wp-json/wc/v3/products`,
            {
              method: "POST",
              headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/json" },
              body: JSON.stringify(productPayload),
            }
          );

          if (res.ok) {
            productsSynced++;
          } else {
            const errBody = await res.text();
            syncErrors.push({ sku: p.sku, error: errBody });
          }
        } catch (err) {
          syncErrors.push({ sku: p.sku, error: String(err) });
        }
      }
    } else if (platform === "custom") {
      // Custom API -- POST full payload
      try {
        const res = await fetch(conn.store_url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(conn.api_key ? { "X-API-Key": conn.api_key } : {}),
          },
          body: JSON.stringify({ sync_type, products }),
        });

        if (res.ok) {
          productsSynced = products.length;
        } else {
          const errBody = await res.text();
          syncErrors.push({ error: errBody });
        }
      } catch (err) {
        syncErrors.push({ error: String(err) });
      }
    }

    const finalStatus = syncErrors.length === 0 ? "success" : productsSynced > 0 ? "partial" : "failed";

    // Update sync log
    await supabase
      .from("web_sync_logs")
      .update({
        status: finalStatus,
        products_synced: productsSynced,
        errors: syncErrors,
        completed_at: new Date().toISOString(),
      })
      .eq("id", logEntry.id);

    // Update connection last_sync
    await supabase
      .from("web_connections")
      .update({
        last_sync_at: new Date().toISOString(),
        last_error: syncErrors.length > 0 ? JSON.stringify(syncErrors[0]) : null,
      })
      .eq("id", connection_id);

    return new Response(JSON.stringify({
      status: finalStatus,
      products_synced: productsSynced,
      errors: syncErrors,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("web-sync error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
