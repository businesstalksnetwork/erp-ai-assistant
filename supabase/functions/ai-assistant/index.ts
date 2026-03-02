import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/error-handler.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";
import { checkRateLimit } from "../_shared/rate-limiter.ts";

// ── Security: prompt injection patterns ──
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /forget\s+(all\s+)?previous/i,
  /you\s+are\s+now\s+a/i,
  /system\s*:\s*/i,
  /\[INST\]/i,
  /<<SYS>>/i,
  /pretend\s+you\s+are/i,
  /act\s+as\s+if\s+you/i,
  /override\s+(your|the)\s+(system|instructions)/i,
  // Unicode/homoglyph injection detection
  /[\u200B-\u200F\u2028-\u202F\u2060-\u206F\uFEFF]/,
  // Base64 encoded instruction detection
  /aWdub3JlIGFsbCBwcmV2aW91cw/i, // "ignore all previous" in base64
  /c3lzdGVtOi/i, // "system:" in base64
  // JSON injection in tool arguments
  /"\s*}\s*,\s*{/,
  // Role impersonation
  /\b(assistant|system)\s*:\s/i,
  /new\s+instructions?\s*:/i,
  /disregard\s+(all|any|the)\s+(above|previous)/i,
];

function detectPromptInjection(text: string): boolean {
  return INJECTION_PATTERNS.some(p => p.test(text));
}

// ── Security: rate limiting ──
async function checkRateLimit(supabase: any, userId: string, tenantId: string): Promise<boolean> {
  const windowStart = new Date();
  windowStart.setMinutes(windowStart.getMinutes() - 1);

  const { count } = await supabase
    .from("ai_rate_limits")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .gte("window_start", windowStart.toISOString());

  // Allow 20 requests per minute
  if ((count || 0) >= 20) return false;

  await supabase.from("ai_rate_limits").insert({
    user_id: userId, tenant_id: tenantId, window_start: new Date().toISOString(),
  });

  return true;
}

// ── Security: token tracking ──
async function trackTokens(supabase: any, tenantId: string, userId: string, fnName: string, model: string, usage: any) {
  try {
    await supabase.from("ai_token_usage").insert({
      tenant_id: tenantId, user_id: userId, function_name: fnName, model,
      prompt_tokens: usage?.prompt_tokens || 0,
      completion_tokens: usage?.completion_tokens || 0,
      total_tokens: usage?.total_tokens || 0,
    });
  } catch (e) { console.warn("Token tracking failed:", e); }
}

// Dynamic schema cache (1 hour TTL)
let cachedSchema: string | null = null;
let schemaCacheTime = 0;
const SCHEMA_CACHE_TTL = 60 * 60 * 1000;

async function getDynamicSchema(supabase: any): Promise<string> {
  if (cachedSchema && Date.now() - schemaCacheTime < SCHEMA_CACHE_TTL) return cachedSchema;
  try {
    const { data: columns } = await supabase.rpc("execute_readonly_query", {
      query_text: `
        SELECT table_name, string_agg(column_name || ' (' || data_type || COALESCE(' ' || character_maximum_length::text, '') || ')', ', ' ORDER BY ordinal_position) as cols
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name NOT LIKE 'pg_%'
          AND table_name NOT IN ('schema_migrations', 'supabase_migrations')
        GROUP BY table_name ORDER BY table_name LIMIT 200
      `,
    });
    if (columns && Array.isArray(columns) && columns.length > 0) {
      cachedSchema = columns.map((t: any) => `- ${t.table_name}: ${t.cols}`).join("\n");
      schemaCacheTime = Date.now();
      return cachedSchema;
    }
  } catch (e) { console.warn("Schema fetch failed:", e); }
  return `- invoices, journal_entries, journal_lines, chart_of_accounts, partners, products, inventory_stock, employees, opportunities, sales_orders, supplier_invoices, production_orders (all with tenant_id)`;
}

// ════════════════════════════════════════════
// TOOL DEFINITIONS (12 tools total)
// ════════════════════════════════════════════

const QUERY_TOOL = {
  type: "function" as const,
  function: {
    name: "query_tenant_data",
    description: "Execute a read-only SQL query against the tenant's ERP database. Only SELECT statements are allowed. Always filter by tenant_id.",
    parameters: {
      type: "object",
      properties: {
        sql: { type: "string", description: "A SELECT SQL query. Must include WHERE tenant_id = '{TENANT_ID}'. Max 50 rows." },
        explanation: { type: "string", description: "Brief explanation of what this query retrieves." },
      },
      required: ["sql", "explanation"], additionalProperties: false,
    },
  },
};

const ANALYZE_TREND_TOOL = {
  type: "function" as const,
  function: {
    name: "analyze_trend",
    description: "Analyze a metric's trend over time. Calculates month-over-month and year-over-year changes.",
    parameters: {
      type: "object",
      properties: {
        metric: { type: "string", enum: ["revenue", "expenses", "invoices_count", "payroll_cost", "inventory_value", "new_partners", "new_leads"], description: "The metric to analyze." },
        months: { type: "number", description: "Number of months to analyze (default 6, max 12)." },
      },
      required: ["metric"], additionalProperties: false,
    },
  },
};

const CREATE_REMINDER_TOOL = {
  type: "function" as const,
  function: {
    name: "create_reminder",
    description: "Create a notification/reminder for the user.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short title (max 100 chars)." },
        message: { type: "string", description: "Detailed message." },
      },
      required: ["title", "message"], additionalProperties: false,
    },
  },
};

const COMPARE_PERIODS_TOOL = {
  type: "function" as const,
  function: {
    name: "compare_periods",
    description: "Compare a financial metric between two time periods.",
    parameters: {
      type: "object",
      properties: {
        metric: { type: "string", enum: ["revenue", "expenses", "invoices_count", "payroll_cost", "new_partners", "new_leads", "pipeline_value"] },
        period1_start: { type: "string" }, period1_end: { type: "string" },
        period2_start: { type: "string" }, period2_end: { type: "string" },
      },
      required: ["metric", "period1_start", "period1_end", "period2_start", "period2_end"], additionalProperties: false,
    },
  },
};

const WHAT_IF_TOOL = {
  type: "function" as const,
  function: {
    name: "what_if_scenario",
    description: "Project the impact of a business change.",
    parameters: {
      type: "object",
      properties: {
        scenario_type: { type: "string", enum: ["price_change", "headcount_change", "customer_loss", "cost_reduction", "revenue_growth"] },
        change_percent: { type: "number" },
        description: { type: "string" },
      },
      required: ["scenario_type", "change_percent", "description"], additionalProperties: false,
    },
  },
};

const KPI_SCORECARD_TOOL = {
  type: "function" as const,
  function: {
    name: "get_kpi_scorecard",
    description: "Get a comprehensive KPI dashboard. Returns revenue, expenses, profit, DSO, headcount, inventory, pipeline.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
};

const EXPLAIN_ACCOUNT_TOOL = {
  type: "function" as const,
  function: {
    name: "explain_account",
    description: "Deep dive into a specific GL account. Returns balance, recent transactions, and 6-month trend.",
    parameters: {
      type: "object",
      properties: { account_code: { type: "string", description: "Account code or keyword" } },
      required: ["account_code"], additionalProperties: false,
    },
  },
};

// ── NEW TOOLS ──

const SEARCH_DOCUMENTS_TOOL = {
  type: "function" as const,
  function: {
    name: "search_documents",
    description: "Search DMS documents by name, content description, category, or tags. Use for questions like 'Find contracts from 2025' or 'Any documents about supplier X'.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search term (name, description, or tag)" },
        category: { type: "string", description: "Optional category filter" },
        limit: { type: "number", description: "Max results (default 10)" },
      },
      required: ["query"], additionalProperties: false,
    },
  },
};

const GET_PARTNER_DOSSIER_TOOL = {
  type: "function" as const,
  function: {
    name: "get_partner_dossier",
    description: "Get complete partner profile: invoices, payments, contacts, activities, risk tier, credit status. Use when asked about a specific customer/supplier.",
    parameters: {
      type: "object",
      properties: {
        partner_name: { type: "string", description: "Partner name or partial name to search" },
      },
      required: ["partner_name"], additionalProperties: false,
    },
  },
};

const FORECAST_CASHFLOW_TOOL = {
  type: "function" as const,
  function: {
    name: "forecast_cashflow",
    description: "Generate 90-day cash flow projection based on open AR, AP, payroll schedule, and historical patterns.",
    parameters: {
      type: "object",
      properties: {
        days: { type: "number", description: "Forecast horizon in days (default 90, max 180)" },
      },
      additionalProperties: false,
    },
  },
};

