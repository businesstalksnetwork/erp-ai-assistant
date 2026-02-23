import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Dynamic schema cache (1 hour TTL)
let cachedSchema: string | null = null;
let schemaCacheTime = 0;
const SCHEMA_CACHE_TTL = 60 * 60 * 1000;

async function getDynamicSchema(supabase: any): Promise<string> {
  if (cachedSchema && Date.now() - schemaCacheTime < SCHEMA_CACHE_TTL) {
    return cachedSchema;
  }
  try {
    const { data: columns } = await supabase.rpc("execute_readonly_query", {
      query_text: `
        SELECT table_name, string_agg(column_name || ' (' || data_type || COALESCE(' ' || character_maximum_length::text, '') || ')', ', ' ORDER BY ordinal_position) as cols
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name NOT LIKE 'pg_%'
          AND table_name NOT IN ('schema_migrations', 'supabase_migrations')
        GROUP BY table_name
        ORDER BY table_name
        LIMIT 200
      `,
    });
    if (columns && Array.isArray(columns) && columns.length > 0) {
      const schemaStr = columns.map((t: any) => `- ${t.table_name}: ${t.cols}`).join("\n");
      cachedSchema = schemaStr;
      schemaCacheTime = Date.now();
      return schemaStr;
    }
  } catch (e) {
    console.warn("Failed to fetch dynamic schema, using fallback:", e);
  }
  return `- invoices: invoice_number, invoice_date, due_date, partner_name, status, subtotal, tax_amount, total, currency
- journal_entries: entry_number, entry_date, description, status, reference
- journal_lines: journal_entry_id, account_id, debit, credit, description
- chart_of_accounts: code, name, name_sr, account_type
- partners: name, type, email, phone, pib, city, account_tier, dormancy_status
- products: name, sku, unit_of_measure, purchase_price, sale_price, barcode
- inventory_stock: product_id, warehouse_id, quantity_on_hand, quantity_reserved, min_stock_level
- employees: full_name, position, email, status, department_id
- employee_contracts: employee_id, gross_salary, net_salary, contract_type
- payroll_runs: period_month, period_year, status, total_gross, total_net
- opportunities: title, value, probability, stage
- sales_orders: order_number, partner_name, status, total
- supplier_invoices: invoice_number, supplier_name, status, total
- production_orders: order_number, status, quantity, planned_start, planned_end, priority`;
}

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
      required: ["sql", "explanation"],
      additionalProperties: false,
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
      required: ["metric"],
      additionalProperties: false,
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
      required: ["title", "message"],
      additionalProperties: false,
    },
  },
};

const COMPARE_PERIODS_TOOL = {
  type: "function" as const,
  function: {
    name: "compare_periods",
    description: "Compare a financial metric between two time periods. Use for questions like 'Compare Q1 vs Q2 revenue' or 'How did January compare to February expenses?'",
    parameters: {
      type: "object",
      properties: {
        metric: { type: "string", enum: ["revenue", "expenses", "invoices_count", "payroll_cost", "new_partners", "new_leads", "pipeline_value"], description: "Metric to compare" },
        period1_start: { type: "string", description: "Start date of period 1 (YYYY-MM-DD)" },
        period1_end: { type: "string", description: "End date of period 1 (YYYY-MM-DD)" },
        period2_start: { type: "string", description: "Start date of period 2 (YYYY-MM-DD)" },
        period2_end: { type: "string", description: "End date of period 2 (YYYY-MM-DD)" },
      },
      required: ["metric", "period1_start", "period1_end", "period2_start", "period2_end"],
      additionalProperties: false,
    },
  },
};

const WHAT_IF_TOOL = {
  type: "function" as const,
  function: {
    name: "what_if_scenario",
    description: "Project the impact of a business change. E.g. 'What if we increase prices by 10%?', 'What if we hire 3 more people?', 'What if a key customer stops buying?'",
    parameters: {
      type: "object",
      properties: {
        scenario_type: { type: "string", enum: ["price_change", "headcount_change", "customer_loss", "cost_reduction", "revenue_growth"], description: "Type of scenario" },
        change_percent: { type: "number", description: "Percentage change (e.g. 10 for +10%, -15 for -15%)" },
        description: { type: "string", description: "Natural language description of the scenario" },
      },
      required: ["scenario_type", "change_percent", "description"],
      additionalProperties: false,
    },
  },
};

