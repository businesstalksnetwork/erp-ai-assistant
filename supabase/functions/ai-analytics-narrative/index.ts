import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const systemPrompts: Record<string, string> = {
  dashboard: `You are a financial analyst AI. Given the user's financial KPIs, provide a 2-3 sentence executive summary. Be specific about which metrics are good/concerning.`,
  ratios: `You are a financial analyst AI. Given financial ratios, interpret them in 2-3 sentences. Highlight strengths and areas of concern.`,
  cashflow: `You are a financial analyst AI. Given cash flow forecast data, provide a 2-3 sentence risk assessment.`,
  planning: `You are a business strategy AI advisor. Given YTD actuals vs targets, provide 3-5 actionable recommendations.`,
  budget: `You are a financial analyst AI. Given budget vs actual data, provide a 2-3 sentence analysis.`,
  breakeven: `You are a financial analyst AI. Given break-even analysis data, provide a 2-3 sentence interpretation.`,
  profitability: `You are a financial analyst AI. Given profitability data, provide a 2-3 sentence analysis.`,
  expenses: `You are a financial analyst AI. Given expense breakdown data, provide a 2-3 sentence analysis.`,
  working_capital: `You are a financial analyst AI specializing in Serbian SME liquidity. Given working capital metrics, provide a 2-3 sentence liquidity stress assessment.`,
  customer_risk: `You are a credit risk analyst AI. Given customer payment behavior data, provide a 2-3 sentence risk assessment.`,
  supplier_risk: `You are a procurement analyst AI. Given supplier dependency data, provide a 2-3 sentence strategic assessment.`,
  margin_bridge: `You are a financial analyst AI. Given margin waterfall data, provide a 2-3 sentence analysis.`,
  payroll_benchmark: `You are an HR financial analyst AI. Given payroll benchmark data, provide a 2-3 sentence analysis.`,
  vat_trap: `You are a Serbian tax specialist AI. Given VAT cash trap data, provide a 2-3 sentence assessment.`,
  inventory_health: `You are an inventory management AI. Given inventory health data, provide a 2-3 sentence analysis.`,
  early_warning: `You are a financial controls AI. Given anomaly detection data, provide a 2-3 sentence executive summary.`,
  production: `You are a production operations AI. Given production order data, analyze completion rates, bottlenecks, capacity utilization, and on-time delivery. Provide a 2-3 sentence analysis.`,
  crm_pipeline: `You are a sales pipeline analyst AI. Given CRM pipeline data, analyze pipeline value by stage, conversion rates, average deal size, and sales velocity. Provide a 2-3 sentence analysis.`,
  hr_overview: `You are an HR analytics AI. Given HR data, analyze headcount trends, payroll as percentage of revenue, turnover indicators, and workforce composition. Provide a 2-3 sentence analysis.`,
  pos_performance: `You are a retail analytics AI. Given POS transaction data, analyze daily sales averages, top-selling products, peak hours, and payment method distribution. Provide a 2-3 sentence analysis.`,
  purchasing: `You are a procurement analyst AI. Given purchasing data, analyze supplier concentration, purchase order fulfillment rates, price variance, and lead times. Provide a 2-3 sentence analysis.`,
  sales_performance: `You are a sales performance analyst AI. Given sales data including quotes, sales orders, invoices, and dispatch notes, analyze conversion rates, average deal size, revenue trends, and top customers. Provide a 2-3 sentence analysis.`,
  bank_reconciliation: `You are a bank reconciliation analyst AI. Given reconciliation data, analyze matching accuracy, unmatched items count and value, and reconciliation completion rate. Provide a 2-3 sentence assessment.`,
  fleet: `You are a fleet management analyst AI. Given vehicle fleet data, analyze total cost of ownership, maintenance schedule compliance, and vehicle utilization. Provide a 2-3 sentence analysis.`,
  kalkulacija: `You are a pricing/margin analyst AI for Serbian retail. Given kalkulacija data, analyze purchase-to-retail margins, markup distribution, and PDV impact. Provide a 2-3 sentence analysis.`,
  cost_center_pl: `You are a management accounting AI. Given cost center profitability data, analyze revenue and expense allocation across cost centers. Provide a 2-3 sentence analysis.`,
  payroll_recon: `You are a payroll reconciliation AI. Given payroll bank reconciliation data, analyze matching accuracy between payroll calculations and actual bank payments. Provide a 2-3 sentence analysis.`,
  assets: `You are an asset management AI. Given asset data, analyze total asset value, depreciation status, and maintenance needs. Provide a 2-3 sentence analysis.`,
  documents: `You are a document management AI. Given document statistics, analyze document volumes, pending items, and compliance status. Provide a 2-3 sentence analysis.`,
  leasing: `You are a lease contract analyst AI. Given lease data, analyze active leases, upcoming expirations, and total obligations. Provide a 2-3 sentence analysis.`,
};