const DETECT_ANOMALIES_TOOL = {
  type: "function" as const,
  function: {
    name: "detect_anomalies",
    description: "Run on-demand anomaly scan across all modules. Checks for unusual transactions, patterns, and risks.",
    parameters: {
      type: "object",
      properties: {
        focus: { type: "string", enum: ["all", "accounting", "inventory", "hr", "crm", "sales"], description: "Module to focus on (default: all)" },
      },
      additionalProperties: false,
    },
  },
};

const GENERATE_REPORT_TOOL = {
  type: "function" as const,
  function: {
    name: "generate_report",
    description: "Create an ad-hoc report from natural language. E.g. 'Top 10 customers by revenue this year', 'Monthly expense breakdown by category'.",
    parameters: {
      type: "object",
      properties: {
        report_description: { type: "string", description: "Natural language description of desired report" },
        format: { type: "string", enum: ["table", "summary", "detailed"], description: "Output format preference" },
      },
      required: ["report_description"], additionalProperties: false,
    },
  },
};

const CREATE_DRAFT_INVOICE_TOOL = {
  type: "function" as const,
  function: {
    name: "create_draft_invoice",
    description: "Create a draft invoice from natural language. E.g. 'Invoice ABC Corp 50000 RSD for consulting services'. Returns the created invoice for review.",
    parameters: {
      type: "object",
      properties: {
        partner_name: { type: "string", description: "Customer/partner name" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              description: { type: "string" },
              quantity: { type: "number" },
              unit_price: { type: "number" },
              tax_rate: { type: "number", description: "Tax rate percentage (default 20)" },
            },
            required: ["description", "quantity", "unit_price"],
          },
          description: "Line items for the invoice",
        },
        currency: { type: "string", description: "Currency code (default RSD)" },
        notes: { type: "string", description: "Optional invoice notes" },
      },
      required: ["partner_name", "items"], additionalProperties: false,
    },
  },
};

const GET_HR_SUMMARY_TOOL = {
  type: "function" as const,
  function: {
    name: "get_hr_summary",
    description: "Get comprehensive HR overview: headcount, turnover, contract expirations, leave utilization, payroll trends, department breakdown.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
};


// ════════════════════════════════════════════

function validateSql(sql: string, tenantId: string): string {
  const trimmed = sql.trim().replace(/;+$/, "");
  const upper = trimmed.toUpperCase();
  const forbidden = ["INSERT ", "UPDATE ", "DELETE ", "DROP ", "ALTER ", "CREATE ", "TRUNCATE ", "GRANT ", "REVOKE ", "EXECUTE ", "EXEC ", "UNION "];
  for (const kw of forbidden) {
    if (upper.includes(kw)) throw new Error(`Forbidden SQL keyword: ${kw.trim()}`);
  }
  if (!upper.startsWith("SELECT")) throw new Error("Only SELECT queries are allowed");
  const final = trimmed.replace(/'\{TENANT_ID\}'/g, `'${tenantId}'`);
  if (!upper.includes("LIMIT")) return final + " LIMIT 50";
  return final;
}

// SEC-6: Input validation helpers
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
function validateDate(d: string): string {
  if (!DATE_REGEX.test(d)) throw new Error(`Invalid date format: ${d}`);
  return d;
}
function validatePositiveInt(n: any, max: number, fallback: number): number {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 1) return fallback;
  return Math.min(Math.round(v), max);
}

async function analyzeTrend(supabase: any, tenantId: string, metric: string, months: number = 6): Promise<string> {
  const numMonths = validatePositiveInt(months, 12, 6);
  const queries: Record<string, string> = {
    revenue: `SELECT to_char(date_trunc('month', i.invoice_date), 'YYYY-MM') as month, COALESCE(SUM(i.total), 0) as value FROM invoices i WHERE i.tenant_id = '${tenantId}' AND i.status IN ('paid', 'posted') AND i.invoice_date >= (CURRENT_DATE - INTERVAL '${numMonths} months') GROUP BY 1 ORDER BY 1`,
    expenses: `SELECT to_char(date_trunc('month', je.entry_date), 'YYYY-MM') as month, COALESCE(SUM(jl.debit), 0) as value FROM journal_lines jl JOIN journal_entries je ON je.id = jl.journal_entry_id JOIN chart_of_accounts ca ON ca.id = jl.account_id WHERE je.tenant_id = '${tenantId}' AND je.status = 'posted' AND ca.account_type = 'expense' AND je.entry_date >= (CURRENT_DATE - INTERVAL '${numMonths} months') GROUP BY 1 ORDER BY 1`,
    invoices_count: `SELECT to_char(date_trunc('month', invoice_date), 'YYYY-MM') as month, COUNT(*) as value FROM invoices WHERE tenant_id = '${tenantId}' AND invoice_date >= (CURRENT_DATE - INTERVAL '${numMonths} months') GROUP BY 1 ORDER BY 1`,
    payroll_cost: `SELECT to_char(make_date(period_year, period_month, 1), 'YYYY-MM') as month, COALESCE(SUM(total_gross), 0) as value FROM payroll_runs WHERE tenant_id = '${tenantId}' AND status IN ('calculated', 'approved', 'paid') GROUP BY 1 ORDER BY 1 LIMIT ${numMonths}`,
    inventory_value: `SELECT 'current' as month, COALESCE(SUM(s.quantity_on_hand * COALESCE(p.purchase_price, 0)), 0) as value FROM inventory_stock s JOIN products p ON p.id = s.product_id WHERE s.tenant_id = '${tenantId}' GROUP BY 1`,
    new_partners: `SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') as month, COUNT(*) as value FROM partners WHERE tenant_id = '${tenantId}' AND created_at >= (CURRENT_DATE - INTERVAL '${numMonths} months') GROUP BY 1 ORDER BY 1`,
    new_leads: `SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') as month, COUNT(*) as value FROM leads WHERE tenant_id = '${tenantId}' AND created_at >= (CURRENT_DATE - INTERVAL '${numMonths} months') GROUP BY 1 ORDER BY 1`,
  };
  const query = queries[metric];
  if (!query) return JSON.stringify({ error: `Unknown metric: ${metric}` });
  try {
    const { data, error } = await supabase.rpc("execute_readonly_query", { query_text: query });
    if (error) return JSON.stringify({ error: error.message });
    const rows = data || [];
    if (rows.length < 2) return JSON.stringify({ metric, data: rows, trend: "insufficient_data" });
    const trendData = rows.map((row: any, i: number) => {
      const val = Number(row.value);
      const prev = i > 0 ? Number(rows[i - 1].value) : null;
      const mom = prev && prev > 0 ? ((val - prev) / prev * 100).toFixed(1) : null;
      return { month: row.month, value: val, mom_change_pct: mom };
    });
    const latestVal = Number(rows[rows.length - 1].value);
    const firstVal = Number(rows[0].value);
    const overallChange = firstVal > 0 ? ((latestVal - firstVal) / firstVal * 100).toFixed(1) : null;
    return JSON.stringify({ metric, data: trendData, overall_change_pct: overallChange, period_months: numMonths });
  } catch (e) {
    return JSON.stringify({ error: e instanceof Error ? e.message : "Trend analysis failed" });
  }
}