const KPI_SCORECARD_TOOL = {
  type: "function" as const,
  function: {
    name: "get_kpi_scorecard",
    description: "Get a comprehensive KPI dashboard in one call. Returns revenue, expenses, profit margin, DSO, current ratio, employee count, inventory value, pipeline value. Use when user asks for 'overview', 'dashboard', 'how are we doing', 'company health'.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
};

const EXPLAIN_ACCOUNT_TOOL = {
  type: "function" as const,
  function: {
    name: "explain_account",
    description: "Deep dive into a specific GL account. Returns current balance, last 10 transactions, and 6-month trend. Use when user asks about a specific account like 'Explain account 5000' or 'What's in revenue account?'",
    parameters: {
      type: "object",
      properties: {
        account_code: { type: "string", description: "Account code (e.g. '5000') or keyword to search (e.g. 'revenue')" },
      },
      required: ["account_code"],
      additionalProperties: false,
    },
  },
};

function validateSql(sql: string, tenantId: string): string {
  const trimmed = sql.trim().replace(/;+$/, "");
  const upper = trimmed.toUpperCase();
  const forbidden = ["INSERT ", "UPDATE ", "DELETE ", "DROP ", "ALTER ", "CREATE ", "TRUNCATE ", "GRANT ", "REVOKE ", "EXECUTE ", "EXEC "];
  for (const kw of forbidden) {
    if (upper.includes(kw)) throw new Error(`Forbidden SQL keyword: ${kw.trim()}`);
  }
  if (!upper.startsWith("SELECT")) throw new Error("Only SELECT queries are allowed");
  const final = trimmed.replace(/'\{TENANT_ID\}'/g, `'${tenantId}'`);
  if (!upper.includes("LIMIT")) return final + " LIMIT 50";
  return final;
}

async function analyzeTrend(supabase: any, tenantId: string, metric: string, months: number = 6): Promise<string> {
  const numMonths = Math.min(Math.max(months || 6, 2), 12);
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
  const metricQueries: Record<string, (start: string, end: string) => string> = {
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
      supabase.rpc("execute_readonly_query", { query_text: qFn(p1Start, p1End) }),
      supabase.rpc("execute_readonly_query", { query_text: qFn(p2Start, p2End) }),
    ]);
    const v1 = Number(r1.data?.[0]?.value || 0);
    const v2 = Number(r2.data?.[0]?.value || 0);
    const delta = v2 - v1;
    const pctChange = v1 > 0 ? ((delta / v1) * 100).toFixed(1) : null;
    return JSON.stringify({
      metric,
      period1: { start: p1Start, end: p1End, value: v1 },
      period2: { start: p2Start, end: p2End, value: v2 },
      delta,
      percent_change: pctChange,
      direction: delta > 0 ? "increase" : delta < 0 ? "decrease" : "unchanged",
    });
  } catch (e) {
    return JSON.stringify({ error: e instanceof Error ? e.message : "Comparison failed" });
  }
}

