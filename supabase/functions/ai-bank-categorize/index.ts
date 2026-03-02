import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/error-handler.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

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

    const { tenant_id, statement_lines, save_corrections } = await req.json();
    if (!tenant_id || !statement_lines?.length) {
      return new Response(JSON.stringify({ error: "Missing tenant_id or statement_lines" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Verify membership
    const { data: member } = await supabase.from("tenant_members").select("id").eq("tenant_id", tenant_id).eq("user_id", user.id).eq("status", "active").limit(1).single();
    if (!member) {
      return new Response(JSON.stringify({ error: "Not a tenant member" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Task 30: Save user corrections to learning rules
    if (save_corrections && Array.isArray(save_corrections)) {
      for (const correction of save_corrections) {
        const { pattern, account_code, partner_name } = correction;
        if (!pattern || !account_code) continue;

        // Look up account_id from code
        const { data: account } = await supabase
          .from("chart_of_accounts")
          .select("id")
          .eq("tenant_id", tenant_id)
          .eq("code", account_code)
          .maybeSingle();

        // Look up partner_id if provided
        let partnerId = null;
        if (partner_name) {
          const { data: partner } = await supabase
            .from("partners")
            .select("id")
            .eq("tenant_id", tenant_id)
            .ilike("name", partner_name)
            .maybeSingle();
          partnerId = partner?.id || null;
        }

        // Upsert rule: increment usage_count if pattern exists, else insert
        const { data: existing } = await supabase
          .from("bank_categorization_rules")
          .select("id, usage_count")
          .eq("tenant_id", tenant_id)
          .eq("pattern", pattern.toLowerCase().trim())
          .maybeSingle();

        if (existing) {
          await supabase.from("bank_categorization_rules")
            .update({
              account_id: account?.id || null,
              partner_id: partnerId,
              usage_count: (existing.usage_count || 0) + 1,
              confidence: Math.min(1.0, 0.5 + (existing.usage_count || 0) * 0.1),
            })
            .eq("id", existing.id);
        } else if (account?.id) {
          await supabase.from("bank_categorization_rules").insert({
            tenant_id,
            pattern: pattern.toLowerCase().trim(),
            account_id: account.id,
            partner_id: partnerId,
            confidence: 0.6,
            usage_count: 1,
          });
        }
      }

      return new Response(JSON.stringify({ saved: save_corrections.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch chart of accounts
    const { data: accounts } = await supabase.from("chart_of_accounts").select("code, name, name_sr, account_type").eq("tenant_id", tenant_id).eq("is_active", true).order("code");

    // Task 30: Fetch learned rules for this tenant
    const { data: learnedRules } = await supabase
      .from("bank_categorization_rules")
      .select("pattern, account_id, partner_id, confidence")
      .eq("tenant_id", tenant_id)
      .order("usage_count", { ascending: false })
      .limit(100);

    // Try to match lines against learned rules first
    const preMatched: Record<number, { code: string; confidence: number }> = {};
    if (learnedRules && learnedRules.length > 0) {
      // Build account_id -> code map
      const accountIdToCode: Record<string, string> = {};
      for (const a of (accounts || [])) {
        // We need id for this — fetch separately
      }
      const { data: accountsWithId } = await supabase
        .from("chart_of_accounts")
        .select("id, code")
        .eq("tenant_id", tenant_id)
        .eq("is_active", true);
      for (const a of (accountsWithId || [])) {
        accountIdToCode[a.id] = a.code;
      }

      for (let i = 0; i < statement_lines.length; i++) {
        const line = statement_lines[i];
        const desc = (line.description || "").toLowerCase();
        const partner = (line.partner_name || "").toLowerCase();

        for (const rule of learnedRules) {
          if (desc.includes(rule.pattern) || partner.includes(rule.pattern)) {
            const code = accountIdToCode[rule.account_id];
            if (code) {
              preMatched[i] = { code, confidence: rule.confidence };
              break;
            }
          }
        }
      }
    }

    // Lines that need AI categorization
    const unmatchedLines = statement_lines
      .map((l: any, i: number) => ({ ...l, originalIndex: i }))
      .filter((_: any, i: number) => !preMatched[i]);

    let aiSuggestions: any[] = [];

    if (unmatchedLines.length > 0) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        return new Response(JSON.stringify({ error: "AI not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const accountList = (accounts || []).map((a: any) => `${a.code}: ${a.name_sr || a.name} (${a.account_type})`).join("\n");
      const lineSummaries = unmatchedLines.slice(0, 20).map((l: any, i: number) =>
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

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${LOVABLE_API_KEY}` },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1,
        }),
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content || "[]";
        try {
          const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          const parsed = JSON.parse(cleaned);
          // Map back to original indices
          aiSuggestions = parsed.map((s: any) => ({
            ...s,
            line_index: unmatchedLines[s.line_index]?.originalIndex ?? s.line_index,
          }));
        } catch {
          aiSuggestions = [];
        }
      }
    }

    // Combine pre-matched (learned) + AI suggestions
    const suggestions = [
      ...Object.entries(preMatched).map(([idx, match]) => ({
        line_index: Number(idx),
        suggested_code: match.code,
        confidence: match.confidence,
        reasoning: "Matched from learned categorization rules",
        source: "learned",
      })),
      ...aiSuggestions.map((s: any) => ({ ...s, source: "ai" })),
    ].sort((a, b) => a.line_index - b.line_index);

    // Log AI action
    await supabase.from("ai_action_log").insert({
      tenant_id, user_id: user.id, action_type: "bank_categorize", module: "accounting",
      model_version: "gemini-3-flash-preview", reasoning: `Categorized ${statement_lines.length} bank lines (${Object.keys(preMatched).length} from rules, ${aiSuggestions.length} from AI)`,
    });

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return createErrorResponse(error, req, { logPrefix: "ai-bank-categorize error" });
  }
});