async function comparePeriods(supabase: any, tenantId: string, metric: string, p1Start: string, p1End: string, p2Start: string, p2End: string): Promise<string> {
  // SEC-6: Validate all date inputs
  const vp1s = validateDate(p1Start);
  const vp1e = validateDate(p1End);
  const vp2s = validateDate(p2Start);
  const vp2e = validateDate(p2End);
  const metricQueries: Record<string, (s: string, e: string) => string> = {
    revenue: (s, e) => `SELECT COALESCE(SUM(total), 0) as value, COUNT(*) as count FROM invoices WHERE tenant_id = '${tenantId}' AND status IN ('paid', 'posted') AND invoice_date >= '${s}' AND invoice_date <= '${e}'`,
    expenses: (s, e) => `SELECT COALESCE(SUM(jl.debit), 0) as value FROM journal_lines jl JOIN journal_entries je ON je.id = jl.journal_entry_id JOIN chart_of_accounts ca ON ca.id = jl.account_id WHERE je.tenant_id = '${tenantId}' AND je.status = 'posted' AND ca.account_type = 'expense' AND je.entry_date >= '${s}' AND je.entry_date <= '${e}'`,
    invoices_count: (s, e) => `SELECT COUNT(*) as value FROM invoices WHERE tenant_id = '${tenantId}' AND invoice_date >= '${s}' AND invoice_date <= '${e}'`,
    payroll_cost: (s, e) => `SELECT COALESCE(SUM(total_gross), 0) as value FROM payroll_runs WHERE tenant_id = '${tenantId}' AND status IN ('calculated', 'approved', 'paid') AND make_date(period_year, period_month, 1) >= '${s}'::date AND make_date(period_year, period_month, 1) <= '${e}'::date`,
    new_partners: (s, e) => `SELECT COUNT(*) as value FROM partners WHERE tenant_id = '${tenantId}' AND created_at >= '${s}' AND created_at <= '${e}'`,
    new_leads: (s, e) => `SELECT COUNT(*) as value FROM leads WHERE tenant_id = '${tenantId}' AND created_at >= '${s}' AND created_at <= '${e}'`,
    pipeline_value: (s, e) => `SELECT COALESCE(SUM(value), 0) as value, COUNT(*) as count FROM opportunities WHERE tenant_id = '${tenantId}' AND created_at >= '${s}' AND created_at <= '${e}'`,
  };
  const qFn = metricQueries[metric];
  if (!qFn) return JSON.stringify({ error: `Unknown metric: ${metric}` });
  try {
    const [r1, r2] = await Promise.all([
      supabase.rpc("execute_readonly_query", { query_text: qFn(vp1s, vp1e) }),
      supabase.rpc("execute_readonly_query", { query_text: qFn(vp2s, vp2e) }),
    ]);
    const v1 = Number(r1.data?.[0]?.value || 0);
    const v2 = Number(r2.data?.[0]?.value || 0);
    const delta = v2 - v1;
    const pctChange = v1 > 0 ? ((delta / v1) * 100).toFixed(1) : null;
    return JSON.stringify({ metric, period1: { start: p1Start, end: p1End, value: v1 }, period2: { start: p2Start, end: p2End, value: v2 }, delta, percent_change: pctChange, direction: delta > 0 ? "increase" : delta < 0 ? "decrease" : "unchanged" });
  } catch (e) { return JSON.stringify({ error: e instanceof Error ? e.message : "Comparison failed" }); }
}

async function whatIfScenario(supabase: any, tenantId: string, scenarioType: string, changePct: number): Promise<string> {
  try {
    const [revResult, expResult, payResult, empResult] = await Promise.all([
      supabase.rpc("execute_readonly_query", { query_text: `SELECT COALESCE(SUM(total), 0) as value FROM invoices WHERE tenant_id = '${tenantId}' AND status IN ('paid', 'posted') AND invoice_date >= (CURRENT_DATE - INTERVAL '12 months')` }),
      supabase.rpc("execute_readonly_query", { query_text: `SELECT COALESCE(SUM(jl.debit), 0) as value FROM journal_lines jl JOIN journal_entries je ON je.id = jl.journal_entry_id JOIN chart_of_accounts ca ON ca.id = jl.account_id WHERE je.tenant_id = '${tenantId}' AND je.status = 'posted' AND ca.account_type = 'expense' AND je.entry_date >= (CURRENT_DATE - INTERVAL '12 months')` }),
      supabase.rpc("execute_readonly_query", { query_text: `SELECT COALESCE(SUM(total_gross), 0) as value FROM payroll_runs WHERE tenant_id = '${tenantId}' AND status IN ('calculated', 'approved', 'paid') AND make_date(period_year, period_month, 1) >= (CURRENT_DATE - INTERVAL '12 months')` }),
      supabase.from("employees").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "active"),
    ]);
    const revenue = Number(revResult.data?.[0]?.value || 0);
    const expenses = Number(expResult.data?.[0]?.value || 0);
    const payroll = Number(payResult.data?.[0]?.value || 0);
    const headcount = empResult.count || 0;
    const profit = revenue - expenses;
    const factor = validatePositiveInt(Math.abs(changePct), 1000, 10) / 100 * (changePct < 0 ? -1 : 1);
    let projected: Record<string, any> = {};
    switch (scenarioType) {
      case "price_change":
        projected = { current_revenue: revenue, projected_revenue: revenue * (1 + factor), revenue_impact: revenue * factor, current_profit: profit, projected_profit: profit + revenue * factor, assumption: "Volume stays constant" };
        break;
      case "headcount_change": {
        const avgSalary = headcount > 0 ? payroll / headcount : 0;
        const newHeads = Math.round(headcount * factor);
        const payrollImpact = avgSalary * Math.abs(newHeads);
        projected = { current_headcount: headcount, projected_headcount: headcount + newHeads, avg_annual_salary_cost: avgSalary, payroll_impact: payrollImpact * (newHeads > 0 ? 1 : -1), current_profit: profit, projected_profit: profit - payrollImpact * (newHeads > 0 ? 1 : -1) };
        break;
      }
      case "customer_loss":
        projected = { current_revenue: revenue, revenue_at_risk: revenue * Math.abs(factor), projected_revenue: revenue * (1 - Math.abs(factor)), current_profit: profit, projected_profit: profit - revenue * Math.abs(factor) };
        break;
      case "cost_reduction":
        projected = { current_expenses: expenses, expense_reduction: expenses * Math.abs(factor), projected_expenses: expenses * (1 - Math.abs(factor)), current_profit: profit, projected_profit: profit + expenses * Math.abs(factor) };
        break;
      case "revenue_growth":
        projected = { current_revenue: revenue, projected_revenue: revenue * (1 + factor), revenue_growth: revenue * factor, current_profit: profit, projected_profit: profit + revenue * factor * 0.7, assumption: "70% margin on incremental revenue" };
        break;
    }
    return JSON.stringify({ scenario_type: scenarioType, change_percent: changePct, ...projected });
  } catch (e) { return JSON.stringify({ error: e instanceof Error ? e.message : "Scenario failed" }); }
}

async function getKpiScorecard(supabase: any, tenantId: string): Promise<string> {
  try {
    const [rev, exp, emp, inv, pipe, stock, overdue, payroll] = await Promise.all([
      supabase.rpc("execute_readonly_query", { query_text: `SELECT COALESCE(SUM(total), 0) as value FROM invoices WHERE tenant_id = '${tenantId}' AND status IN ('paid', 'posted') AND invoice_date >= (CURRENT_DATE - INTERVAL '12 months')` }),
      supabase.rpc("execute_readonly_query", { query_text: `SELECT COALESCE(SUM(jl.debit), 0) as value FROM journal_lines jl JOIN journal_entries je ON je.id = jl.journal_entry_id JOIN chart_of_accounts ca ON ca.id = jl.account_id WHERE je.tenant_id = '${tenantId}' AND je.status = 'posted' AND ca.account_type = 'expense' AND je.entry_date >= (CURRENT_DATE - INTERVAL '12 months')` }),
      supabase.from("employees").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "active"),
      supabase.rpc("execute_readonly_query", { query_text: `SELECT COALESCE(SUM(s.quantity_on_hand * COALESCE(p.purchase_price, 0)), 0) as value FROM inventory_stock s JOIN products p ON p.id = s.product_id WHERE s.tenant_id = '${tenantId}'` }),
      supabase.rpc("execute_readonly_query", { query_text: `SELECT COALESCE(SUM(value), 0) as value, COUNT(*) as count FROM opportunities WHERE tenant_id = '${tenantId}' AND stage NOT IN ('won', 'lost')` }),
      supabase.rpc("execute_readonly_query", { query_text: `SELECT COUNT(*) as value FROM inventory_stock WHERE tenant_id = '${tenantId}' AND min_stock_level > 0 AND quantity_on_hand < min_stock_level` }),
      supabase.rpc("execute_readonly_query", { query_text: `SELECT COALESCE(SUM(total), 0) as value, COUNT(*) as count FROM invoices WHERE tenant_id = '${tenantId}' AND status IN ('draft', 'sent') AND due_date < CURRENT_DATE` }),
      supabase.rpc("execute_readonly_query", { query_text: `SELECT COALESCE(total_gross, 0) as value FROM payroll_runs WHERE tenant_id = '${tenantId}' AND status IN ('calculated', 'approved', 'paid') ORDER BY period_year DESC, period_month DESC LIMIT 1` }),
    ]);
    const revenue = Number(rev.data?.[0]?.value || 0);
    const expenses = Number(exp.data?.[0]?.value || 0);
    const profit = revenue - expenses;
    const margin = revenue > 0 ? (profit / revenue * 100).toFixed(1) : "0";
    return JSON.stringify({
      revenue_12m: revenue, expenses_12m: expenses, profit_12m: profit, profit_margin: margin + "%",
      employee_count: emp.count || 0, inventory_value: Number(inv.data?.[0]?.value || 0),
      pipeline_value: Number(pipe.data?.[0]?.value || 0), pipeline_count: Number(pipe.data?.[0]?.count || 0),
      low_stock_items: Number(stock.data?.[0]?.value || 0),
      overdue_invoices_total: Number(overdue.data?.[0]?.value || 0), overdue_invoices_count: Number(overdue.data?.[0]?.count || 0),
      latest_payroll_gross: Number(payroll.data?.[0]?.value || 0),
    });
  } catch (e) { return JSON.stringify({ error: e instanceof Error ? e.message : "Scorecard failed" }); }
}

