import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SCHEMA_CONTEXT = `You are an AI assistant for a Serbian ERP system. You have access to these database tables (all scoped to a specific tenant_id):
- invoices: invoice_number, invoice_date, due_date, partner_name, status (draft/sent/paid/cancelled), subtotal, tax_amount, total, currency
- invoice_lines: invoice_id, description, quantity, unit_price, line_total, tax_amount
- journal_entries: entry_number, entry_date, description, status (draft/posted/reversed), reference
- journal_lines: journal_entry_id, account_id, debit, credit, description
- chart_of_accounts: code, name, name_sr, account_type (asset/liability/equity/revenue/expense)
- partners: name, type (customer/supplier/both), email, phone, pib, city, account_tier, dormancy_status
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

You can query the database using the query_tenant_data tool. ALWAYS use it when the user asks about specific data.
Rules for queries:
1. ONLY SELECT statements are allowed — never INSERT/UPDATE/DELETE
2. Always filter by tenant_id = '{TENANT_ID}'
3. Use aggregate functions (SUM, COUNT, AVG) when summarizing
4. Limit results to 50 rows max
5. Format currency values with 2 decimal places
6. Support both English and Serbian language responses`;

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

/** Validate and sanitize SQL — only allow SELECT */
function validateSql(sql: string, tenantId: string): string {
  const trimmed = sql.trim().replace(/;+$/, "");
  const upper = trimmed.toUpperCase();

  // Block any mutation keywords
  const forbidden = ["INSERT ", "UPDATE ", "DELETE ", "DROP ", "ALTER ", "CREATE ", "TRUNCATE ", "GRANT ", "REVOKE ", "EXECUTE ", "EXEC "];
  for (const kw of forbidden) {
    if (upper.includes(kw)) throw new Error(`Forbidden SQL keyword: ${kw.trim()}`);
  }

  if (!upper.startsWith("SELECT")) throw new Error("Only SELECT queries are allowed");

  // Replace placeholder with actual tenant_id
  const final = trimmed.replace(/'\{TENANT_ID\}'/g, `'${tenantId}'`);

  // Enforce LIMIT
  if (!upper.includes("LIMIT")) return final + " LIMIT 50";
  return final;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // JWT validation
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

    // Gather quick stats for context
    const [invoiceStats, partnerCount, productCount, employeeCount] = await Promise.all([
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

    const systemPrompt = `${SCHEMA_CONTEXT.replace(/\{TENANT_ID\}/g, tenant_id)}\n\n${contextData}\n\nRespond in ${language === "sr" ? "Serbian (Latin script)" : "English"}. Use markdown formatting for tables and lists.`;

    // Tool-calling loop: up to 3 iterations
    let conversationMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];
    const MAX_TOOL_ROUNDS = 3;
    let finalContent = "";

    for (let round = 0; round < MAX_TOOL_ROUNDS + 1; round++) {
      const isLastRound = round === MAX_TOOL_ROUNDS;

      const aiPayload: any = {
        model: "google/gemini-3-flash-preview",
        messages: conversationMessages,
        stream: false,
      };

      // Only offer tools if not the last round
      if (!isLastRound) {
        aiPayload.tools = [QUERY_TOOL];
        aiPayload.tool_choice = "auto";
      }

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
        // Add assistant message with tool_calls to conversation
        conversationMessages.push(msg);

        // Process each tool call
        for (const toolCall of msg.tool_calls) {
          if (toolCall.function?.name === "query_tenant_data") {
            let result: string;
            try {
              const args = JSON.parse(toolCall.function.arguments);
              const safeSql = validateSql(args.sql, tenant_id);
              console.log(`[AI SQL] ${args.explanation}: ${safeSql}`);

              const { data: queryResult, error: queryError } = await supabase.rpc("execute_readonly_query", {
                query_text: safeSql,
              });

              if (queryError) {
                // Fallback: try direct query via postgrest if RPC doesn't exist
                result = JSON.stringify({ error: queryError.message });
              } else {
                result = JSON.stringify(queryResult || []);
              }
            } catch (e) {
              result = JSON.stringify({ error: e instanceof Error ? e.message : "Query failed" });
            }

            conversationMessages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: result,
            });
          }
        }
        // Continue the loop to let AI process tool results
        continue;
      }

      // No tool calls — this is the final response
      finalContent = msg.content || "";
      break;
    }

    // Stream the final content back as SSE for frontend compatibility
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // Split content into chunks for streaming feel
        const chunkSize = 20;
        for (let i = 0; i < finalContent.length; i += chunkSize) {
          const chunk = finalContent.slice(i, i + chunkSize);
          const sseData = JSON.stringify({
            choices: [{ delta: { content: chunk } }],
          });
          controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
