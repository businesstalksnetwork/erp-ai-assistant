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
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: authErr } = await userClient.auth.getClaims(token);
    if (authErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claimsData.claims.sub as string;

    const { tenant_id } = await req.json();
    if (!tenant_id) return new Response(JSON.stringify({ error: "tenant_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: mem } = await userClient.from("tenant_members").select("id").eq("tenant_id", tenant_id).eq("user_id", userId).maybeSingle();
    if (!mem) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    // Fetch open AR invoices (receivables)
    const { data: arInvoices } = await admin.from("invoices").select("id, total, due_date, invoice_date, partner_id")
      .eq("tenant_id", tenant_id).in("status", ["sent", "draft", "posted"]).gte("due_date", todayStr).limit(500);

    // Fetch open AP invoices (payables)
    const { data: apInvoices } = await admin.from("supplier_invoices").select("id, total_amount, due_date, invoice_date")
      .eq("tenant_id", tenant_id).in("status", ["pending", "approved"]).gte("due_date", todayStr).limit(500);

    // Fetch bank balances
    const { data: bankAccounts } = await admin.from("bank_accounts").select("id, account_name, current_balance, currency")
      .eq("tenant_id", tenant_id).eq("is_active", true);

    const currentBalance = (bankAccounts || []).reduce((s: number, b: any) => s + Number(b.current_balance || 0), 0);

    // Collection probability by aging bucket
    const collectionProb: Record<string, number> = {
      current: 0.95, "1-30": 0.85, "31-60": 0.65, "61-90": 0.40,
    };

    // Project 90 days
    const projections: { day: number; date: string; expected: number; optimistic: number; pessimistic: number }[] = [];
    let runningExpected = currentBalance;
    let runningOptimistic = currentBalance;
    let runningPessimistic = currentBalance;

    const arByDay: Record<number, number> = {};
    const apByDay: Record<number, number> = {};

    for (const inv of (arInvoices || [])) {
      const daysOut = Math.max(0, Math.floor((new Date(inv.due_date).getTime() - today.getTime()) / 86400000));
      if (daysOut <= 90) {
        const amount = Number(inv.total);
        const bucket = daysOut <= 0 ? "current" : daysOut <= 30 ? "1-30" : daysOut <= 60 ? "31-60" : "61-90";
        const prob = collectionProb[bucket] || 0.3;
        arByDay[daysOut] = (arByDay[daysOut] || 0) + amount * prob;
      }
    }

    for (const inv of (apInvoices || [])) {
      const daysOut = Math.max(0, Math.floor((new Date(inv.due_date).getTime() - today.getTime()) / 86400000));
      if (daysOut <= 90) {
        apByDay[daysOut] = (apByDay[daysOut] || 0) + Number(inv.total_amount);
      }
    }

    for (let d = 0; d <= 90; d++) {
      const arFlow = arByDay[d] || 0;
      const apFlow = apByDay[d] || 0;
      runningExpected += arFlow - apFlow;
      runningOptimistic += (arFlow * 1.15) - (apFlow * 0.85);
      runningPessimistic += (arFlow * 0.6) - (apFlow * 1.1);

      if (d % 7 === 0 || d === 90) {
        const date = new Date(today.getTime() + d * 86400000).toISOString().split("T")[0];
        projections.push({
          day: d, date,
          expected: Math.round(runningExpected),
          optimistic: Math.round(runningOptimistic),
          pessimistic: Math.round(runningPessimistic),
        });
      }
    }

    // Key metrics
    const totalAR = (arInvoices || []).reduce((s: number, i: any) => s + Number(i.total), 0);
    const totalAP = (apInvoices || []).reduce((s: number, i: any) => s + Number(i.total_amount), 0);
    const dailyBurn = totalAP > 0 ? totalAP / 90 : 0;
    const daysOfRunway = dailyBurn > 0 ? Math.round(currentBalance / dailyBurn) : 999;
    const shortfallPoint = projections.find(p => p.expected < 0);

    // Largest upcoming obligations
    const topAP = (apInvoices || []).sort((a: any, b: any) => Number(b.total_amount) - Number(a.total_amount)).slice(0, 5).map((i: any) => ({
      amount: Number(i.total_amount), due_date: i.due_date,
    }));

    // AI narrative
    let aiNarrative = "";
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (LOVABLE_API_KEY) {
      try {
        const context = {
          current_balance: currentBalance, total_ar: totalAR, total_ap: totalAP,
          days_of_runway: daysOfRunway, shortfall_date: shortfallPoint?.date || null,
          projected_30d: projections.find(p => p.day >= 28)?.expected,
          projected_60d: projections.find(p => p.day >= 56)?.expected,
          projected_90d: projections.find(p => p.day >= 84)?.expected,
        };
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: "You are a CFO-level cash flow analyst AI. Given projection data, provide a 3-4 sentence risk assessment. Highlight key drivers, potential shortfalls, and recommended actions. Be specific with numbers." },
              { role: "user", content: JSON.stringify(context) },
            ],
          }),
        });
        if (aiResp.ok) {
          const aiData = await aiResp.json();
          aiNarrative = aiData.choices?.[0]?.message?.content || "";
        }
      } catch (e) { console.error("AI enrichment failed:", e); }
    }

    await admin.from("ai_action_log").insert({
      tenant_id, module: "accounting", action_type: "cash_flow_prediction",
      ai_output: { current_balance: currentBalance, days_of_runway: daysOfRunway, shortfall_date: shortfallPoint?.date },
      model_version: "google/gemini-3-flash-preview", user_id: userId,
    });

    return new Response(JSON.stringify({
      projections, current_balance: currentBalance, total_ar: totalAR, total_ap: totalAP,
      days_of_runway: daysOfRunway, shortfall_date: shortfallPoint?.date || null,
      largest_obligations: topAP, narrative: aiNarrative,
    }), { headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });

  } catch (e) {
    return createErrorResponse(e, req, { logPrefix: "ai-cash-flow-predict error" });
  }
});