async function whatIfScenario(supabase: any, tenantId: string, scenarioType: string, changePct: number): Promise<string> {
  try {
    // Get current actuals
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
    const factor = changePct / 100;

    let projected: Record<string, any> = {};

    switch (scenarioType) {
      case "price_change":
        projected = {
          current_revenue: revenue, projected_revenue: revenue * (1 + factor),
          revenue_impact: revenue * factor, current_profit: profit,
          projected_profit: profit + revenue * factor,
          assumption: "Volume stays constant, only price changes",
        };
        break;
      case "headcount_change": {
        const avgSalary = headcount > 0 ? payroll / headcount : 0;
        const newHeads = Math.round(headcount * factor);
        const payrollImpact = avgSalary * Math.abs(newHeads);
        projected = {
          current_headcount: headcount, projected_headcount: headcount + newHeads,
          avg_annual_salary_cost: avgSalary, payroll_impact: payrollImpact * (newHeads > 0 ? 1 : -1),
          current_profit: profit, projected_profit: profit - payrollImpact * (newHeads > 0 ? 1 : -1),
          assumption: "Using average salary cost per employee",
        };
        break;
      }
      case "customer_loss":
        projected = {
          current_revenue: revenue, revenue_at_risk: revenue * Math.abs(factor),
          projected_revenue: revenue * (1 - Math.abs(factor)),
          current_profit: profit, projected_profit: profit - revenue * Math.abs(factor),
          assumption: "Proportional revenue loss",
        };
        break;
      case "cost_reduction":
        projected = {
          current_expenses: expenses, expense_reduction: expenses * Math.abs(factor),
          projected_expenses: expenses * (1 - Math.abs(factor)),
          current_profit: profit, projected_profit: profit + expenses * Math.abs(factor),
        };
        break;
      case "revenue_growth":
        projected = {
          current_revenue: revenue, projected_revenue: revenue * (1 + factor),
          revenue_growth: revenue * factor, current_profit: profit,
          projected_profit: profit + revenue * factor * 0.7, // assume 70% margin on incremental
          assumption: "70% margin on incremental revenue",
        };
        break;
    }

    return JSON.stringify({ scenario_type: scenarioType, change_percent: changePct, ...projected });
  } catch (e) {
    return JSON.stringify({ error: e instanceof Error ? e.message : "Scenario failed" });
  }
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
      revenue_12m: revenue,
      expenses_12m: expenses,
      profit_12m: profit,
      profit_margin: margin + "%",
      employee_count: emp.count || 0,
      inventory_value: Number(inv.data?.[0]?.value || 0),
      pipeline_value: Number(pipe.data?.[0]?.value || 0),
      pipeline_count: Number(pipe.data?.[0]?.count || 0),
      low_stock_items: Number(stock.data?.[0]?.value || 0),
      overdue_invoices_total: Number(overdue.data?.[0]?.value || 0),
      overdue_invoices_count: Number(overdue.data?.[0]?.count || 0),
      latest_payroll_gross: Number(payroll.data?.[0]?.value || 0),
    });
  } catch (e) {
    return JSON.stringify({ error: e instanceof Error ? e.message : "Scorecard failed" });
  }
}

async function explainAccount(supabase: any, tenantId: string, accountCode: string): Promise<string> {
  try {
    // Find account
    const isNumeric = /^\d+$/.test(accountCode.trim());
    let accountQuery: string;
    if (isNumeric) {
      accountQuery = `SELECT id, code, name, name_sr, account_type FROM chart_of_accounts WHERE tenant_id = '${tenantId}' AND code = '${accountCode.trim()}' LIMIT 1`;
    } else {
      accountQuery = `SELECT id, code, name, name_sr, account_type FROM chart_of_accounts WHERE tenant_id = '${tenantId}' AND (LOWER(name) LIKE '%${accountCode.toLowerCase()}%' OR LOWER(name_sr) LIKE '%${accountCode.toLowerCase()}%') LIMIT 1`;
    }
    const { data: accounts } = await supabase.rpc("execute_readonly_query", { query_text: accountQuery });
    if (!accounts || accounts.length === 0) return JSON.stringify({ error: `Account '${accountCode}' not found` });

    const account = accounts[0];

    // Get balance and recent transactions in parallel
    const [balanceResult, transactionsResult, trendResult] = await Promise.all([
      supabase.rpc("execute_readonly_query", { query_text: `SELECT COALESCE(SUM(debit), 0) as total_debit, COALESCE(SUM(credit), 0) as total_credit, COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0) as balance FROM journal_lines jl JOIN journal_entries je ON je.id = jl.journal_entry_id WHERE jl.account_id = '${account.id}' AND je.tenant_id = '${tenantId}' AND je.status = 'posted'` }),
      supabase.rpc("execute_readonly_query", { query_text: `SELECT je.entry_date, je.entry_number, jl.description, jl.debit, jl.credit FROM journal_lines jl JOIN journal_entries je ON je.id = jl.journal_entry_id WHERE jl.account_id = '${account.id}' AND je.tenant_id = '${tenantId}' AND je.status = 'posted' ORDER BY je.entry_date DESC LIMIT 10` }),
      supabase.rpc("execute_readonly_query", { query_text: `SELECT to_char(date_trunc('month', je.entry_date), 'YYYY-MM') as month, COALESCE(SUM(jl.debit), 0) as debit, COALESCE(SUM(jl.credit), 0) as credit FROM journal_lines jl JOIN journal_entries je ON je.id = jl.journal_entry_id WHERE jl.account_id = '${account.id}' AND je.tenant_id = '${tenantId}' AND je.status = 'posted' AND je.entry_date >= (CURRENT_DATE - INTERVAL '6 months') GROUP BY 1 ORDER BY 1` }),
    ]);

    return JSON.stringify({
      account: { code: account.code, name: account.name, name_sr: account.name_sr, type: account.account_type },
      balance: balanceResult.data?.[0] || {},
      recent_transactions: transactionsResult.data || [],
      monthly_trend: trendResult.data || [],
    });
  } catch (e) {
    return JSON.stringify({ error: e instanceof Error ? e.message : "Account lookup failed" });
  }
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: caller }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { messages, tenant_id, language } = await req.json();
    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: membership } = await supabase
      .from("tenant_members").select("id")
      .eq("user_id", caller.id).eq("tenant_id", tenant_id).eq("status", "active").maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
