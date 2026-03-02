/**
 * R2: AI Market Basket Analysis Edge Function
 * Analyzes POS transaction data to find product co-purchase patterns.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/error-handler.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";

Deno.serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;
  const corsHeaders = getCorsHeaders(req);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return createErrorResponse("Unauthorized", req, { status: 401, logPrefix: "ai-market-basket" });

    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return createErrorResponse("Unauthorized", req, { status: 401, logPrefix: "ai-market-basket" });

    const { tenant_id, language = "sr" } = await req.json();
    if (!tenant_id) return createErrorResponse("Missing tenant_id", req, { status: 400, logPrefix: "ai-market-basket" });

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Verify membership
    const { data: member } = await sb.from("tenant_members").select("id").eq("tenant_id", tenant_id).eq("user_id", user.id).eq("status", "active").limit(1).single();
    if (!member) return createErrorResponse("Forbidden", req, { status: 403, logPrefix: "ai-market-basket" });

    // Fetch recent sale transactions (last 90 days)
    const cutoff = new Date(Date.now() - 90 * 86400000).toISOString();
    const { data: txs } = await sb.from("pos_transactions")
      .select("id, items")
      .eq("tenant_id", tenant_id)
      .eq("receipt_type", "sale")
      .gte("created_at", cutoff)
      .limit(2000);

    if (!txs || txs.length < 10) {
      return new Response(JSON.stringify({
        pairs: [],
        message: language === "sr" ? "Nedovoljno transakcija za analizu (min. 10)" : "Not enough transactions for analysis (min. 10)",
      }), { headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });
    }

    // Build co-occurrence matrix
    const pairCounts: Record<string, number> = {};
    const itemCounts: Record<string, number> = {};
    const totalTx = txs.length;

    for (const tx of txs) {
      const items = (tx.items as any[]) || [];
      const names = [...new Set(items.map((i: any) => i.name))];

      for (const name of names) {
        itemCounts[name] = (itemCounts[name] || 0) + 1;
      }

      // Generate pairs
      for (let i = 0; i < names.length; i++) {
        for (let j = i + 1; j < names.length; j++) {
          const key = [names[i], names[j]].sort().join("|||");
          pairCounts[key] = (pairCounts[key] || 0) + 1;
        }
      }
    }

    // Calculate support, confidence, and lift for each pair
    const pairs = Object.entries(pairCounts)
      .filter(([, count]) => count >= 3) // minimum support
      .map(([key, count]) => {
        const [a, b] = key.split("|||");
        const support = count / totalTx;
        const confidenceAB = count / (itemCounts[a] || 1);
        const confidenceBA = count / (itemCounts[b] || 1);
        const expectedSupport = ((itemCounts[a] || 0) / totalTx) * ((itemCounts[b] || 0) / totalTx);
        const lift = expectedSupport > 0 ? support / expectedSupport : 0;

        return {
          product_a: a,
          product_b: b,
          co_occurrences: count,
          support: Math.round(support * 10000) / 100,
          confidence_a_to_b: Math.round(confidenceAB * 10000) / 100,
          confidence_b_to_a: Math.round(confidenceBA * 10000) / 100,
          lift: Math.round(lift * 100) / 100,
        };
      })
      .sort((a, b) => b.lift - a.lift)
      .slice(0, 30);

    // Generate AI recommendations
    let recommendations: string[] = [];
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (LOVABLE_API_KEY && pairs.length > 0) {
      try {
        const sr = language === "sr";
        const topPairs = pairs.slice(0, 10);
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: `You are a retail analytics expert. Analyze product co-purchase patterns and suggest 3-5 actionable recommendations for promotions, cross-selling, or store layout. Respond in ${sr ? "Serbian (Latin script)" : "English"}. Return a JSON array of strings.` },
              { role: "user", content: `Product co-purchase patterns (top 10 by lift):\n${JSON.stringify(topPairs, null, 2)}\n\nTotal transactions analyzed: ${totalTx}` },
            ],
            temperature: 0.3,
          }),
        });
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const content = aiData.choices?.[0]?.message?.content || "";
          try {
            const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
            recommendations = JSON.parse(cleaned);
          } catch {
            recommendations = [content];
          }
        }
      } catch (e) { console.warn("AI recommendations failed:", e); }
    }

    // Audit log
    try {
      await sb.from("ai_action_log").insert({
        tenant_id,
        user_id: user.id,
        action_type: "market_basket_analysis",
        module: "pos",
        model_version: "google/gemini-3-flash-preview",
        user_decision: "auto",
        reasoning: `Analyzed ${totalTx} transactions, found ${pairs.length} product pairs`,
      });
    } catch (e) { console.warn("Audit log failed:", e); }

    return new Response(JSON.stringify({
      pairs,
      total_transactions: totalTx,
      analysis_period_days: 90,
      recommendations,
    }), { headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });
  } catch (e) {
    return createErrorResponse(e, req, { logPrefix: "ai-market-basket" });
  }
});
