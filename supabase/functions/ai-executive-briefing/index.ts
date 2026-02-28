import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface KPI {
  label: string;
  value: string;
  trend?: string;
  status: "green" | "amber" | "red" | "neutral";
  category: string;
}

interface Risk {
  title: string;
  severity: "critical" | "warning" | "info";
  action: string;
}

interface Section {
  title: string;
  narrative: string;
  metrics: Array<{ label: string; value: string }>;
}

interface BriefingResult {
  summary: string;
  scorecard: KPI[];
  risks: Risk[];
  actions: string[];
  sections: Section[];
}

const roleSystemPrompts: Record<string, string> = {
  owner: `You are the AI Chief of Staff for a Serbian company owner/CEO. Provide a comprehensive company health overview. Cover:
- Financial performance (revenue, profit, cash position)
- Operational status (inventory, production, orders)
- People (headcount, payroll cost, leave)
- Sales pipeline and CRM health
- Top risks requiring attention
Be direct, data-driven, and highlight action items.`,

  admin: `You are the AI Chief of Staff for a company administrator. Provide a full operational overview covering all departments. Focus on:
- Financial KPIs and trends
- Pending approvals and bottlenecks
- System health and data quality
- Cross-department issues`,

  manager: `You are an AI operations analyst for a department manager. Focus on:
- Team performance metrics
- Pending approvals and tasks
- Inventory and stock alerts
- Budget vs actuals for the department`,

  accountant: `You are an AI financial controller assistant. Focus on:
- GL health: unposted journals, unreconciled items
- Bank reconciliation status
- Tax deadlines and PDV periods
- Open items aging
- Cash flow position`,

  sales: `You are an AI sales analyst. Focus on:
- Pipeline value and stage distribution
- Lead conversion rates
- Overdue quotes and at-risk opportunities
- Top opportunities to close
- Revenue targets vs actuals`,

  hr: `You are an AI HR analyst. Focus on:
- Headcount changes and turnover
- Payroll cost trends
- Leave utilization rates
- Contract expirations coming up
- Compliance status`,

  warehouse: `You are an AI warehouse operations analyst. Focus on:
- Daily sales vs targets
- Top selling products
- Stock alerts and reorder needs
- POS session summaries
- Inventory movements`,
};

