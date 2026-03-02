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

    // Verify user
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) return createErrorResponse("Unauthorized", req, { status: 401 });

    const { tenant_id, supplier_id, horizon_days = 30 } = await req.json();
    if (!tenant_id) return createErrorResponse("tenant_id required", req, { status: 400 });

    // Rate limit: 10 req/min per tenant
    const rl = checkRateLimit(`ordering-${tenant_id}`, 10, 60_000);
    if (!rl.allowed) return createErrorResponse("Rate limited", req, { status: 429 });

    // 1. Get products linked to supplier via PO lines
    let poQuery = supabase
      .from("purchase_order_lines")
      .select("product_id, unit_price, purchase_order_id, purchase_orders!inner(supplier_id, tenant_id)")
      .eq("purchase_orders.tenant_id", tenant_id);

    if (supplier_id) {
      poQuery = poQuery.eq("purchase_orders.supplier_id", supplier_id);
    }

    const { data: poLines } = await poQuery.limit(500);
    if (!poLines || poLines.length === 0) {
      return createJsonResponse({ predictions: [], message: "No purchase order history found" }, req);
    }

    // Map product -> supplier + last price
    const productSupplierMap = new Map<string, { supplier_id: string; price: number }>();
    for (const line of poLines as any[]) {
      if (!line.product_id) continue;
      const sid = line.purchase_orders?.supplier_id;
      if (sid) {
        productSupplierMap.set(line.product_id, { supplier_id: sid, price: Number(line.unit_price) || 0 });
      }
    }

    const productIds = Array.from(productSupplierMap.keys());
    if (productIds.length === 0) return createJsonResponse({ predictions: [] }, req);

    // 2. Fetch sales data (last 24 months) from invoice_items
    const twoYearsAgo = new Date();
    twoYearsAgo.setMonth(twoYearsAgo.getMonth() - 24);
    const cutoffDate = twoYearsAgo.toISOString().split("T")[0];

    const { data: invoiceItems } = await supabase
      .from("invoice_items")
      .select("product_id, quantity, invoice_id")
      .eq("tenant_id", tenant_id)
      .in("product_id", productIds.slice(0, 100))
      .limit(5000);

    // Get invoice dates
    const invoiceIds = [...new Set((invoiceItems || []).map((i: any) => i.invoice_id).filter(Boolean))];
    const { data: invoices } = await supabase
      .from("invoices")
      .select("id, invoice_date, status")
      .eq("tenant_id", tenant_id)
      .in("id", invoiceIds.slice(0, 500))
      .neq("status", "cancelled");

    const invoiceDateMap = new Map((invoices || []).map((inv: any) => [inv.id, inv.invoice_date]));

    // Aggregate monthly sales per product
    const monthlySales = new Map<string, Map<string, number>>();
    for (const item of (invoiceItems || []) as any[]) {
      if (!item.product_id) continue;
      const date = invoiceDateMap.get(item.invoice_id);
      if (!date || date < cutoffDate) continue;
      const monthKey = (date as string).substring(0, 7);
      if (!monthlySales.has(item.product_id)) monthlySales.set(item.product_id, new Map());
      const pm = monthlySales.get(item.product_id)!;
      pm.set(monthKey, (pm.get(monthKey) || 0) + Number(item.quantity || 0));
    }

    // 3. Fetch current stock
    const { data: stockData } = await supabase
      .from("inventory_stock")
      .select("product_id, quantity")
      .eq("tenant_id", tenant_id)
      .in("product_id", productIds.slice(0, 100));

    const stockMap = new Map<string, number>();
    for (const s of (stockData || []) as any[]) {
      stockMap.set(s.product_id, (stockMap.get(s.product_id) || 0) + Number(s.quantity || 0));
    }

    // 4. Fetch avg lead times
    const { data: leadTimes } = await supabase
      .from("supplier_lead_times")
      .select("supplier_id, product_id, lead_time_days")
      .eq("tenant_id", tenant_id);

    const avgLeadTime = new Map<string, number>();
    const ltCounts = new Map<string, number>();
    for (const lt of (leadTimes || []) as any[]) {
      const key = `${lt.supplier_id}_${lt.product_id || "all"}`;
      avgLeadTime.set(key, (avgLeadTime.get(key) || 0) + (lt.lead_time_days || 0));
      ltCounts.set(key, (ltCounts.get(key) || 0) + 1);
    }
    for (const [k, v] of avgLeadTime) {
      avgLeadTime.set(k, Math.round(v / (ltCounts.get(k) || 1)));
    }

    // 5. Generate predictions
    const predictions: any[] = [];
    const now = new Date();

    for (const [productId, { supplier_id: suppId, price }] of productSupplierMap) {
      const salesMap = monthlySales.get(productId);
      if (!salesMap || salesMap.size < 2) continue;

      const sortedMonths = Array.from(salesMap.keys()).sort();
      const monthlies = sortedMonths.map(m => salesMap.get(m) || 0);

      // Seasonal decompose
      const trend = movingAverage(monthlies, Math.min(12, monthlies.length));
      const lastTrend = trend[trend.length - 1] || 0;

      // Daily demand
      const totalSales = monthlies.reduce((a, b) => a + b, 0);
      const monthsSpan = sortedMonths.length;
      const avgDailyDemand = totalSales / (monthsSpan * 30);

      // Lead time
      const ltKey = `${suppId}_${productId}`;
      const ltKeyAll = `${suppId}_all`;
      const leadTimeDays = avgLeadTime.get(ltKey) || avgLeadTime.get(ltKeyAll) || 14;

      // Safety stock (Z=1.65 for 95% service level × std dev of daily demand × sqrt(lead time))
      const dailies = monthlies.map(m => m / 30);
      const mean = dailies.reduce((a, b) => a + b, 0) / dailies.length;
      const variance = dailies.reduce((a, d) => a + (d - mean) ** 2, 0) / dailies.length;
      const stdDev = Math.sqrt(variance);
      const safetyStock = Math.ceil(1.65 * stdDev * Math.sqrt(leadTimeDays));

      // Reorder point
      const reorderPoint = Math.ceil(avgDailyDemand * leadTimeDays + safetyStock);

      // Current stock
      const currentStock = stockMap.get(productId) || 0;

      // EOQ (Economic Order Quantity) - simplified
      const annualDemand = avgDailyDemand * 365;
      const orderingCost = 50; // assumed fixed cost per order
      const holdingCostRate = 0.25;
      const holdingCost = price * holdingCostRate;
      const eoq = holdingCost > 0 ? Math.ceil(Math.sqrt((2 * annualDemand * orderingCost) / holdingCost)) : Math.ceil(annualDemand / 12);

      const recommendedQty = Math.max(eoq, reorderPoint - currentStock + safetyStock);

      // Order by date
      const daysUntilStockout = avgDailyDemand > 0 ? Math.max(0, (currentStock - reorderPoint) / avgDailyDemand) : 999;
      const orderByDate = new Date(now);
      orderByDate.setDate(orderByDate.getDate() + Math.max(0, Math.floor(daysUntilStockout) - leadTimeDays));

      // Confidence based on data quality
      const confidence = Math.min(0.95, 0.5 + (monthsSpan / 24) * 0.3 + (leadTimes?.length ? 0.15 : 0));

      // Only include if at or below reorder point (within horizon)
      if (currentStock <= reorderPoint * 1.2 || daysUntilStockout <= horizon_days) {
        predictions.push({
          tenant_id, supplier_id: suppId, product_id: productId,
          current_stock: currentStock,
          avg_daily_demand: Math.round(avgDailyDemand * 100) / 100,
          lead_time_days: leadTimeDays,
          reorder_point: reorderPoint,
          safety_stock: safetyStock,
          recommended_qty: recommendedQty > 0 ? recommendedQty : eoq,
          order_by_date: orderByDate.toISOString().split("T")[0],
          confidence: Math.round(confidence * 100) / 100,
          estimated_value: Math.round(recommendedQty * price * 100) / 100,
          horizon_days,
          status: "pending",
        });
      }
    }

    // Sort by urgency (earliest order_by_date first)
    predictions.sort((a, b) => a.order_by_date.localeCompare(b.order_by_date));

    // Store predictions (upsert)
    if (predictions.length > 0) {
      // Clear old pending predictions for this run
      await supabase
        .from("supplier_order_predictions")
        .delete()
        .eq("tenant_id", tenant_id)
        .eq("status", "pending")
        .in("supplier_id", supplier_id ? [supplier_id] : predictions.map(p => p.supplier_id));

      const { error: insertErr } = await supabase
        .from("supplier_order_predictions")
        .insert(predictions);
      if (insertErr) console.error("Insert predictions error:", insertErr);
    }

    // Audit log
    await supabase.from("ai_action_log").insert({
      tenant_id, module: "purchasing", action_type: "ordering_prediction",
      user_id: user.id,
      input_data: { supplier_id, horizon_days, product_count: productIds.length },
      ai_output: { prediction_count: predictions.length },
      confidence_score: predictions.length > 0 ? predictions.reduce((a, p) => a + p.confidence, 0) / predictions.length : 0,
    });

    return createJsonResponse({
      predictions,
      summary: {
        total: predictions.length,
        avg_confidence: predictions.length > 0 ? Math.round(predictions.reduce((a, p) => a + p.confidence, 0) / predictions.length * 100) / 100 : 0,
        total_value: Math.round(predictions.reduce((a, p) => a + p.estimated_value, 0) * 100) / 100,
        urgent: predictions.filter(p => new Date(p.order_by_date) <= new Date(Date.now() + 7 * 86400000)).length,
      },
    }, req);
  } catch (err) {
    return createErrorResponse(err, req, { status: 500, logPrefix: "ai-ordering-prediction" });
  }
});

function movingAverage(data: number[], window: number): number[] {
  return data.map((_, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = data.slice(start, i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}
