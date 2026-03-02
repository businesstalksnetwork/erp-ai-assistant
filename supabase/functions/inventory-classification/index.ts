import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { handleCorsPreflightRequest, getCorsHeaders } from "../_shared/cors.ts";
import { createErrorResponse, createJsonResponse } from "../_shared/error-handler.ts";
import { checkRateLimit } from "../_shared/rate-limiter.ts";

serve(async (req) => {
  const cors = handleCorsPreflightRequest(req);
  if (cors) return cors;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return createErrorResponse("Unauthorized", req, { status: 401 });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) return createErrorResponse("Unauthorized", req, { status: 401 });

    const { tenant_id } = await req.json();
    if (!tenant_id) return createErrorResponse("tenant_id required", req, { status: 400 });

    // CR10-05: Verify user belongs to requested tenant
    const { data: membership } = await supabase
      .from("tenant_members")
      .select("id")
      .eq("user_id", user.id)
      .eq("tenant_id", tenant_id)
      .eq("status", "active")
      .maybeSingle();
    if (!membership) return createErrorResponse("Forbidden", req, { status: 403 });

    const rl = await checkRateLimit(`classification-${tenant_id}`, "ai");
    if (!rl.allowed) return createErrorResponse("Rate limited", req, { status: 429 });

    // Fetch products
    const { data: products } = await supabase
      .from("products")
      .select("id, name, sku")
      .eq("tenant_id", tenant_id)
      .eq("is_active", true)
      .limit(500);

    if (!products || products.length === 0) {
      return createJsonResponse({ products: [], matrix: {} }, req);
    }

    const productIds = products.map(p => p.id);

    // Fetch 12 months of sales
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const cutoff = oneYearAgo.toISOString().split("T")[0];

    const { data: invoiceItems } = await supabase
      .from("invoice_items")
      .select("product_id, quantity, unit_price, invoice_id")
      .eq("tenant_id", tenant_id)
      .in("product_id", productIds.slice(0, 200))
      .limit(10000);

    const invoiceIds = [...new Set((invoiceItems || []).map((i: any) => i.invoice_id).filter(Boolean))];
    const { data: invoices } = await supabase
      .from("invoices")
      .select("id, invoice_date, status")
      .eq("tenant_id", tenant_id)
      .in("id", invoiceIds.slice(0, 500))
      .neq("status", "cancelled");

    const invoiceDateMap = new Map((invoices || []).map((inv: any) => [inv.id, inv.invoice_date]));

    // Calculate revenue per product + monthly breakdown for CV
    const productRevenue = new Map<string, number>();
    const productMonthlyQty = new Map<string, Map<string, number>>();

    for (const item of (invoiceItems || []) as any[]) {
      if (!item.product_id) continue;
      const date = invoiceDateMap.get(item.invoice_id) as string;
      if (!date || date < cutoff) continue;

      const revenue = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
      productRevenue.set(item.product_id, (productRevenue.get(item.product_id) || 0) + revenue);

      const monthKey = date.substring(0, 7);
      if (!productMonthlyQty.has(item.product_id)) productMonthlyQty.set(item.product_id, new Map());
      const pm = productMonthlyQty.get(item.product_id)!;
      pm.set(monthKey, (pm.get(monthKey) || 0) + Number(item.quantity || 0));
    }

    // ABC Classification
    const totalRevenue = Array.from(productRevenue.values()).reduce((a, b) => a + b, 0);
    const sorted = Array.from(productRevenue.entries()).sort((a, b) => b[1] - a[1]);

    let cumulative = 0;
    const abcMap = new Map<string, string>();
    for (const [pid, rev] of sorted) {
      cumulative += rev;
      const pct = totalRevenue > 0 ? cumulative / totalRevenue : 1;
      abcMap.set(pid, pct <= 0.8 ? "A" : pct <= 0.95 ? "B" : "C");
    }

    // XYZ Classification (coefficient of variation)
    const xyzMap = new Map<string, string>();
    for (const [pid, monthMap] of productMonthlyQty) {
      const values = Array.from(monthMap.values());
      if (values.length < 2) { xyzMap.set(pid, "Z"); continue; }
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      if (mean === 0) { xyzMap.set(pid, "Z"); continue; }
      const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
      const cv = Math.sqrt(variance) / mean;
      xyzMap.set(pid, cv < 0.5 ? "X" : cv <= 1.0 ? "Y" : "Z");
    }

    // Build result
    const productNameMap = new Map(products.map(p => [p.id, { name: p.name, sku: p.sku }]));
    const classified = Array.from(new Set([...abcMap.keys(), ...productIds])).map(pid => ({
      product_id: pid,
      name: productNameMap.get(pid)?.name || "Unknown",
      sku: productNameMap.get(pid)?.sku || "",
      abc: abcMap.get(pid) || "C",
      xyz: xyzMap.get(pid) || "Z",
      class: `${abcMap.get(pid) || "C"}${xyzMap.get(pid) || "Z"}`,
      annual_revenue: Math.round((productRevenue.get(pid) || 0) * 100) / 100,
    }));

    // 3x3 Matrix
    const matrix: Record<string, { count: number; revenue: number }> = {};
    for (const abc of ["A", "B", "C"]) {
      for (const xyz of ["X", "Y", "Z"]) {
        const key = `${abc}${xyz}`;
        const items = classified.filter(c => c.class === key);
        matrix[key] = {
          count: items.length,
          revenue: Math.round(items.reduce((a, c) => a + c.annual_revenue, 0) * 100) / 100,
        };
      }
    }

    // Strategy recommendations
    const strategies: Record<string, string> = {
      AX: "High value, stable demand. Automate replenishment with tight safety stock.",
      AY: "High value, variable demand. Maintain moderate safety stock, review frequently.",
      AZ: "High value, unpredictable. Made-to-order or strategic buffer stock.",
      BX: "Medium value, stable. Standard reorder with periodic review.",
      BY: "Medium value, variable. Flexible ordering with demand monitoring.",
      BZ: "Medium value, unpredictable. Reduce SKU count or find alternatives.",
      CX: "Low value, stable. Bulk purchase for discounts, minimal oversight.",
      CY: "Low value, variable. Vendor-managed inventory or blanket orders.",
      CZ: "Low value, unpredictable. Consider discontinuation or consignment.",
    };

    return createJsonResponse({
      products: classified,
      matrix,
      strategies,
      summary: {
        total_products: classified.length,
        total_revenue: totalRevenue,
        a_count: classified.filter(c => c.abc === "A").length,
        b_count: classified.filter(c => c.abc === "B").length,
        c_count: classified.filter(c => c.abc === "C").length,
      },
    }, req);
  } catch (err) {
    return createErrorResponse(err, req, { status: 500, logPrefix: "inventory-classification" });
  }
});
