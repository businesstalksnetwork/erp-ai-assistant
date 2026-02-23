import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Dynamic schema cache (1 hour TTL)
let cachedSchema: string | null = null;
let schemaCacheTime = 0;
const SCHEMA_CACHE_TTL = 60 * 60 * 1000; // 1 hour

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
      const schemaStr = columns
        .map((t: any) => `- ${t.table_name}: ${t.cols}`)
        .join("\n");
      cachedSchema = schemaStr;
      schemaCacheTime = Date.now();
      return schemaStr;
    }
  } catch (e) {
    console.warn("Failed to fetch dynamic schema, using fallback:", e);
  }

  // Fallback hardcoded schema
  return `- invoices: invoice_number, invoice_date, due_date, partner_name, status, subtotal, tax_amount, total, currency
- invoice_lines: invoice_id, description, quantity, unit_price, line_total, tax_amount
- journal_entries: entry_number, entry_date, description, status, reference
- journal_lines: journal_entry_id, account_id, debit, credit, description
- chart_of_accounts: code, name, name_sr, account_type
- partners: name, type, email, phone, pib, city, account_tier, dormancy_status
- products: name, sku, unit_of_measure, purchase_price, sale_price, barcode
- inventory_stock: product_id, warehouse_id, quantity_on_hand, quantity_reserved, min_stock_level
- employees: full_name, position, email, status, department_id
- employee_contracts: employee_id, gross_salary, net_salary, contract_type
- payroll_runs: period_month, period_year, status, total_gross, total_net
- payroll_items: payroll_run_id, employee_id, gross_salary, net_salary, income_tax
- purchase_orders: order_number, supplier_name, status, total
- fixed_assets: name, acquisition_date, acquisition_cost, status, depreciation_method
- leads: name, company, status, source
- opportunities: title, value, probability, stage
- sales_orders: order_number, partner_name, status, total
- warehouses: name, code, location
- supplier_invoices: invoice_number, supplier_name, status, total
- production_orders: order_number, status, quantity, planned_start, planned_end, priority
- production_scenarios: name, scenario_type, params, result, status`;
}