- Total revenue from paid invoices: ${totalRevenue.toFixed(2)} RSD
- Partners: ${partnerCount.count || 0}
- Products: ${productCount.count || 0}
- Active employees: ${employeeCount.count || 0}
- User language preference: ${language || "en"}`;

    const systemPrompt = `You are an AI assistant for a Serbian ERP system. You have access to these database tables (all scoped to tenant_id = '${tenant_id}'):
${schemaContext}

You have 7 tools available:
1. query_tenant_data: Execute read-only SQL queries. ALWAYS filter by tenant_id = '${tenant_id}'. Only SELECT.
2. analyze_trend: Analyze a metric's trend over time (revenue, expenses, etc.).
3. create_reminder: Create reminders/notifications for the user.
4. compare_periods: Compare a metric between two time periods (e.g. Q1 vs Q2).
5. what_if_scenario: Project business impact of changes (price changes, hiring, customer loss).
6. get_kpi_scorecard: Get a comprehensive KPI dashboard in one call.
7. explain_account: Deep dive into a specific GL account (balance, transactions, trend).

Rules:
1. ONLY SELECT statements in queries
2. Always filter by tenant_id = '${tenant_id}'
3. Use aggregate functions when summarizing
4. Limit results to 50 rows max
5. Format currency values with 2 decimal places
6. Use analyze_trend for trend questions instead of manual SQL
7. Use compare_periods when asked to compare time periods
8. Use what_if_scenario for hypothetical business questions
9. Use get_kpi_scorecard for general overview/health questions
10. Use explain_account when asked about specific accounts

${contextData}