async function explainAccount(supabase: any, tenantId: string, accountCode: string): Promise<string> {
  try {
    const code = accountCode.trim().substring(0, 20);
    const isNumeric = /^\d+$/.test(code);
    
    // Find account using parameterized Supabase client queries
    let accountQuery = supabase
      .from("chart_of_accounts")
      .select("id, code, name, name_sr, account_type")
      .eq("tenant_id", tenantId)
      .limit(1);
    if (isNumeric) {
      accountQuery = accountQuery.eq("code", code);
    } else {
      accountQuery = accountQuery.or(`name.ilike.%${code.toLowerCase()}%,name_sr.ilike.%${code.toLowerCase()}%`);
    }
    const { data: accounts } = await accountQuery;
    if (!accounts || accounts.length === 0) return JSON.stringify({ error: `Account '${accountCode}' not found` });
    const account = accounts[0];

    // Use RPC for aggregation queries (these are safe - account.id is a UUID from our own query)
    const [balanceResult, transactionsResult, trendResult] = await Promise.all([
      supabase.rpc("execute_readonly_query", { query_text: `SELECT COALESCE(SUM(debit), 0) as total_debit, COALESCE(SUM(credit), 0) as total_credit, COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0) as balance FROM journal_lines jl JOIN journal_entries je ON je.id = jl.journal_entry_id WHERE jl.account_id = '${account.id}' AND je.tenant_id = '${tenantId}' AND je.status = 'posted'` }),
      supabase.rpc("execute_readonly_query", { query_text: `SELECT je.entry_date, je.entry_number, jl.description, jl.debit, jl.credit FROM journal_lines jl JOIN journal_entries je ON je.id = jl.journal_entry_id WHERE jl.account_id = '${account.id}' AND je.tenant_id = '${tenantId}' AND je.status = 'posted' ORDER BY je.entry_date DESC LIMIT 10` }),
      supabase.rpc("execute_readonly_query", { query_text: `SELECT to_char(date_trunc('month', je.entry_date), 'YYYY-MM') as month, COALESCE(SUM(jl.debit), 0) as debit, COALESCE(SUM(jl.credit), 0) as credit FROM journal_lines jl JOIN journal_entries je ON je.id = jl.journal_entry_id WHERE jl.account_id = '${account.id}' AND je.tenant_id = '${tenantId}' AND je.status = 'posted' AND je.entry_date >= (CURRENT_DATE - INTERVAL '6 months') GROUP BY 1 ORDER BY 1` }),
    ]);
    return JSON.stringify({ account: { code: account.code, name: account.name, name_sr: account.name_sr, type: account.account_type }, balance: balanceResult.data?.[0] || {}, recent_transactions: transactionsResult.data || [], monthly_trend: trendResult.data || [] });
  } catch (e) { return JSON.stringify({ error: e instanceof Error ? e.message : "Account lookup failed" }); }
}

// ── NEW TOOL IMPLEMENTATIONS ──

async function searchDocuments(supabase: any, tenantId: string, query: string, category?: string, limit: number = 10): Promise<string> {
  try {
    const safeLimit = Math.min(limit, 20);
    const searchTerm = `%${query.substring(0, 100).toLowerCase()}%`;
    let q = supabase
      .from("dms_documents")
      .select("id, name, description, file_type, created_at, document_categories(name)")
      .eq("tenant_id", tenantId)
      .or(`name.ilike.${searchTerm},description.ilike.${searchTerm}`)
      .order("created_at", { ascending: false })
      .limit(safeLimit);
    const { data, error } = await q;
    if (error) return JSON.stringify({ error: error.message });
    let results = data || [];
    if (category) {
      const catLower = category.toLowerCase();
      results = results.filter((d: any) => d.document_categories?.name?.toLowerCase().includes(catLower));
    }
    return JSON.stringify({ results, count: results.length, query });
  } catch (e) { return JSON.stringify({ error: e instanceof Error ? e.message : "Search failed" }); }
}

async function getPartnerDossier(supabase: any, tenantId: string, partnerName: string): Promise<string> {
  try {
    const searchTerm = `%${partnerName.substring(0, 100).toLowerCase()}%`;
    // Find partner using parameterized query
    const { data: partners } = await supabase
      .from("partners")
      .select("id, name, type, email, phone, pib, city, address, account_tier, dormancy_status, risk_score, credit_limit, payment_terms_days, created_at")
      .eq("tenant_id", tenantId)
      .ilike("name", searchTerm)
      .limit(1);
    if (!partners || partners.length === 0) return JSON.stringify({ error: `Partner '${partnerName}' not found` });
    const partner = partners[0];

    // Get related data in parallel using parameterized queries
    const [invoices, supplierInvoices, contacts, activities] = await Promise.all([
      supabase.from("invoices").select("invoice_number, invoice_date, due_date, status, total, currency, balance_due")
        .eq("tenant_id", tenantId).ilike("partner_name", searchTerm)
        .order("invoice_date", { ascending: false }).limit(10),
      supabase.from("supplier_invoices").select("invoice_number, invoice_date, status, total")
        .eq("tenant_id", tenantId).ilike("supplier_name", searchTerm)
        .order("invoice_date", { ascending: false }).limit(10),
      supabase.from("contacts").select("first_name, last_name, email, phone, position, companies!inner(tenant_id, name)")
        .eq("companies.tenant_id", tenantId).ilike("companies.name", searchTerm).limit(5),
      supabase.from("activities").select("type, description, created_at")
        .eq("tenant_id", tenantId).eq("partner_id", partner.id)
        .order("created_at", { ascending: false }).limit(5),
    ]);

    const allInv = invoices.data || [];
    const totalRevenue = allInv.reduce((s: number, i: any) => s + Number(i.total || 0), 0);
    const overdueInv = allInv.filter((i: any) => i.status !== 'paid' && new Date(i.due_date) < new Date());
    const totalOverdue = overdueInv.reduce((s: number, i: any) => s + Number(i.balance_due || i.total || 0), 0);

    return JSON.stringify({
      partner,
      summary: { total_revenue: totalRevenue, overdue_amount: totalOverdue, overdue_count: overdueInv.length, total_invoices: allInv.length },
      recent_invoices: allInv.slice(0, 5),
      supplier_invoices: (supplierInvoices.data || []).slice(0, 5),
      contacts: contacts.data || [],
      recent_activities: activities.data || [],
    });
  } catch (e) { return JSON.stringify({ error: e instanceof Error ? e.message : "Dossier failed" }); }
}

