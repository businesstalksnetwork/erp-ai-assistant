import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
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
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