Respond in ${language === "sr" ? "Serbian (Latin script)" : "English"}. Use markdown formatting for tables and lists.`;

    let conversationMessages: any[] = [{ role: "system", content: systemPrompt }, ...messages];
    const ALL_TOOLS = [QUERY_TOOL, ANALYZE_TREND_TOOL, CREATE_REMINDER_TOOL, COMPARE_PERIODS_TOOL, WHAT_IF_TOOL, KPI_SCORECARD_TOOL, EXPLAIN_ACCOUNT_TOOL];
    const MAX_TOOL_ROUNDS = 5;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages: conversationMessages, tools: ALL_TOOLS, tool_choice: "auto", stream: false }),
      });

      if (!response.ok) {
        if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (response.status === 402) return new Response(JSON.stringify({ error: "Payment required." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const text = await response.text();
        console.error("AI gateway error:", response.status, text);
        return new Response(JSON.stringify({ error: "AI service unavailable" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const aiData = await response.json();
      const msg = aiData.choices?.[0]?.message;
      if (!msg) break;

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        conversationMessages.push(msg);
        for (const toolCall of msg.tool_calls) {
          let result: string;
          const fnName = toolCall.function?.name;

          if (fnName === "query_tenant_data") {
            try {
              const args = JSON.parse(toolCall.function.arguments);
              const safeSql = validateSql(args.sql, tenant_id);
              console.log(`[AI SQL] ${args.explanation}: ${safeSql}`);
              const { data: queryResult, error: queryError } = await supabase.rpc("execute_readonly_query", { query_text: safeSql });
              result = queryError ? JSON.stringify({ error: queryError.message }) : JSON.stringify(queryResult || []);
              await logAiAction(supabase, tenant_id, caller.id, "sql_query", detectModule(safeSql), `Query: ${args.explanation}`);
            } catch (e) { result = JSON.stringify({ error: e instanceof Error ? e.message : "Query failed" }); }
          } else if (fnName === "analyze_trend") {
            try {
              const args = JSON.parse(toolCall.function.arguments);
              result = await analyzeTrend(supabase, tenant_id, args.metric, args.months);
              await logAiAction(supabase, tenant_id, caller.id, "trend_analysis", args.metric, `Trend: ${args.metric}`);
            } catch (e) { result = JSON.stringify({ error: e instanceof Error ? e.message : "Trend analysis failed" }); }
          } else if (fnName === "create_reminder") {
            try {
              const args = JSON.parse(toolCall.function.arguments);
              const { error: notifErr } = await supabase.from("notifications").insert({
                tenant_id, user_id: caller.id, title: args.title?.substring(0, 100) || "AI Reminder",
                message: args.message || "", type: "reminder", read: false,
              });
              result = notifErr ? JSON.stringify({ error: notifErr.message }) : JSON.stringify({ success: true });
              await logAiAction(supabase, tenant_id, caller.id, "create_reminder", "notifications", `Reminder: ${args.title}`);
            } catch (e) { result = JSON.stringify({ error: e instanceof Error ? e.message : "Failed" }); }
          } else if (fnName === "compare_periods") {
            try {
              const args = JSON.parse(toolCall.function.arguments);
              result = await comparePeriods(supabase, tenant_id, args.metric, args.period1_start, args.period1_end, args.period2_start, args.period2_end);
              await logAiAction(supabase, tenant_id, caller.id, "period_comparison", args.metric, `Compare ${args.period1_start}..${args.period1_end} vs ${args.period2_start}..${args.period2_end}`);
            } catch (e) { result = JSON.stringify({ error: e instanceof Error ? e.message : "Comparison failed" }); }
          } else if (fnName === "what_if_scenario") {
            try {
              const args = JSON.parse(toolCall.function.arguments);
              result = await whatIfScenario(supabase, tenant_id, args.scenario_type, args.change_percent);
              await logAiAction(supabase, tenant_id, caller.id, "what_if", "analytics", `Scenario: ${args.description}`);
            } catch (e) { result = JSON.stringify({ error: e instanceof Error ? e.message : "Scenario failed" }); }
          } else if (fnName === "get_kpi_scorecard") {
            try {
              result = await getKpiScorecard(supabase, tenant_id);
              await logAiAction(supabase, tenant_id, caller.id, "kpi_scorecard", "analytics", "KPI scorecard requested");
            } catch (e) { result = JSON.stringify({ error: e instanceof Error ? e.message : "Scorecard failed" }); }
          } else if (fnName === "explain_account") {
            try {
              const args = JSON.parse(toolCall.function.arguments);
              result = await explainAccount(supabase, tenant_id, args.account_code);
              await logAiAction(supabase, tenant_id, caller.id, "explain_account", "accounting", `Account: ${args.account_code}`);
            } catch (e) { result = JSON.stringify({ error: e instanceof Error ? e.message : "Account lookup failed" }); }
          } else {
            result = JSON.stringify({ error: `Unknown tool: ${fnName}` });
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
      return new Response(JSON.stringify({ error: "AI service unavailable" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(finalResponse.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (e) {
    console.error("ai-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