async function forecastCashflow(supabase: any, tenantId: string, days: number = 90): Promise<string> {
  const horizon = validatePositiveInt(days, 180, 90);
  try {
    const today = new Date().toISOString().split("T")[0];
    const futureDate = new Date(Date.now() + horizon * 86400000).toISOString().split("T")[0];

    const [bankBalance, openAR, openAP, avgMonthlyPayroll, recentInflows, recentOutflows] = await Promise.all([
      supabase.rpc("execute_readonly_query", { query_text: `SELECT COALESCE(SUM(closing_balance), 0) as value FROM bank_statements WHERE tenant_id = '${tenantId}' ORDER BY statement_date DESC LIMIT 1` }),
      supabase.rpc("execute_readonly_query", { query_text: `SELECT COALESCE(SUM(COALESCE(balance_due, total)), 0) as value, COUNT(*) as count FROM invoices WHERE tenant_id = '${tenantId}' AND status IN ('draft', 'sent') AND due_date <= '${futureDate}'` }),
      supabase.rpc("execute_readonly_query", { query_text: `SELECT COALESCE(SUM(total), 0) as value, COUNT(*) as count FROM supplier_invoices WHERE tenant_id = '${tenantId}' AND status NOT IN ('paid', 'cancelled') AND due_date <= '${futureDate}'` }),
      supabase.rpc("execute_readonly_query", { query_text: `SELECT COALESCE(AVG(total_gross), 0) as value FROM payroll_runs WHERE tenant_id = '${tenantId}' AND status IN ('calculated', 'approved', 'paid')` }),
      supabase.rpc("execute_readonly_query", { query_text: `SELECT COALESCE(SUM(amount), 0) as value FROM bank_statement_lines WHERE tenant_id = '${tenantId}' AND direction = 'credit' AND line_date >= (CURRENT_DATE - INTERVAL '3 months')` }),
      supabase.rpc("execute_readonly_query", { query_text: `SELECT COALESCE(SUM(amount), 0) as value FROM bank_statement_lines WHERE tenant_id = '${tenantId}' AND direction = 'debit' AND line_date >= (CURRENT_DATE - INTERVAL '3 months')` }),
    ]);

    const currentBalance = Number(bankBalance.data?.[0]?.value || 0);
    const expectedInflows = Number(openAR.data?.[0]?.value || 0);
    const expectedOutflows = Number(openAP.data?.[0]?.value || 0);
    const monthlyPayroll = Number(avgMonthlyPayroll.data?.[0]?.value || 0);
    const payrollInPeriod = monthlyPayroll * (horizon / 30);
    const avgMonthlyInflow = Number(recentInflows.data?.[0]?.value || 0) / 3;
    const avgMonthlyOutflow = Number(recentOutflows.data?.[0]?.value || 0) / 3;

    // Project weekly balances
    const weeks = Math.ceil(horizon / 7);
    const weeklyProjection = [];
    let runningBalance = currentBalance;
    const weeklyInflow = (expectedInflows * 0.8 + avgMonthlyInflow * (horizon / 30) * 0.2) / weeks;
    const weeklyOutflow = (expectedOutflows + payrollInPeriod) / weeks;

    for (let w = 1; w <= weeks; w++) {
      runningBalance += weeklyInflow - weeklyOutflow;
      weeklyProjection.push({
        week: w,
        date: new Date(Date.now() + w * 7 * 86400000).toISOString().split("T")[0],
        projected_balance: Math.round(runningBalance),
        inflow: Math.round(weeklyInflow),
        outflow: Math.round(weeklyOutflow),
      });
    }

    const minBalance = Math.min(...weeklyProjection.map(w => w.projected_balance));
    const shortfall = minBalance < 0;

    return JSON.stringify({
      current_balance: currentBalance,
      forecast_days: horizon,
      expected_inflows: expectedInflows,
      expected_outflows: expectedOutflows,
      payroll_estimate: payrollInPeriod,
      projected_end_balance: Math.round(runningBalance),
      minimum_projected_balance: minBalance,
      cash_shortfall_risk: shortfall,
      weekly_projection: weeklyProjection,
      assumptions: "80% AR collection rate, historical avg for non-invoiced items",
    });
  } catch (e) { return JSON.stringify({ error: e instanceof Error ? e.message : "Forecast failed" }); }
}

async function detectAnomalies(supabase: any, tenantId: string, focus: string = "all"): Promise<string> {
  const anomalies: Array<{ type: string; severity: string; description: string; data: any }> = [];
  try {
    // 1. Unusual JE amounts (> 3 stddev from mean per account)
    if (focus === "all" || focus === "accounting") {
      const { data: jeStats } = await supabase.rpc("execute_readonly_query", {
        query_text: `SELECT ca.code, ca.name, AVG(jl.debit) as avg_debit, STDDEV(jl.debit) as stddev_debit, MAX(jl.debit) as max_debit
          FROM journal_lines jl
          JOIN journal_entries je ON je.id = jl.journal_entry_id
          JOIN chart_of_accounts ca ON ca.id = jl.account_id
          WHERE je.tenant_id = '${tenantId}' AND je.status = 'posted' AND jl.debit > 0
          GROUP BY ca.code, ca.name HAVING COUNT(*) >= 5 AND STDDEV(jl.debit) > 0
          ORDER BY (MAX(jl.debit) - AVG(jl.debit)) / NULLIF(STDDEV(jl.debit), 0) DESC LIMIT 5`,
      });
      if (jeStats) {
        for (const row of jeStats) {
          const zScore = (Number(row.max_debit) - Number(row.avg_debit)) / Number(row.stddev_debit);
          if (zScore > 3) {
            anomalies.push({
              type: "unusual_je_amount",
              severity: zScore > 5 ? "critical" : "warning",
              description: `Account ${row.code} (${row.name}): max debit ${Number(row.max_debit).toFixed(0)} is ${zScore.toFixed(1)} std devs above mean of ${Number(row.avg_debit).toFixed(0)}`,
              data: { account_code: row.code, z_score: zScore.toFixed(1), max: row.max_debit, mean: row.avg_debit },
            });
          }
        }
      }

      // 2. Sequential invoice number gaps
      const { data: invoiceGaps } = await supabase.rpc("execute_readonly_query", {
        query_text: `WITH numbered AS (
          SELECT invoice_number, ROW_NUMBER() OVER (ORDER BY invoice_number) as rn
          FROM invoices WHERE tenant_id = '${tenantId}' AND invoice_number ~ '^[0-9]+$'
        )
        SELECT a.invoice_number as prev, b.invoice_number as next,
          CAST(b.invoice_number AS BIGINT) - CAST(a.invoice_number AS BIGINT) as gap
        FROM numbered a JOIN numbered b ON b.rn = a.rn + 1
        WHERE CAST(b.invoice_number AS BIGINT) - CAST(a.invoice_number AS BIGINT) > 1
        LIMIT 5`,
      });
      if (invoiceGaps && invoiceGaps.length > 0) {
        anomalies.push({
          type: "invoice_number_gap",
          severity: "warning",
          description: `Found ${invoiceGaps.length} gaps in invoice numbering sequence`,
          data: { gaps: invoiceGaps },
        });
      }
    }

    // 3. Inventory shrinkage (negative stock)
    if (focus === "all" || focus === "inventory") {
      const { data: negativeStock } = await supabase.rpc("execute_readonly_query", {
        query_text: `SELECT p.name, p.sku, s.quantity_on_hand FROM inventory_stock s JOIN products p ON p.id = s.product_id WHERE s.tenant_id = '${tenantId}' AND s.quantity_on_hand < 0 LIMIT 10`,
      });
      if (negativeStock && negativeStock.length > 0) {
        anomalies.push({
          type: "negative_stock",
          severity: "critical",
          description: `${negativeStock.length} products have negative stock quantities`,
          data: { items: negativeStock },
        });
      }
    }

    // 4. HR anomalies
    if (focus === "all" || focus === "hr") {
      const { data: salaryOutliers } = await supabase.rpc("execute_readonly_query", {
        query_text: `SELECT e.full_name, ec.gross_salary, AVG(ec.gross_salary) OVER () as avg_salary, STDDEV(ec.gross_salary) OVER () as stddev_salary
          FROM employee_contracts ec JOIN employees e ON e.id = ec.employee_id
          WHERE e.tenant_id = '${tenantId}' AND e.status = 'active' AND ec.gross_salary > 0
          ORDER BY ec.gross_salary DESC LIMIT 20`,
      });
      if (salaryOutliers && salaryOutliers.length >= 3) {
        const avg = Number(salaryOutliers[0].avg_salary);
        const std = Number(salaryOutliers[0].stddev_salary);
        if (std > 0) {
          const outliers = salaryOutliers.filter((s: any) => Math.abs(Number(s.gross_salary) - avg) / std > 2.5);
          if (outliers.length > 0) {
            anomalies.push({
              type: "salary_outlier",
              severity: "info",
              description: `${outliers.length} employee(s) have salaries >2.5 std devs from mean`,
              data: { count: outliers.length, mean: avg.toFixed(0), stddev: std.toFixed(0) },
            });
          }
        }
      }
    }

    // 5. CRM pipeline stagnation
    if (focus === "all" || focus === "crm") {
      const { data: staleOpps } = await supabase.rpc("execute_readonly_query", {
        query_text: `SELECT title, value, stage, updated_at FROM opportunities WHERE tenant_id = '${tenantId}' AND stage NOT IN ('won', 'lost') AND updated_at < (CURRENT_DATE - INTERVAL '30 days') ORDER BY value DESC LIMIT 5`,
      });
      if (staleOpps && staleOpps.length > 0) {
        const totalStale = staleOpps.reduce((s: number, o: any) => s + Number(o.value || 0), 0);
        anomalies.push({
          type: "stale_opportunities",
          severity: "warning",
          description: `${staleOpps.length} opportunities worth ${totalStale.toFixed(0)} RSD haven't been updated in 30+ days`,
          data: { count: staleOpps.length, total_value: totalStale, opportunities: staleOpps },
        });
      }
    }

    // 6. Revenue concentration
    if (focus === "all" || focus === "sales") {
      const { data: revenueByPartner } = await supabase.rpc("execute_readonly_query", {
        query_text: `SELECT partner_name, SUM(total) as total_revenue FROM invoices WHERE tenant_id = '${tenantId}' AND status IN ('paid', 'posted') AND invoice_date >= (CURRENT_DATE - INTERVAL '12 months') GROUP BY partner_name ORDER BY total_revenue DESC LIMIT 10`,
      });
      if (revenueByPartner && revenueByPartner.length >= 3) {
        const totalRev = revenueByPartner.reduce((s: number, p: any) => s + Number(p.total_revenue), 0);
        const topCustomerPct = totalRev > 0 ? (Number(revenueByPartner[0].total_revenue) / totalRev * 100) : 0;
        if (topCustomerPct > 30) {
          anomalies.push({
            type: "revenue_concentration",
            severity: topCustomerPct > 50 ? "critical" : "warning",
            description: `Top customer (${revenueByPartner[0].partner_name}) accounts for ${topCustomerPct.toFixed(0)}% of revenue`,
            data: { top_customer: revenueByPartner[0].partner_name, concentration_pct: topCustomerPct.toFixed(1), top_3: revenueByPartner.slice(0, 3) },
          });
        }
      }
    }

    // Update baselines
    if (anomalies.length > 0) {
      for (const a of anomalies.filter(a => a.data?.mean !== undefined)) {
        await supabase.from("ai_anomaly_baselines").upsert({
          tenant_id: tenantId, metric_key: a.type,
          mean_value: Number(a.data.mean || 0), stddev_value: Number(a.data.stddev || 0),
          sample_count: 1, last_updated: new Date().toISOString(),
        }, { onConflict: "tenant_id,metric_key" }).catch(() => {});
      }
    }

    return JSON.stringify({ anomalies, total: anomalies.length, focus, scanned_at: new Date().toISOString() });
  } catch (e) { return JSON.stringify({ error: e instanceof Error ? e.message : "Anomaly detection failed" }); }
}