const QUERY_TOOL = {
  type: "function" as const,
  function: {
    name: "query_tenant_data",
    description: "Execute a read-only SQL query against the tenant's ERP database. Only SELECT statements are allowed. Always filter by tenant_id.",
    parameters: {
      type: "object",
      properties: {
        sql: {
          type: "string",
          description: "A SELECT SQL query. Must include WHERE tenant_id = '{TENANT_ID}'. Max 50 rows.",
        },
        explanation: {
          type: "string",
          description: "Brief explanation of what this query retrieves.",
        },
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
    description: "Analyze a metric's trend over time. Calculates month-over-month and year-over-year changes. Use for questions like 'what's the revenue trend?' or 'how are expenses changing?'",
    parameters: {
      type: "object",
      properties: {
        metric: {
          type: "string",
          enum: ["revenue", "expenses", "invoices_count", "payroll_cost", "inventory_value", "new_partners", "new_leads"],
          description: "The metric to analyze.",
        },
        months: {
          type: "number",
          description: "Number of months to analyze (default 6, max 12).",
        },
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
    description: "Create a notification/reminder for the user about something important. Use when the user asks to be reminded about something or when you flag an issue worth tracking.",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Short title for the reminder (max 100 chars).",
        },
        message: {
          type: "string",
          description: "Detailed message for the reminder.",
        },
      },
      required: ["title", "message"],
      additionalProperties: false,
    },
  },
};

/** Validate and sanitize SQL — only allow SELECT */
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

/** Analyze trend for a given metric */
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

    // Calculate MoM changes
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

/** Log AI action to audit trail */
async function logAiAction(supabase: any, tenantId: string, userId: string, actionType: string, module: string, reasoning: string) {
  try {
    await supabase.from("ai_action_log").insert({
      tenant_id: tenantId,
      user_id: userId,
      action_type: actionType,
      module,
      model_version: "gemini-3-flash-preview",
      reasoning: reasoning.substring(0, 500),
    });
  } catch (e) {
    console.warn("Failed to log AI action:", e);
  }
}

/** Detect module from SQL query */
function detectModule(sql: string): string {
  const upper = sql.toUpperCase();
  if (upper.includes("INVOICE")) return "accounting";
  if (upper.includes("PARTNER") || upper.includes("LEAD") || upper.includes("OPPORTUNIT")) return "crm";
  if (upper.includes("PRODUCT") || upper.includes("INVENTORY") || upper.includes("STOCK")) return "inventory";
  if (upper.includes("EMPLOYEE") || upper.includes("PAYROLL") || upper.includes("SALARY")) return "hr";
  if (upper.includes("PRODUCTION") || upper.includes("BOM")) return "production";
  if (upper.includes("WAREHOUSE") || upper.includes("WMS")) return "wms";
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
      return new Response(JSON.stringify({ error: "tenant_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify tenant membership
    const { data: membership } = await supabase
      .from("tenant_members").select("id")
      .eq("user_id", caller.id).eq("tenant_id", tenant_id).eq("status", "active").maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: "Forbidden: not a member of this tenant" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get dynamic schema + quick stats in parallel
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

You have 3 tools available:
1. query_tenant_data: Execute read-only SQL queries. ALWAYS filter by tenant_id = '${tenant_id}'. Only SELECT.
2. analyze_trend: Analyze a metric's trend over time (revenue, expenses, etc.). Use for trend questions.
3. create_reminder: Create reminders/notifications for the user.

Rules:
1. ONLY SELECT statements in queries — never INSERT/UPDATE/DELETE
2. Always filter by tenant_id = '${tenant_id}'
3. Use aggregate functions when summarizing
4. Limit results to 50 rows max
5. Format currency values with 2 decimal places
6. Use analyze_trend for trend questions instead of manual SQL

${contextData}

Respond in ${language === "sr" ? "Serbian (Latin script)" : "English"}. Use markdown formatting for tables and lists.`;

    // Tool-calling loop: up to 5 iterations
    let conversationMessages: any[] = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];
    const MAX_TOOL_ROUNDS = 5;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const aiPayload: any = {
        model: "google/gemini-3-flash-preview",
        messages: conversationMessages,
        tools: [QUERY_TOOL, ANALYZE_TREND_TOOL, CREATE_REMINDER_TOOL],
        tool_choice: "auto",
        stream: false,
      };

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(aiPayload),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Payment required. Please add credits to your workspace." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const text = await response.text();
        console.error("AI gateway error:", response.status, text);
        return new Response(JSON.stringify({ error: "AI service unavailable" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const aiData = await response.json();
      const choice = aiData.choices?.[0];
      const msg = choice?.message;
      if (!msg) break;

      // Check for tool calls
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

              const { data: queryResult, error: queryError } = await supabase.rpc("execute_readonly_query", {
                query_text: safeSql,
              });

              if (queryError) {
                result = JSON.stringify({ error: queryError.message });
              } else {
                result = JSON.stringify(queryResult || []);
              }

              // Audit log
              await logAiAction(supabase, tenant_id, caller.id, "sql_query", detectModule(safeSql), `Query: ${args.explanation}`);
            } catch (e) {
              result = JSON.stringify({ error: e instanceof Error ? e.message : "Query failed" });
            }
          } else if (fnName === "analyze_trend") {
            try {
              const args = JSON.parse(toolCall.function.arguments);
              result = await analyzeTrend(supabase, tenant_id, args.metric, args.months);
              await logAiAction(supabase, tenant_id, caller.id, "trend_analysis", args.metric, `Trend: ${args.metric} over ${args.months || 6} months`);
            } catch (e) {
              result = JSON.stringify({ error: e instanceof Error ? e.message : "Trend analysis failed" });
            }
          } else if (fnName === "create_reminder") {
            try {
              const args = JSON.parse(toolCall.function.arguments);
              const { error: notifErr } = await supabase.from("notifications").insert({
                tenant_id,
                user_id: caller.id,
                title: args.title?.substring(0, 100) || "AI Reminder",
                message: args.message || "",
                type: "reminder",
                read: false,
              });
              if (notifErr) {
                result = JSON.stringify({ error: notifErr.message });
              } else {
                result = JSON.stringify({ success: true, message: "Reminder created successfully" });
              }
              await logAiAction(supabase, tenant_id, caller.id, "create_reminder", "notifications", `Reminder: ${args.title}`);
            } catch (e) {
              result = JSON.stringify({ error: e instanceof Error ? e.message : "Failed to create reminder" });
            }
          } else {
            result = JSON.stringify({ error: `Unknown tool: ${fnName}` });
          }

          conversationMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: result,
          });
        }
        continue;
      }

      // No tool calls — this is the final response. Now stream it with true streaming.
      // Make a final streaming call to get token-by-token output
      const finalStreamPayload = {
        model: "google/gemini-3-flash-preview",
        messages: conversationMessages,
        stream: true,
      };

      const streamResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(finalStreamPayload),
      });

      if (!streamResponse.ok || !streamResponse.body) {
        // Fallback: use the non-streaming response we already have
        const fallbackContent = msg.content || "";
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            const sseData = JSON.stringify({ choices: [{ delta: { content: fallbackContent } }] });
            controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          },
        });
        return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
      }

      // Pipe the real SSE stream directly to the client
      return new Response(streamResponse.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // If we exhausted all tool rounds, make one final streaming call without tools
    const finalPayload = {
      model: "google/gemini-3-flash-preview",
      messages: conversationMessages,
      stream: true,
    };

    const finalResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(finalPayload),
    });

    if (!finalResponse.ok || !finalResponse.body) {
      return new Response(JSON.stringify({ error: "AI service unavailable" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(finalResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (e) {
    console.error("ai-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