/** Pre-fetch relevant data based on context type — avoids AI guessing SQL */
async function prefetchContextData(supabase: any, tenantId: string, contextType: string): Promise<Record<string, unknown>> {
  const today = new Date().toISOString().split("T")[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  const result: Record<string, unknown> = {};

  try {
    switch (contextType) {
      case "dashboard": {
        const [inv, emp, draft, overdue] = await Promise.all([
          supabase.from("invoices").select("status, total").eq("tenant_id", tenantId).gte("invoice_date", thirtyDaysAgo),
          supabase.from("employees").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "active"),
          supabase.from("journal_entries").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "draft"),
          supabase.from("invoices").select("total", { count: "exact" }).eq("tenant_id", tenantId).in("status", ["draft", "sent"]).lt("due_date", today),
        ]);
        const invoices = inv.data || [];
        result.revenue = invoices.filter((i: any) => i.status === "paid" || i.status === "posted").reduce((s: number, i: any) => s + Number(i.total), 0);
        result.total_invoices = invoices.length;
        result.active_employees = emp.count || 0;
        result.draft_journals = draft.count || 0;
        result.overdue_invoices = overdue.count || 0;
        result.overdue_total = (overdue.data || []).reduce((s: number, i: any) => s + Number(i.total), 0);
        break;
      }
      case "crm_pipeline": {
        const [opp, leads] = await Promise.all([
          supabase.from("opportunities").select("stage, value, probability, status").eq("tenant_id", tenantId).in("stage", ["qualification", "proposal", "negotiation", "discovery"]),
          supabase.from("leads").select("status", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "new"),
        ]);
        const opps = opp.data || [];
        result.pipeline_value = opps.reduce((s: number, o: any) => s + Number(o.value || 0), 0);
        result.pipeline_count = opps.length;
        result.by_stage = opps.reduce((acc: any, o: any) => { acc[o.stage] = (acc[o.stage] || 0) + 1; return acc; }, {});
        result.weighted_value = opps.reduce((s: number, o: any) => s + Number(o.value || 0) * Number(o.probability || 0) / 100, 0);
        result.new_leads = leads.count || 0;
        break;
      }
      case "hr_overview": {
        const [emp, payroll, leave] = await Promise.all([
          supabase.from("employees").select("status, department").eq("tenant_id", tenantId),
          supabase.from("payroll_runs").select("total_gross, total_net, period_month, period_year, status").eq("tenant_id", tenantId).in("status", ["calculated", "approved", "paid"]).order("period_year", { ascending: false }).order("period_month", { ascending: false }).limit(3),
          supabase.from("leave_requests").select("status, leave_type", { count: "exact" }).eq("tenant_id", tenantId).eq("status", "pending"),
        ]);
        const employees = emp.data || [];
        result.active_count = employees.filter((e: any) => e.status === "active").length;
        result.total_count = employees.length;
        result.by_department = employees.filter((e: any) => e.status === "active").reduce((acc: any, e: any) => { acc[e.department || "Unknown"] = (acc[e.department || "Unknown"] || 0) + 1; return acc; }, {});
        result.latest_payroll = payroll.data?.[0] || null;
        result.pending_leaves = leave.count || 0;
        break;
      }
      case "production": {
        const { data: orders } = await supabase.from("production_orders").select("status, quantity, planned_start_date, planned_end_date").eq("tenant_id", tenantId);
        const all = orders || [];
        result.total_orders = all.length;
        result.by_status = all.reduce((acc: any, o: any) => { acc[o.status] = (acc[o.status] || 0) + 1; return acc; }, {});
        result.in_progress = all.filter((o: any) => o.status === "in_progress").length;
        result.planned = all.filter((o: any) => o.status === "planned").length;
        result.completed = all.filter((o: any) => o.status === "completed").length;
        break;
      }
      case "pos_performance": {
        const { data: txns } = await supabase.from("pos_transactions").select("total, created_at, payment_method").eq("tenant_id", tenantId).gte("created_at", thirtyDaysAgo);
        const all = txns || [];
        result.total_sales = all.reduce((s: number, t: any) => s + Number(t.total), 0);
        result.transaction_count = all.length;
        result.avg_transaction = all.length > 0 ? result.total_sales as number / all.length : 0;
        result.by_payment_method = all.reduce((acc: any, t: any) => { acc[t.payment_method || "cash"] = (acc[t.payment_method || "cash"] || 0) + 1; return acc; }, {});
        break;
      }
      case "purchasing": {
        const [po, si] = await Promise.all([
          supabase.from("purchase_orders").select("status, total_amount").eq("tenant_id", tenantId).gte("created_at", thirtyDaysAgo),
          supabase.from("supplier_invoices").select("status, total_amount, payment_status").eq("tenant_id", tenantId).gte("created_at", thirtyDaysAgo),
        ]);
        const pos = po.data || [];
        const sis = si.data || [];
        result.po_count = pos.length;
        result.po_total = pos.reduce((s: number, p: any) => s + Number(p.total_amount || 0), 0);
        result.po_by_status = pos.reduce((acc: any, p: any) => { acc[p.status] = (acc[p.status] || 0) + 1; return acc; }, {});
        result.si_count = sis.length;
        result.si_total = sis.reduce((s: number, i: any) => s + Number(i.total_amount || 0), 0);
        result.si_unpaid = sis.filter((i: any) => i.payment_status !== "paid").length;
        break;
      }
      case "sales_performance": {
        const [inv, quotes, orders] = await Promise.all([
          supabase.from("invoices").select("status, total, partner_name").eq("tenant_id", tenantId).gte("invoice_date", thirtyDaysAgo),
          supabase.from("quotes").select("status, total_amount").eq("tenant_id", tenantId).gte("created_at", thirtyDaysAgo),
          supabase.from("sales_orders").select("status, total_amount").eq("tenant_id", tenantId).gte("created_at", thirtyDaysAgo),
        ]);
        const invoices = inv.data || [];
        result.invoice_revenue = invoices.filter((i: any) => i.status === "paid" || i.status === "posted").reduce((s: number, i: any) => s + Number(i.total), 0);
        result.invoice_count = invoices.length;
        result.quote_count = (quotes.data || []).length;
        result.quote_total = (quotes.data || []).reduce((s: number, q: any) => s + Number(q.total_amount || 0), 0);
        result.order_count = (orders.data || []).length;
        result.order_total = (orders.data || []).reduce((s: number, o: any) => s + Number(o.total_amount || 0), 0);
        break;
      }
      case "bank_reconciliation": {
        const [stmts, unrec] = await Promise.all([
          supabase.from("bank_statements").select("status").eq("tenant_id", tenantId).gte("statement_date", thirtyDaysAgo),
          supabase.from("bank_statement_lines").select("amount, match_status", { count: "exact" }).eq("tenant_id", tenantId).eq("match_status", "unmatched"),
        ]);
        result.total_statements = (stmts.data || []).length;
        result.reconciled = (stmts.data || []).filter((s: any) => s.status === "reconciled").length;
        result.unmatched_lines = unrec.count || 0;
        result.unmatched_total = (unrec.data || []).reduce((s: number, l: any) => s + Math.abs(Number(l.amount)), 0);
        break;
      }
      case "inventory_health": {
        const { data: stock } = await supabase.from("inventory_stock").select("quantity_on_hand, min_stock_level, product_id").eq("tenant_id", tenantId);
        const all = stock || [];
        result.total_items = all.length;
        result.low_stock = all.filter((s: any) => Number(s.min_stock_level) > 0 && Number(s.quantity_on_hand) < Number(s.min_stock_level)).length;
        result.out_of_stock = all.filter((s: any) => Number(s.quantity_on_hand) <= 0).length;
        break;
      }
      case "fleet": {
        const { data: vehicles } = await supabase.from("fleet_vehicles").select("status, next_service_date, insurance_expiry, registration_expiry").eq("tenant_id", tenantId);
        const all = vehicles || [];
        result.total_vehicles = all.length;
        result.active = all.filter((v: any) => v.status === "active").length;
        result.service_due = all.filter((v: any) => v.next_service_date && v.next_service_date <= today).length;
        result.insurance_expiring = all.filter((v: any) => v.insurance_expiry && v.insurance_expiry <= today).length;
        break;
      }
      default:
        // For other contexts, we just use the data passed from the client
        break;
    }
  } catch (e) {
    console.warn(`[prefetch] Error for ${contextType}:`, e);
  }

  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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
    const caller = { id: claimsData.claims.sub as string };

    const { tenant_id, context_type, data, language } = await req.json();
    if (!tenant_id || !context_type) {
      return new Response(JSON.stringify({ error: "tenant_id and context_type are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Verify tenant membership
    const { data: isSuperAdmin } = await supabase
      .from("user_roles").select("id")
      .eq("user_id", caller.id).eq("role", "super_admin").maybeSingle();

    if (!isSuperAdmin) {
      const { data: membership } = await supabase
        .from("tenant_members").select("id")
        .eq("user_id", caller.id).eq("tenant_id", tenant_id).eq("status", "active").maybeSingle();
      if (!membership) {
        return new Response(JSON.stringify({ error: "Forbidden" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Check cache first
    const dataHash = JSON.stringify(data || {}).length.toString() + "_" + context_type;
    const { data: cached } = await supabase
      .from("ai_narrative_cache")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("context_type", context_type)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached && cached.data_hash === dataHash) {
      return new Response(JSON.stringify({
        narrative: cached.narrative,
        recommendations: cached.recommendations,
        _cached: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pre-fetch DB data server-side — no more AI-generated SQL guessing
    const dbContext = await prefetchContextData(supabase, tenant_id, context_type);

    const baseSystemPrompt = systemPrompts[context_type] || systemPrompts.dashboard;
    const langHint = language === "sr" ? " Respond in Serbian (Latin script)." : " Respond in English.";

    const mergedData = { ...(data || {}), ...dbContext };

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: baseSystemPrompt + langHint },
          { role: "user", content: `Analyze these metrics for ${context_type}:\n${JSON.stringify(mergedData, null, 2)}\n\nProvide your analysis using the provide_narrative tool.` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "provide_narrative",
            description: "Return the final narrative analysis and recommendations.",
            parameters: {
              type: "object",
              properties: {
                narrative: { type: "string", description: "2-3 sentence analysis" },
                recommendations: { type: "array", items: { type: "string" }, description: "3-5 actionable recommendations" },
              },
              required: ["narrative", "recommendations"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "provide_narrative" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      return new Response(JSON.stringify({ error: "AI service temporarily unavailable." }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    let narrative = "";
    let recommendations: string[] = [];

    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      narrative = parsed.narrative || "";
      recommendations = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];
    } else {
      // Fallback: use content directly
      narrative = aiData.choices?.[0]?.message?.content || "";
    }

    // Cache result
    try {
      await supabase.from("ai_narrative_cache").delete()
        .eq("tenant_id", tenant_id).eq("context_type", context_type);
      await supabase.from("ai_narrative_cache").insert({
        tenant_id,
        context_type,
        narrative,
        recommendations,
        data_hash: dataHash,
      });
    } catch (e) {
      console.warn("Failed to cache narrative:", e);
    }

    // Audit log
    try {
      await supabase.from("ai_action_log").insert({
        tenant_id,
        user_id: caller.id,
        action_type: "narrative_generation",
        module: context_type,
        model_version: "gemini-3-flash-preview",
        user_decision: "auto",
        reasoning: `Narrative for ${context_type}: ${narrative.substring(0, 200)}`,
      });
    } catch (e) {
      console.warn("Failed to log AI action:", e);
    }

    return new Response(JSON.stringify({ narrative, recommendations }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-analytics-narrative error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