function detectRole(memberRole: string): string {
  // Direct mapping from app_role enum values
  const roleMap: Record<string, string> = {
    admin: "admin",
    super_admin: "admin",
    manager: "manager",
    accountant: "accountant",
    sales: "sales",
    hr: "hr",
    store: "warehouse",
    user: "warehouse",
  };
  const mapped = roleMap[(memberRole || "").toLowerCase()];
  if (mapped) return mapped;
  // Legacy fallback for non-enum values
  const r = (memberRole || "").toLowerCase();
  if (r.includes("owner") || r.includes("ceo") || r.includes("director")) return "owner";
  if (r.includes("admin")) return "admin";
  if (r.includes("account") || r.includes("financ") || r.includes("bookkeep")) return "accountant";
  if (r.includes("sales") || r.includes("commercial")) return "sales";
  if (r.includes("hr") || r.includes("human")) return "hr";
  if (r.includes("warehouse") || r.includes("store") || r.includes("pos")) return "warehouse";
  if (r.includes("manager")) return "manager";
  return "admin";
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

    const { tenant_id, language, date_from, date_to } = await req.json();
    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default to last 30 days if not provided
    const today = new Date().toISOString().split("T")[0];
    const defaultFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const periodFrom = date_from || defaultFrom;
    const periodTo = date_to || today;

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Get membership + role
    const { data: membership } = await supabase
      .from("tenant_members").select("role")
      .eq("user_id", caller.id).eq("tenant_id", tenant_id).eq("status", "active").maybeSingle();

    if (!membership) {
      const { data: sa } = await supabase.from("user_roles").select("id").eq("user_id", caller.id).eq("role", "super_admin").maybeSingle();
      if (!sa) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const userRole = detectRole(membership?.role || "admin");
    const sr = language === "sr";

    // Gather KPI data in parallel — filtered by date range
    const [
      invoiceStats, partnerCount, productCount, employeeCount,
      draftJournals, overdueInvoices, lowStockItems,
      recentPayroll, pendingApprovals, pipelineData,
      posTransactions, leaveRequests, productionOrders
    ] = await Promise.all([
      supabase.from("invoices").select("status, total, invoice_date").eq("tenant_id", tenant_id)
        .gte("invoice_date", periodFrom).lte("invoice_date", periodTo),
      supabase.from("partners").select("id", { count: "exact", head: true }).eq("tenant_id", tenant_id).eq("is_active", true),
      supabase.from("products").select("id", { count: "exact", head: true }).eq("tenant_id", tenant_id),
      supabase.from("employees").select("id", { count: "exact", head: true }).eq("tenant_id", tenant_id).eq("status", "active"),
      supabase.from("journal_entries").select("id", { count: "exact", head: true }).eq("tenant_id", tenant_id).eq("status", "draft"),
      supabase.from("invoices").select("partner_name, total, due_date", { count: "exact" }).eq("tenant_id", tenant_id)
        .in("status", ["draft", "sent"]).lt("due_date", today)
        .gte("invoice_date", periodFrom).lte("invoice_date", periodTo),
      supabase.from("inventory_stock").select("product_id, quantity_on_hand, min_stock_level").eq("tenant_id", tenant_id).gt("min_stock_level", 0),
      supabase.from("payroll_runs").select("total_gross, total_net, period_month, period_year, status").eq("tenant_id", tenant_id).in("status", ["calculated", "approved", "paid"]).order("period_year", { ascending: false }).order("period_month", { ascending: false }).limit(3),
      supabase.from("approval_requests").select("id", { count: "exact", head: true }).eq("tenant_id", tenant_id).eq("status", "pending"),
      supabase.from("opportunities").select("title, value, probability, stage").eq("tenant_id", tenant_id).in("stage", ["qualification", "proposal", "negotiation", "discovery"]),
      supabase.from("pos_transactions").select("total, created_at").eq("tenant_id", tenant_id)
        .gte("created_at", periodFrom).lte("created_at", periodTo + "T23:59:59Z"),
      supabase.from("leave_requests").select("id, status, leave_type").eq("tenant_id", tenant_id).eq("status", "pending")
        .gte("start_date", periodFrom).lte("start_date", periodTo),
      supabase.from("production_orders").select("status, quantity").eq("tenant_id", tenant_id).in("status", ["planned", "in_progress"]),
    ]);

    // Calculate KPIs
    const invoices = invoiceStats.data || [];
    const paidInvoices = invoices.filter(i => i.status === "paid" || i.status === "posted");
    const revenue = paidInvoices.reduce((s, i) => s + Number(i.total), 0);
    const overdueTotal = (overdueInvoices.data || []).reduce((s: number, i: any) => s + Number(i.total), 0);
    const lowStock = (lowStockItems.data || []).filter((s: any) => Number(s.quantity_on_hand) < Number(s.min_stock_level));
    const pipelineValue = (pipelineData.data || []).reduce((s: number, o: any) => s + Number(o.value || 0), 0);
    const posSales = (posTransactions.data || []).reduce((s: number, t: any) => s + Number(t.total), 0);

    const kpiData = {
      role: userRole,
      period_from: periodFrom,
      period_to: periodTo,
      revenue: revenue.toFixed(2),
      overdue_count: overdueInvoices.count || 0,
      overdue_total: overdueTotal.toFixed(2),
      partners: partnerCount.count || 0,
      products: productCount.count || 0,
      employees: employeeCount.count || 0,
      draft_journals: draftJournals.count || 0,
      low_stock_count: lowStock.length,
      pending_approvals: pendingApprovals.count || 0,
      pipeline_value: pipelineValue.toFixed(2),
      pipeline_count: (pipelineData.data || []).length,
      pos_sales: posSales.toFixed(2),
      pending_leaves: (leaveRequests.data || []).length,
      active_production_orders: (productionOrders.data || []).length,
      latest_payroll_gross: recentPayroll.data?.[0]?.total_gross || 0,
      total_invoices: invoices.length,
      paid_invoices: paidInvoices.length,
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const systemPrompt = roleSystemPrompts[userRole] || roleSystemPrompts.admin;
    const langHint = sr ? " Respond in Serbian (Latin script)." : " Respond in English.";

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt + langHint },
          { role: "user", content: `Generate an executive briefing based on this company data for the period ${periodFrom} to ${periodTo}:\n${JSON.stringify(kpiData, null, 2)}\n\nToday's date: ${today}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "provide_briefing",
            description: "Return the structured executive briefing",
            parameters: {
              type: "object",
              properties: {
                summary: { type: "string", description: "2-3 sentence executive overview" },
                scorecard: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      label: { type: "string" },
                      value: { type: "string" },
                      trend: { type: "string", description: "e.g. '+12%' or 'stable'" },
                      status: { type: "string", enum: ["green", "amber", "red", "neutral"] },
                      category: { type: "string", enum: ["financial", "operations", "people", "sales"] },
                    },
                    required: ["label", "value", "status", "category"],
                    additionalProperties: false,
                  },
                },
                risks: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      severity: { type: "string", enum: ["critical", "warning", "info"] },
                      action: { type: "string" },
                    },
                    required: ["title", "severity", "action"],
                    additionalProperties: false,
                  },
                },
                actions: { type: "array", items: { type: "string" }, description: "Top 5 recommended actions" },
                sections: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      narrative: { type: "string" },
                      metrics: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            label: { type: "string" },
                            value: { type: "string" },
                          },
                          required: ["label", "value"],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ["title", "narrative", "metrics"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["summary", "scorecard", "risks", "actions", "sections"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "provide_briefing" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      return new Response(JSON.stringify({ error: "AI service error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      return new Response(JSON.stringify({ error: "AI did not return structured output" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const briefing: BriefingResult = JSON.parse(toolCall.function.arguments);

    // Audit log
    try {
      await supabase.from("ai_action_log").insert({
        tenant_id,
        user_id: caller.id,
        action_type: "executive_briefing",
        module: "analytics",
        model_version: "gemini-3-flash-preview",
        reasoning: `Generated ${userRole} briefing (${periodFrom} to ${periodTo}): ${briefing.summary?.substring(0, 200)}`,
      });
    } catch (e) {
      console.warn("Failed to log AI action:", e);
    }

    return new Response(JSON.stringify({ ...briefing, role: userRole, raw_kpis: kpiData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-executive-briefing error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
