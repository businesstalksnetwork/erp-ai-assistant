import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { tenant_id, statement_lines } = await req.json();
    if (!tenant_id || !statement_lines?.length) {
      return new Response(JSON.stringify({ error: "Missing tenant_id or statement_lines" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Verify membership
    const { data: member } = await supabase.from("tenant_members").select("id").eq("tenant_id", tenant_id).eq("user_id", user.id).eq("status", "active").limit(1).single();
    if (!member) {
      return new Response(JSON.stringify({ error: "Not a tenant member" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch chart of accounts
    const { data: accounts } = await supabase.from("chart_of_accounts").select("code, name, name_sr, account_type").eq("tenant_id", tenant_id).eq("is_active", true).order("code");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const accountList = (accounts || []).map((a: any) => `${a.code}: ${a.name_sr || a.name} (${a.account_type})`).join("\n");
    const lineSummaries = statement_lines.slice(0, 20).map((l: any, i: number) =>
      `${i + 1}. ${l.direction} | ${l.amount} RSD | ${l.partner_name || "N/A"} | ${l.description || ""} | ref: ${l.payment_reference || ""}`
    ).join("\n");

    const prompt = `You are a Serbian accounting expert. Categorize these bank statement lines to the appropriate chart of accounts code.

Chart of Accounts:
${accountList}

Bank Statement Lines:
${lineSummaries}

For each line, respond with JSON array:
[{"line_index": 0, "suggested_code": "2410", "confidence": 0.95, "reasoning": "..."}, ...]

Rules:
- Incoming payments from customers → 2040 (AR)
- Outgoing payments to suppliers → 2100 (AP)
- Salary payments → 7200
- Tax payments → 4700
- Bank charges → 8000
- Interest income → 4100
- Interest expense → 8300
Respond ONLY with the JSON array.`;

    const aiResponse = await fetch("https://api.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI API error:", errText);
      return new Response(JSON.stringify({ error: "AI service error" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "[]";

    let suggestions;
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      suggestions = JSON.parse(cleaned);
    } catch {
      suggestions = [];
    }

    // Log AI action
    await supabase.from("ai_action_log").insert({
      tenant_id, user_id: user.id, action_type: "bank_categorize", module: "accounting",
      model_version: "gpt-4o-mini", reasoning: `Categorized ${statement_lines.length} bank lines`,
    });

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
