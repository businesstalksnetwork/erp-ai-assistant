import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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

    const { tenant_id, language = "en" } = await req.json();
    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Verify membership
    const { data: member } = await supabase.from("tenant_members").select("id").eq("user_id", user.id).eq("tenant_id", tenant_id).eq("status", "active").maybeSingle();
    if (!member) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sr = language === "sr";
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const today = new Date().toISOString().split("T")[0];

    // Gather yesterday's key changes
    const [invoicesRes, journalsRes, stockRes, payrollRes, posRes, poRes] = await Promise.all([
      supabase.from("invoices").select("id, total, status", { count: "exact" }).eq("tenant_id", tenant_id).gte("created_at", yesterday).lt("created_at", today),
      supabase.from("journal_entries").select("id", { count: "exact" }).eq("tenant_id", tenant_id).gte("created_at", yesterday).lt("created_at", today),
      supabase.from("inventory_stock").select("product_id, quantity_on_hand, min_stock_level").eq("tenant_id", tenant_id).gt("min_stock_level", 0),
      supabase.from("payroll_runs").select("id, total_gross, status", { count: "exact" }).eq("tenant_id", tenant_id).gte("created_at", yesterday).lt("created_at", today),
      supabase.from("pos_transactions").select("id, total_amount, transaction_type", { count: "exact" }).eq("tenant_id", tenant_id).gte("created_at", yesterday).lt("created_at", today),
      supabase.from("purchase_orders").select("id, status", { count: "exact" }).eq("tenant_id", tenant_id).gte("created_at", yesterday).lt("created_at", today),
    ]);

    const newInvoiceCount = invoicesRes.count || 0;
    const invoiceTotal = (invoicesRes.data || []).reduce((s: number, i: any) => s + Number(i.total || 0), 0);
    const newJournalCount = journalsRes.count || 0;
    const lowStockItems = (stockRes.data || []).filter((s: any) => Number(s.quantity_on_hand) < Number(s.min_stock_level));
    const zeroStockItems = (stockRes.data || []).filter((s: any) => Number(s.quantity_on_hand) <= 0);
    const newPayrollCount = payrollRes.count || 0;
    const payrollTotal = (payrollRes.data || []).reduce((s: number, p: any) => s + Number(p.total_gross || 0), 0);
    const posCount = posRes.count || 0;
    const posTotal = (posRes.data || []).reduce((s: number, t: any) => s + Number(t.total_amount || 0), 0);
    const newPOCount = poRes.count || 0;

    // Build digest sections
    const sections: string[] = [];

    if (newInvoiceCount > 0) {
      sections.push(sr
        ? `📄 **Fakture**: ${newInvoiceCount} novih faktura (ukupno ${invoiceTotal.toLocaleString("sr-RS")} RSD)`
        : `📄 **Invoices**: ${newInvoiceCount} new invoices (total ${invoiceTotal.toLocaleString("en-US")} RSD)`);
    }

    if (newJournalCount > 0) {
      sections.push(sr
        ? `📝 **Knjiženja**: ${newJournalCount} novih naloga za knjiženje`
        : `📝 **Journal Entries**: ${newJournalCount} new entries`);
    }

    if (posCount > 0) {
      sections.push(sr
        ? `🏪 **POS**: ${posCount} transakcija (ukupno ${posTotal.toLocaleString("sr-RS")} RSD)`
        : `🏪 **POS**: ${posCount} transactions (total ${posTotal.toLocaleString("en-US")} RSD)`);
    }

    if (newPOCount > 0) {
      sections.push(sr
        ? `🚚 **Nabavka**: ${newPOCount} novih naloga za nabavku`
        : `🚚 **Purchasing**: ${newPOCount} new purchase orders`);
    }

    if (newPayrollCount > 0) {
      sections.push(sr
        ? `💰 **Plate**: ${newPayrollCount} obračuna (ukupno ${payrollTotal.toLocaleString("sr-RS")} RSD)`
        : `💰 **Payroll**: ${newPayrollCount} runs (total ${payrollTotal.toLocaleString("en-US")} RSD)`);
    }

    if (zeroStockItems.length > 0) {
      sections.push(sr
        ? `🚨 **Zalihe**: ${zeroStockItems.length} artikala bez zaliha`
        : `🚨 **Stock Alert**: ${zeroStockItems.length} items out of stock`);
    } else if (lowStockItems.length > 0) {
      sections.push(sr
        ? `⚠️ **Zalihe**: ${lowStockItems.length} artikala sa niskim zalihama`
        : `⚠️ **Stock Alert**: ${lowStockItems.length} items below minimum`);
    }

    // Get cached insights for critical items
    const { data: criticalInsights } = await supabase
      .from("ai_insights_cache")
      .select("title, severity")
      .eq("tenant_id", tenant_id)
      .in("severity", ["critical", "warning"])
      .gt("expires_at", new Date().toISOString())
      .limit(5);

    if (criticalInsights && criticalInsights.length > 0) {
      const alertList = criticalInsights.map((i: any) =>
        `${i.severity === "critical" ? "🔴" : "🟡"} ${i.title}`
      ).join("\n");
      sections.push(sr
        ? `\n**AI Upozorenja**:\n${alertList}`
        : `\n**AI Alerts**:\n${alertList}`);
    }

    const digestTitle = sr ? "Jutarnji pregled" : "Morning Briefing";
    const dateStr = new Date(yesterday).toLocaleDateString(sr ? "sr-Latn-RS" : "en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });

    const digest = sections.length > 0
      ? `## ${digestTitle} — ${dateStr}\n\n${sections.join("\n\n")}`
      : (sr ? `## ${digestTitle}\n\nNema značajnih promena za ${dateStr}.` : `## ${digestTitle}\n\nNo significant changes for ${dateStr}.`);

    // Log action
    try {
      await supabase.from("ai_action_log").insert({
        tenant_id, user_id: user.id, action_type: "daily_digest", module: "analytics",
        model_version: "rule-based", reasoning: `Generated digest with ${sections.length} sections`,
      });
    } catch (_) { /* ignore logging errors */ }

    return new Response(JSON.stringify({ digest, date: yesterday, sections_count: sections.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-daily-digest error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
