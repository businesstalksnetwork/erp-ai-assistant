import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const systemPrompts: Record<string, string> = {
  dashboard: `You are a financial analyst AI. Given the user's financial KPIs (gross margin, current ratio, DSO, debt-to-equity, revenue, expenses), provide a 2-3 sentence executive summary of their financial health. Be specific about which metrics are good/concerning. Use professional but accessible language.`,
  ratios: `You are a financial analyst AI. Given a set of financial ratios (liquidity, profitability, efficiency, solvency), interpret them in 2-3 sentences. Highlight strengths and areas of concern. Compare against standard benchmarks where relevant.`,
  cashflow: `You are a financial analyst AI. Given cash flow forecast data, provide a 2-3 sentence risk assessment. Mention any projected shortfalls and suggest timing of action.`,
  planning: `You are a business strategy AI advisor. Given YTD actuals vs targets and year-over-year growth data, provide 3-5 actionable recommendations as a JSON array of strings. Focus on specific, implementable suggestions.`,
  budget: `You are a financial analyst AI. Given budget vs actual data including total budget, total actual spending, and accounts that are over budget, provide a 2-3 sentence analysis of spending discipline. Identify the most concerning variances and suggest specific corrective actions. Be data-driven.`,
  breakeven: `You are a financial analyst AI. Given break-even analysis data (fixed costs, variable costs, revenue, contribution margin, break-even point), provide a 2-3 sentence interpretation. Comment on whether the business is above or below break-even, the safety margin, and suggest 1-2 specific ways to lower the break-even point.`,
  profitability: `You are a financial analyst AI. Given profitability data by customer, product, and cost center (including margins, revenue, COGS), provide a 2-3 sentence analysis. Identify the best and worst performers, highlight any concerning margin trends, and suggest focus areas for improvement.`,
  expenses: `You are a financial analyst AI. Given expense breakdown data (salaries, supplier costs, depreciation, operating expenses, totals, and ratios), provide a 2-3 sentence analysis. Comment on the expense composition, salary-to-total ratio, and identify potential cost optimization opportunities.`,
};

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

    const { tenant_id, context_type, data, language } = await req.json();
    if (!tenant_id || !context_type || !data) {
      return new Response(JSON.stringify({ error: "tenant_id, context_type, and data are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify tenant membership
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: membership } = await supabase
      .from("tenant_members").select("id")
      .eq("user_id", caller.id).eq("tenant_id", tenant_id).eq("status", "active").maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = systemPrompts[context_type] || systemPrompts.dashboard;
    const langHint = language === "sr" ? " Respond in Serbian (Latin script)." : " Respond in English.";

    const userMessage = context_type === "planning"
      ? `Here is the business data:\n${JSON.stringify(data, null, 2)}\n\nProvide 3-5 actionable recommendations as a JSON array of strings.`
      : `Here are the financial metrics:\n${JSON.stringify(data, null, 2)}\n\nProvide your analysis.`;

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
          { role: "user", content: userMessage },
        ],
        stream: false,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    // For planning context, try to parse recommendations array
    if (context_type === "planning") {
      try {
        // Try to extract JSON array from the response
        const match = content.match(/\[[\s\S]*?\]/);
        if (match) {
          const recommendations = JSON.parse(match[0]);
          return new Response(JSON.stringify({ narrative: "", recommendations }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch { /* fall through to narrative */ }
    }

    return new Response(JSON.stringify({ narrative: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-analytics-narrative error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