async function generateReport(supabase: any, tenantId: string, description: string, format: string = "table"): Promise<string> {
  // The AI model will interpret the description and use query_tenant_data for the actual data
  // This tool provides the structured framework
  return JSON.stringify({
    instruction: `Generate a ${format} report based on: "${description}". Use query_tenant_data tool to fetch the necessary data, then format the results as a ${format === "table" ? "markdown table" : format === "summary" ? "brief summary with key numbers" : "detailed analysis with sections"}.`,
    tenant_id: tenantId,
    format,
    note: "Use other available tools (query_tenant_data, analyze_trend, etc.) to gather data, then compile the report.",
  });
}

async function createDraftInvoice(supabase: any, tenantId: string, userId: string, partnerName: string, items: any[], currency: string = "RSD", notes?: string): Promise<string> {
  try {
    // Find partner
    const { data: partners } = await supabase
      .from("partners").select("id, name, pib, city, address")
      .eq("tenant_id", tenantId)
      .ilike("name", `%${partnerName.substring(0, 100).toLowerCase()}%`)
      .limit(1);
    
    const partner = partners?.[0];
    if (!partner) return JSON.stringify({ error: `Partner '${partnerName}' not found. Please create the partner first.` });

    // Generate invoice number
    const { data: lastInv } = await supabase
      .from("invoices").select("invoice_number")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }).limit(1);
    
    const lastNum = lastInv?.[0]?.invoice_number;
    const nextNum = lastNum ? 
      lastNum.replace(/\d+/, (m: string) => String(Number(m) + 1).padStart(m.length, "0")) :
      `INV-${new Date().getFullYear()}-0001`;

    const subtotal = items.reduce((s: number, i: any) => s + (i.quantity * i.unit_price), 0);
    const taxAmount = items.reduce((s: number, i: any) => s + (i.quantity * i.unit_price * ((i.tax_rate || 20) / 100)), 0);
    const total = subtotal + taxAmount;

    const { data: invoice, error: invErr } = await supabase.from("invoices").insert({
      tenant_id: tenantId, 
      partner_id: partner.id,
      partner_name: partner.name,
      invoice_number: nextNum,
      invoice_date: new Date().toISOString().split("T")[0],
      due_date: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
      status: "draft",
      subtotal, tax_amount: taxAmount, total,
      currency: currency || "RSD",
      notes: notes || null,
      created_by: userId,
    }).select("id, invoice_number, total, status").single();

    if (invErr) return JSON.stringify({ error: invErr.message });

    // Insert line items
    for (const item of items) {
      await supabase.from("invoice_items").insert({
        tenant_id: tenantId,
        invoice_id: invoice.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate || 20,
        total: item.quantity * item.unit_price * (1 + (item.tax_rate || 20) / 100),
      });
    }

    return JSON.stringify({
      success: true,
      invoice: { id: invoice.id, number: invoice.invoice_number, partner: partner.name, total, currency, status: "draft" },
      message: `Draft invoice ${invoice.invoice_number} created for ${partner.name} - ${total.toFixed(2)} ${currency}. Review and send when ready.`,
    });
  } catch (e) { return JSON.stringify({ error: e instanceof Error ? e.message : "Invoice creation failed" }); }
}

async function getHrSummary(supabase: any, tenantId: string): Promise<string> {
  try {
    const today = new Date().toISOString().split("T")[0];
    const thirtyDays = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().split("T")[0];

    const [activeEmps, departments, expiring, recentHires, recentTerms, leaveBalance, payrollTrend] = await Promise.all([
      supabase.from("employees").select("id, department_id", { count: "exact" }).eq("tenant_id", tenantId).eq("status", "active"),
      supabase.rpc("execute_readonly_query", { query_text: `SELECT d.name, COUNT(e.id) as count FROM employees e JOIN departments d ON d.id = e.department_id WHERE e.tenant_id = '${tenantId}' AND e.status = 'active' GROUP BY d.name ORDER BY count DESC LIMIT 10` }),
      supabase.from("employee_contracts").select("id, employee_id, end_date", { count: "exact" }).eq("tenant_id", tenantId).lte("end_date", thirtyDays).gte("end_date", today),
      supabase.from("employees").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "active").gte("hire_date", ninetyDaysAgo),
      supabase.from("employees").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "terminated").gte("updated_at", ninetyDaysAgo),
      supabase.rpc("execute_readonly_query", { query_text: `SELECT COALESCE(AVG(used_days::float / NULLIF(entitled_days, 0) * 100), 0) as avg_utilization, COALESCE(SUM(entitled_days - used_days - pending_days), 0) as total_remaining FROM annual_leave_balances WHERE tenant_id = '${tenantId}' AND year = ${new Date().getFullYear()}` }),
      supabase.rpc("execute_readonly_query", { query_text: `SELECT to_char(make_date(period_year, period_month, 1), 'YYYY-MM') as month, SUM(total_gross) as gross, SUM(total_net) as net, COUNT(DISTINCT id) as runs FROM payroll_runs WHERE tenant_id = '${tenantId}' AND status IN ('calculated', 'approved', 'paid') GROUP BY period_year, period_month ORDER BY period_year DESC, period_month DESC LIMIT 6` }),
    ]);

    const headcount = activeEmps.count || 0;
    const turnoverRate = headcount > 0 ? ((recentTerms.count || 0) / headcount * 100 * 4).toFixed(1) : "0"; // annualized

    return JSON.stringify({
      headcount,
      department_breakdown: departments.data || [],
      contracts_expiring_30d: expiring.count || 0,
      recent_hires_90d: recentHires.count || 0,
      recent_terminations_90d: recentTerms.count || 0,
      annualized_turnover_rate: turnoverRate + "%",
      leave_utilization: {
        avg_utilization_pct: Number(leaveBalance.data?.[0]?.avg_utilization || 0).toFixed(1) + "%",
        total_remaining_days: Number(leaveBalance.data?.[0]?.total_remaining || 0),
      },
      payroll_trend: (payrollTrend.data || []).map((r: any) => ({
        month: r.month, gross: Number(r.gross), net: Number(r.net),
      })),
    });
  } catch (e) { return JSON.stringify({ error: e instanceof Error ? e.message : "HR summary failed" }); }
}



