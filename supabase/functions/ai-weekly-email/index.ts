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
    // CR11-03: Fail-closed CRON_SECRET verification
    const cronSecret = Deno.env.get("CRON_SECRET");
    if (!cronSecret) {
      console.error("CRON_SECRET not configured");
      return createErrorResponse("CRON_SECRET not configured", req, { status: 500, logPrefix: "ai-weekly-email" });
    }
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return createErrorResponse("Unauthorized", req, { status: 401, logPrefix: "ai-weekly-email" });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const { tenant_id, language = "sr" } = body;
    if (!tenant_id) throw new Error("tenant_id required");

    const sr = language === "sr";
    const now = new Date();
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - now.getDay() - 6); // last Monday-ish
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(thisWeekStart.getDate() - 7);

    const fmt = (d: Date) => d.toISOString().split("T")[0];

    // Gather week-over-week metrics
    const [invoicesThis, invoicesLast, posThis, posLast, stockAlerts, insightsThis] = await Promise.all([
      supabase.from("invoices").select("total", { count: "exact" })
        .eq("tenant_id", tenant_id).gte("invoice_date", fmt(thisWeekStart)),
      supabase.from("invoices").select("total", { count: "exact" })
        .eq("tenant_id", tenant_id).gte("invoice_date", fmt(lastWeekStart)).lt("invoice_date", fmt(thisWeekStart)),
      supabase.from("pos_transactions").select("total_amount", { count: "exact" })
        .eq("tenant_id", tenant_id).gte("created_at", thisWeekStart.toISOString()),
      supabase.from("pos_transactions").select("total_amount", { count: "exact" })
        .eq("tenant_id", tenant_id).gte("created_at", lastWeekStart.toISOString()).lt("created_at", thisWeekStart.toISOString()),
      supabase.from("inventory_stock").select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant_id).lte("quantity_on_hand", 0).gt("min_stock_level", 0),
      supabase.from("ai_insights_cache").select("severity", { count: "exact" })
        .eq("tenant_id", tenant_id).in("severity", ["warning", "critical"])
        .gte("generated_at", thisWeekStart.toISOString()),
    ]);

    const sumTotal = (rows: any[] | null) => (rows || []).reduce((s, r) => s + Number(r.total || r.total_amount || 0), 0);
    const pctChange = (curr: number, prev: number) => prev === 0 ? (curr > 0 ? 100 : 0) : Math.round(((curr - prev) / prev) * 100);

    const invThisTotal = sumTotal(invoicesThis.data);
    const invLastTotal = sumTotal(invoicesLast.data);
    const invChange = pctChange(invThisTotal, invLastTotal);

    const posThisTotal = sumTotal(posThis.data);
    const posLastTotal = sumTotal(posLast.data);
    const posChange = pctChange(posThisTotal, posLastTotal);

    const arrow = (v: number) => v > 0 ? "↑" : v < 0 ? "↓" : "→";
    const fmtNum = (n: number) => n.toLocaleString(sr ? "sr-RS" : "en-US");

    const sections: string[] = [];

    sections.push(sr ? "## 📊 Nedeljni pregled trendova" : "## 📊 Weekly Trend Report");
    sections.push(`*${fmt(thisWeekStart)} — ${fmt(now)}*\n`);

    // Invoices
    sections.push(sr ? "### Fakture" : "### Invoices");
    sections.push(sr
      ? `- Ove nedelje: **${fmtNum(invThisTotal)} RSD** (${invoicesThis.count || 0} faktura)`
      : `- This week: **${fmtNum(invThisTotal)} RSD** (${invoicesThis.count || 0} invoices)`);
    sections.push(sr
      ? `- Prošle nedelje: ${fmtNum(invLastTotal)} RSD (${invoicesLast.count || 0})`
      : `- Last week: ${fmtNum(invLastTotal)} RSD (${invoicesLast.count || 0})`);
    sections.push(`- ${arrow(invChange)} **${invChange}%** WoW\n`);

    // POS
    if ((posThis.count || 0) > 0 || (posLast.count || 0) > 0) {
      sections.push(sr ? "### POS Promet" : "### POS Revenue");
      sections.push(sr
        ? `- Ove nedelje: **${fmtNum(posThisTotal)} RSD** (${posThis.count || 0} transakcija)`
        : `- This week: **${fmtNum(posThisTotal)} RSD** (${posThis.count || 0} transactions)`);
      sections.push(`- ${arrow(posChange)} **${posChange}%** WoW\n`);
    }

    // Stock alerts
    if (stockAlerts.count && stockAlerts.count > 0) {
      sections.push(sr ? "### ⚠️ Zalihe" : "### ⚠️ Stock Alerts");
      sections.push(sr
        ? `- **${stockAlerts.count}** artikala sa nultim zalihama`
        : `- **${stockAlerts.count}** items at zero stock\n`);
    }

    // AI insights
    if (insightsThis.count && insightsThis.count > 0) {
      sections.push(sr ? "### 🤖 AI Upozorenja" : "### 🤖 AI Alerts");
      sections.push(sr
        ? `- **${insightsThis.count}** upozorenja/kritičnih uvida ove nedelje`
        : `- **${insightsThis.count}** warning/critical insights this week\n`);
    }

    const digest = sections.join("\n");

    // CR7-06: Audit log for AI weekly email
    try {
      await supabase.from("ai_action_log").insert({
        tenant_id: tenant_id,
        action_type: "weekly_digest_generation",
        module: "reporting",
        model_version: "rule-based",
        user_decision: "auto",
        reasoning: `Generated weekly digest with ${sections.length} sections`,
      });
    } catch (e) {
      console.warn("Failed to log AI action:", e);
    }

    return new Response(JSON.stringify({
      digest,
      period: { from: fmt(thisWeekStart), to: fmt(now) },
      metrics: {
        invoices: { thisWeek: invThisTotal, lastWeek: invLastTotal, change: invChange },
        pos: { thisWeek: posThisTotal, lastWeek: posLastTotal, change: posChange },
        stockAlerts: stockAlerts.count || 0,
        aiInsights: insightsThis.count || 0,
      },
    }), {
      headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }),
    });

  } catch (e: any) {
    return createErrorResponse(e, req, { logPrefix: "ai-weekly-email error" });
  }
});
