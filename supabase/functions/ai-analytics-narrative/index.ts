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
  planning: `You are a business strategy AI advisor. Given YTD actuals vs targets, provide 3-5 actionable recommendations as a JSON array of strings.`,
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
};

/** Validate SQL for read-only tenant-scoped queries */
function validateSql(sql: string, tenantId: string): string {
  const trimmed = sql.trim().replace(/;+$/, "");
  const upper = trimmed.toUpperCase();
  const forbidden = ["INSERT ", "UPDATE ", "DELETE ", "DROP ", "ALTER ", "CREATE ", "TRUNCATE "];
  for (const kw of forbidden) {
    if (upper.includes(kw)) throw new Error(`Forbidden SQL keyword: ${kw.trim()}`);
  }
  if (!upper.startsWith("SELECT")) throw new Error("Only SELECT queries allowed");
  const final = trimmed.replace(/'\{TENANT_ID\}'/g, `'${tenantId}'`);
  if (!upper.includes("LIMIT")) return final + " LIMIT 50";
  return final;
}

/** Log AI action to audit trail */
async function logAiAction(supabase: any, tenantId: string, userId: string, module: string, reasoning: string) {
  try {
    await supabase.from("ai_action_log").insert({
      tenant_id: tenantId,
      user_id: userId,
      action_type: "narrative_generation",
      module,
      model_version: "gemini-3-flash-preview",
      user_decision: "auto",
      reasoning: reasoning.substring(0, 500),
    });
  } catch (e) {
    console.warn("Failed to log AI action:", e);
  }
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

    const { tenant_id, context_type, data, language } = await req.json();
    if (!tenant_id || !context_type || !data) {
      return new Response(JSON.stringify({ error: "tenant_id, context_type, and data are required" }), {
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
    const dataHash = JSON.stringify(data).length.toString() + "_" + context_type;
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

    const baseSystemPrompt = systemPrompts[context_type] || systemPrompts.dashboard;
    const langHint = language === "sr" ? " Respond in Serbian (Latin script)." : " Respond in English.";

    // Tool-calling: allow AI to query DB for additional context
    const QUERY_TOOL = {
      type: "function" as const,
      function: {
        name: "query_tenant_data",
        description: "Execute a read-only SQL query to get additional context. Only SELECT. Must filter by tenant_id = '{TENANT_ID}'.",
        parameters: {
          type: "object",
          properties: {
            sql: { type: "string", description: "A SELECT SQL query." },
            reason: { type: "string", description: "Why this data is needed." },
          },
          required: ["sql", "reason"],
          additionalProperties: false,
        },
      },
    };

    const PROVIDE_NARRATIVE_TOOL = {
      type: "function" as const,
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
    };

    const userMessage = `Here are the financial metrics for ${context_type}:\n${JSON.stringify(data, null, 2)}\n\nAnalyze these metrics. You can query the database for additional context using query_tenant_data (filter by tenant_id = '${tenant_id}'). When done, use provide_narrative to return your analysis.`;

    let conversationMessages: any[] = [
      { role: "system", content: baseSystemPrompt + langHint + `\n\nYou have access to the tenant database (tenant_id: ${tenant_id}). Available tables include: invoices, partners, journal_entries, journal_lines, chart_of_accounts, inventory_stock, products, payroll_runs, employees. You can query for additional context.` },
      { role: "user", content: userMessage },
    ];

    // Tool-calling loop (max 3 rounds)
    for (let round = 0; round < 3; round++) {
      let aiResponse: Response | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: conversationMessages,
            tools: [QUERY_TOOL, PROVIDE_NARRATIVE_TOOL],
            tool_choice: "auto",
            stream: false,
          }),
        });
        if (aiResponse.ok || (aiResponse.status !== 503 && aiResponse.status !== 500)) break;
        console.warn(`AI gateway returned ${aiResponse.status}, retry ${attempt + 1}/3`);
        await aiResponse.text(); // consume body
        if (attempt < 2) await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
      }

      if (!aiResponse || !aiResponse.ok) {
        const status = aiResponse?.status || 500;
        if (status === 429) {
          return new Response(JSON.stringify({ error: "Rate limited, please try again later." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (status === 402) {
          return new Response(JSON.stringify({ error: "Payment required." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const errText = aiResponse ? await aiResponse.text() : "No response";
        console.error("AI gateway error:", status, errText);
        return new Response(JSON.stringify({ error: "AI service temporarily unavailable, please try again." }), {
          status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const aiData = await aiResponse.json();
      const msg = aiData.choices?.[0]?.message;
      if (!msg) break;

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        conversationMessages.push(msg);

        for (const toolCall of msg.tool_calls) {
          const fnName = toolCall.function?.name;

          if (fnName === "query_tenant_data") {
            let result: string;
            try {
              const args = JSON.parse(toolCall.function.arguments);
              const safeSql = validateSql(args.sql, tenant_id);
              console.log(`[Narrative SQL] ${args.reason}: ${safeSql}`);
              const { data: queryResult, error: queryError } = await supabase.rpc("execute_readonly_query", {
                query_text: safeSql,
              });
              result = queryError ? JSON.stringify({ error: queryError.message }) : JSON.stringify(queryResult || []);
            } catch (e) {
              result = JSON.stringify({ error: e instanceof Error ? e.message : "Query failed" });
            }

            conversationMessages.push({ role: "tool", tool_call_id: toolCall.id, content: result });
          } else if (fnName === "provide_narrative") {
            // Final result
            const parsed = JSON.parse(toolCall.function.arguments);
            const narrative = parsed.narrative || "";
            const recommendations = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];

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
            await logAiAction(supabase, tenant_id, caller.id, context_type, `Narrative for ${context_type}: ${narrative.substring(0, 200)}`);

            return new Response(JSON.stringify({ narrative, recommendations }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
        continue;
      }

      // No tool calls - try to parse content as JSON
      const content = msg.content || "";
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.narrative || parsed.recommendations) {
            // Audit log
            await logAiAction(supabase, tenant_id, caller.id, context_type, `Narrative for ${context_type}`);
            return new Response(JSON.stringify({
              narrative: parsed.narrative || "",
              recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      } catch { /* fall through */ }

      if (context_type === "planning") {
        try {
          const match = content.match(/\[[\s\S]*?\]/);
          if (match) {
            const recommendations = JSON.parse(match[0]);
            await logAiAction(supabase, tenant_id, caller.id, context_type, `Planning recommendations`);
            return new Response(JSON.stringify({ narrative: "", recommendations }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        } catch { /* fall through */ }
      }

      await logAiAction(supabase, tenant_id, caller.id, context_type, `Narrative for ${context_type}`);
      return new Response(JSON.stringify({ narrative: content, recommendations: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ narrative: "", recommendations: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-analytics-narrative error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