async function logAiAction(supabase: any, tenantId: string, userId: string, actionType: string, module: string, reasoning: string) {
  try {
    await supabase.from("ai_action_log").insert({
      tenant_id: tenantId, user_id: userId, action_type: actionType, module,
      model_version: "gemini-3-flash-preview", reasoning: reasoning.substring(0, 500),
    });
  } catch (e) { console.warn("Failed to log AI action:", e); }
}

function detectModule(sql: string): string {
  const upper = sql.toUpperCase();
  if (upper.includes("INVOICE")) return "accounting";
  if (upper.includes("PARTNER") || upper.includes("LEAD") || upper.includes("OPPORTUNIT")) return "crm";
  if (upper.includes("PRODUCT") || upper.includes("INVENTORY") || upper.includes("STOCK")) return "inventory";
  if (upper.includes("EMPLOYEE") || upper.includes("PAYROLL") || upper.includes("SALARY")) return "hr";
  if (upper.includes("PRODUCTION") || upper.includes("BOM")) return "production";
  return "general";
}

// ════════════════════════════════════════════
// MAIN HANDLER
// ════════════════════════════════════════════

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return createErrorResponse("Missing auth header", req, { status: 401, logPrefix: "ai-assistant auth" });
    }
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: caller }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !caller) {
      return createErrorResponse(authErr || "Invalid token", req, { status: 401, logPrefix: "ai-assistant auth" });
    }

    const { messages, tenant_id, language } = await req.json();
    if (!tenant_id) {
      return createErrorResponse("Missing tenant_id", req, { status: 400, logPrefix: "ai-assistant validation" });
    }

    // Rate limit: 20 requests per minute per user
    const rl = checkRateLimit(`ai-assistant:${caller.id}`, 20, 60_000);
    if (!rl.allowed) {
      return createErrorResponse("Rate limit exceeded", req, { status: 429, logPrefix: "ai-assistant rate-limit" });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── Security: prompt injection check ──
    const lastUserMsg = [...(messages || [])].reverse().find((m: any) => m.role === "user");
    if (lastUserMsg && detectPromptInjection(lastUserMsg.content || "")) {
      console.warn(`[SECURITY] Prompt injection attempt from user ${caller.id}`);
      await logAiAction(supabase, tenant_id, caller.id, "prompt_injection_blocked", "security", `Blocked: ${(lastUserMsg.content || "").substring(0, 100)}`);
      return createErrorResponse("Prompt injection blocked", req, { status: 400, logPrefix: "ai-assistant security" });
    }

    // ── Security: rate limiting ──
    const allowed = await checkRateLimit(supabase, caller.id, tenant_id);
    if (!allowed) {
      return createErrorResponse("Rate limit exceeded", req, { status: 429, logPrefix: "ai-assistant rate-limit" });
    }

    // ── Tenant membership check + role fetch ──
    const { data: membership } = await supabase
      .from("tenant_members").select("id, role, data_scope")
      .eq("user_id", caller.id).eq("tenant_id", tenant_id).eq("status", "active").maybeSingle();
    let memberRole = "admin";
    let dataScope = "all";
    if (!membership) {
      const { data: isSuperAdmin } = await supabase
        .from("user_roles").select("id")
        .eq("user_id", caller.id).eq("role", "super_admin").maybeSingle();
      if (!isSuperAdmin) {
        return createErrorResponse("Not a tenant member", req, { status: 403, logPrefix: "ai-assistant authz" });
      }
      memberRole = "admin";
    } else {
      memberRole = membership.role || "user";
      dataScope = membership.data_scope || "all";
    }

    const [schemaContext, invoiceStats, partnerCount, productCount, employeeCount] = await Promise.all([
      getDynamicSchema(supabase),
      supabase.from("invoices").select("status, total").eq("tenant_id", tenant_id),
      supabase.from("partners").select("id", { count: "exact", head: true }).eq("tenant_id", tenant_id),
      supabase.from("products").select("id", { count: "exact", head: true }).eq("tenant_id", tenant_id),
      supabase.from("employees").select("id", { count: "exact", head: true }).eq("tenant_id", tenant_id).eq("status", "active"),
    ]);

    const invoices = invoiceStats.data || [];
    const overdueInvoices = invoices.filter(i => i.status === "sent" || i.status === "draft");
    const totalRevenue = invoices.filter(i => i.status === "paid").reduce((s, i) => s + Number(i.total), 0);

    const contextData = `
Current tenant data summary:
- Total invoices: ${invoices.length} (Paid: ${invoices.filter(i => i.status === "paid").length}, Outstanding: ${overdueInvoices.length})
- Total revenue: ${totalRevenue.toFixed(2)} RSD
- Partners: ${partnerCount.count || 0}
- Products: ${productCount.count || 0}
- Active employees: ${employeeCount.count || 0}
- User language: ${language || "en"}`;

    // Role-specific system prompt additions
    const rolePromptSections: Record<string, string> = {
      admin: `You are helping a company ADMINISTRATOR. Provide full operational overview across all departments. All tools are available.`,
      super_admin: `You are helping a SUPER ADMIN with full system access. All tools are available across all tenants.`,
      manager: `You are helping a MANAGER. Focus on team performance, approvals, revenue/profit trends, and operational efficiency. All tools are available.`,
      accountant: `You are helping an ACCOUNTANT. Prioritize financial accuracy and compliance. Focus on:
- GL accounts, journal entries, reconciliation (use explain_account, query_tenant_data)
- Cash flow and liquidity (use forecast_cashflow)
- Invoice aging and overdue items
- Tax compliance and PDV periods
Prioritize tools: explain_account, query_tenant_data, forecast_cashflow, get_kpi_scorecard, compare_periods.
Avoid: CRM pipeline details, HR specifics unless asked.`,
      sales: `You are helping a SALES team member. Focus on revenue generation and customer relationships:
- Pipeline value, deal stages, conversion rates
- Customer profiles and history (use get_partner_dossier)
- Quote and order status
- Revenue targets and comparisons (use compare_periods, analyze_trend)
Prioritize tools: get_partner_dossier, analyze_trend, compare_periods, query_tenant_data, generate_report.
Avoid: Deep accounting details, payroll, inventory management unless asked.`,
      hr: `You are helping an HR team member. Focus on people management:
- Employee headcount, turnover, contract status
- Payroll costs and trends (use analyze_trend with payroll_cost)
- Leave requests and balances
- Compliance and deadlines
Prioritize tools: query_tenant_data, analyze_trend, compare_periods, generate_report.
Avoid: Deep financial accounting, inventory, CRM pipeline unless asked.`,
      store: `You are helping a STORE/WAREHOUSE team member. Focus on operations:
- POS transactions and daily sales
- Inventory levels and low stock alerts
- Product movements and stock counts
- Order fulfillment status
Prioritize tools: query_tenant_data, detect_anomalies, generate_report.
Avoid: Deep financial accounting, HR/payroll, CRM pipeline unless asked.`,
      user: `You are helping a general USER. Focus on providing helpful information about the data they can access. All basic tools are available.`,
    };

    const roleSection = rolePromptSections[memberRole] || rolePromptSections["user"];
    const dataScopeHint = dataScope !== "all" ? `\nIMPORTANT: This user's data scope is '${dataScope}'. Filter results accordingly when possible.` : "";

    const systemPrompt = `You are an AI assistant for a Serbian ERP system. You have access to these database tables (all scoped to tenant_id = '${tenant_id}'):
${schemaContext}

## Your Role Context
${roleSection}${dataScopeHint}

You have 14 tools available:
1. query_tenant_data: Execute read-only SQL queries. ALWAYS filter by tenant_id = '${tenant_id}'.
2. analyze_trend: Analyze metric trends over time.
3. create_reminder: Create notifications/reminders.
4. compare_periods: Compare metrics between time periods.
5. what_if_scenario: Project business impact of changes.
6. get_kpi_scorecard: Comprehensive KPI dashboard.
7. explain_account: Deep dive into GL accounts.
8. search_documents: Search DMS documents by name/content/tags.
9. get_partner_dossier: Complete customer/supplier profile with invoices, contacts, risk.
10. forecast_cashflow: 90-day cash flow projection with weekly breakdown.
11. detect_anomalies: On-demand anomaly scan (unusual transactions, patterns, risks).
12. generate_report: Create ad-hoc reports from natural language descriptions.
13. create_draft_invoice: Create a draft invoice from natural language (partner name + items). Always confirm with user before creating.
14. get_hr_summary: Comprehensive HR overview with headcount, turnover, contracts, leave, payroll trends.

Rules:
1. ONLY SELECT statements in queries, always filter by tenant_id = '${tenant_id}'
2. Use specialized tools before falling back to raw SQL queries
3. For partner questions, use get_partner_dossier
4. For cash/liquidity questions, use forecast_cashflow
5. For "anything unusual?" questions, use detect_anomalies
6. For document search, use search_documents
7. For report requests, use generate_report then query_tenant_data for data
8. For invoice creation requests, use create_draft_invoice (always creates as DRAFT for user review)
9. For HR overview questions, use get_hr_summary
10. Format currency values with 2 decimal places

${contextData}

Respond in ${language === "sr" ? "Serbian (Latin script)" : "English"}. Use markdown formatting.`;

    let conversationMessages: any[] = [{ role: "system", content: systemPrompt }, ...messages];
    const ALL_TOOLS = [
      QUERY_TOOL, ANALYZE_TREND_TOOL, CREATE_REMINDER_TOOL, COMPARE_PERIODS_TOOL,
      WHAT_IF_TOOL, KPI_SCORECARD_TOOL, EXPLAIN_ACCOUNT_TOOL,
      SEARCH_DOCUMENTS_TOOL, GET_PARTNER_DOSSIER_TOOL, FORECAST_CASHFLOW_TOOL,
      DETECT_ANOMALIES_TOOL, GENERATE_REPORT_TOOL,
      CREATE_DRAFT_INVOICE_TOOL, GET_HR_SUMMARY_TOOL,
    ];
    const MAX_TOOL_ROUNDS = 6;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages: conversationMessages, tools: ALL_TOOLS, tool_choice: "auto", stream: false }),
      });

      if (!response.ok) {
        if (response.status === 429) return createErrorResponse("Upstream rate limit", req, { status: 429, logPrefix: "ai-assistant gateway" });
        if (response.status === 402) return createErrorResponse("Payment required", req, { status: 402, logPrefix: "ai-assistant gateway" });
        const text = await response.text();
        console.error("AI gateway error:", response.status, text);
        return createErrorResponse("AI gateway error", req, { status: 500, logPrefix: "ai-assistant gateway" });
      }

      const aiData = await response.json();
      const usage = aiData.usage;

      // Track tokens
      if (usage) {
        await trackTokens(supabase, tenant_id, caller.id, "ai-assistant", "google/gemini-3-flash-preview", usage);
      }

      const msg = aiData.choices?.[0]?.message;
      if (!msg) break;

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        conversationMessages.push(msg);
        for (const toolCall of msg.tool_calls) {
          let result: string;
          const fnName = toolCall.function?.name;

          try {
            const args = JSON.parse(toolCall.function.arguments || "{}");

            switch (fnName) {
              case "query_tenant_data": {
                const safeSql = validateSql(args.sql, tenant_id);
                console.log(`[AI SQL] ${args.explanation}: ${safeSql}`);
                const { data: queryResult, error: queryError } = await supabase.rpc("execute_readonly_query", { query_text: safeSql });
                result = queryError ? JSON.stringify({ error: queryError.message }) : JSON.stringify(queryResult || []);
                await logAiAction(supabase, tenant_id, caller.id, "sql_query", detectModule(safeSql), `Query: ${args.explanation}`);
                break;
              }
              case "analyze_trend":
                result = await analyzeTrend(supabase, tenant_id, args.metric, args.months);
                await logAiAction(supabase, tenant_id, caller.id, "trend_analysis", args.metric, `Trend: ${args.metric}`);
                break;
              case "create_reminder": {
                const { error: notifErr } = await supabase.from("notifications").insert({
                  tenant_id, user_id: caller.id, title: args.title?.substring(0, 100) || "AI Reminder",
                  message: args.message || "", type: "reminder", read: false,
                });
                result = notifErr ? JSON.stringify({ error: notifErr.message }) : JSON.stringify({ success: true });
                await logAiAction(supabase, tenant_id, caller.id, "create_reminder", "notifications", `Reminder: ${args.title}`);
                break;
              }
              case "compare_periods":
                result = await comparePeriods(supabase, tenant_id, args.metric, args.period1_start, args.period1_end, args.period2_start, args.period2_end);
                await logAiAction(supabase, tenant_id, caller.id, "period_comparison", args.metric, `Compare periods`);
                break;
              case "what_if_scenario":
                result = await whatIfScenario(supabase, tenant_id, args.scenario_type, args.change_percent);
                await logAiAction(supabase, tenant_id, caller.id, "what_if", "analytics", `Scenario: ${args.description}`);
                break;
              case "get_kpi_scorecard":
                result = await getKpiScorecard(supabase, tenant_id);
                await logAiAction(supabase, tenant_id, caller.id, "kpi_scorecard", "analytics", "KPI scorecard");
                break;
              case "explain_account":
                result = await explainAccount(supabase, tenant_id, args.account_code);
                await logAiAction(supabase, tenant_id, caller.id, "explain_account", "accounting", `Account: ${args.account_code}`);
                break;
              case "search_documents":
                result = await searchDocuments(supabase, tenant_id, args.query, args.category, args.limit);
                await logAiAction(supabase, tenant_id, caller.id, "search_documents", "documents", `Search: ${args.query}`);
                break;
              case "get_partner_dossier":
                result = await getPartnerDossier(supabase, tenant_id, args.partner_name);
                await logAiAction(supabase, tenant_id, caller.id, "partner_dossier", "crm", `Dossier: ${args.partner_name}`);
                break;
              case "forecast_cashflow":
                result = await forecastCashflow(supabase, tenant_id, args.days);
                await logAiAction(supabase, tenant_id, caller.id, "cashflow_forecast", "analytics", `Forecast: ${args.days || 90} days`);
                break;
              case "detect_anomalies":
                result = await detectAnomalies(supabase, tenant_id, args.focus);
                await logAiAction(supabase, tenant_id, caller.id, "anomaly_detection", args.focus || "all", `Anomaly scan`);
                break;
              case "generate_report":
                result = await generateReport(supabase, tenant_id, args.report_description, args.format);
                await logAiAction(supabase, tenant_id, caller.id, "generate_report", "analytics", `Report: ${args.report_description?.substring(0, 80)}`);
                break;
              case "create_draft_invoice":
                result = await createDraftInvoice(supabase, tenant_id, caller.id, args.partner_name, args.items, args.currency, args.notes);
                await logAiAction(supabase, tenant_id, caller.id, "create_draft_invoice", "accounting", `Draft invoice for: ${args.partner_name}`);
                break;
              case "get_hr_summary":
                result = await getHrSummary(supabase, tenant_id);
                await logAiAction(supabase, tenant_id, caller.id, "hr_summary", "hr", "HR summary");
                break;
              default:
                result = JSON.stringify({ error: `Unknown tool: ${fnName}` });
            }
          } catch (e) {
            result = JSON.stringify({ error: e instanceof Error ? e.message : "Tool execution failed" });
          }

          conversationMessages.push({ role: "tool", tool_call_id: toolCall.id, content: result });
        }
        continue;
      }

      // Final response — stream it
      const finalStreamPayload = { model: "google/gemini-3-flash-preview", messages: conversationMessages, stream: true };
      const streamResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(finalStreamPayload),
      });

      if (!streamResponse.ok || !streamResponse.body) {
        const fallbackContent = msg.content || "";
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: fallbackContent } }] })}\n\n`));
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          },
        });
        return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
      }

      return new Response(streamResponse.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
    }

    // Exhausted rounds
    const finalPayload = { model: "google/gemini-3-flash-preview", messages: conversationMessages, stream: true };
    const finalResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(finalPayload),
    });

    if (!finalResponse.ok || !finalResponse.body) {
      return createErrorResponse("Final response failed", req, { status: 500, logPrefix: "ai-assistant final" });
    }

    return new Response(finalResponse.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });

  } catch (e: any) {
    return createErrorResponse(e, req, { logPrefix: "ai-assistant error" });
  }
});
