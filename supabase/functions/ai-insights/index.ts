import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Insight {
  insight_type: string;
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  data: Record<string, unknown>;
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

    const { tenant_id, language } = await req.json();
    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check cache first
    const { data: cached } = await supabase
      .from("ai_insights_cache")
      .select("*")
      .eq("tenant_id", tenant_id)
      .gt("expires_at", new Date().toISOString())
      .order("generated_at", { ascending: false });

    if (cached && cached.length > 0) {
      return new Response(JSON.stringify({ insights: cached }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const insights: Insight[] = [];
    const sr = language === "sr";
    const today = new Date().toISOString().split("T")[0];

    // 1. Overdue invoices
    const { data: overdueInvoices, count: overdueCount } = await supabase
      .from("invoices")
      .select("partner_name, total, due_date", { count: "exact" })
      .eq("tenant_id", tenant_id)
      .in("status", ["draft", "sent"])
      .lt("due_date", today)
      .order("total", { ascending: false })
      .limit(5);

    if (overdueCount && overdueCount > 0) {
      const totalOverdue = overdueInvoices?.reduce((s, i) => s + Number(i.total), 0) || 0;
      insights.push({
        insight_type: "overdue_invoices",
        severity: overdueCount > 5 ? "critical" : "warning",
        title: sr ? `${overdueCount} dospelih faktura` : `${overdueCount} Overdue Invoices`,
        description: sr
          ? `Imate ${overdueCount} dospelih faktura u ukupnom iznosu od ${totalOverdue.toLocaleString("sr-RS", { minimumFractionDigits: 2 })} RSD. Najveća je od ${overdueInvoices?.[0]?.partner_name || "nepoznato"}.`
          : `You have ${overdueCount} overdue invoices totaling ${totalOverdue.toLocaleString("en-US", { minimumFractionDigits: 2 })} RSD. Largest is from ${overdueInvoices?.[0]?.partner_name || "unknown"}.`,
        data: { count: overdueCount, total: totalOverdue, top: overdueInvoices },
      });
    }

    // 2. Large invoices (> 3x average)
    const { data: allInvoices } = await supabase
      .from("invoices")
      .select("total, partner_name, invoice_number")
      .eq("tenant_id", tenant_id)
      .eq("status", "paid");

    if (allInvoices && allInvoices.length > 3) {
      const avg = allInvoices.reduce((s, i) => s + Number(i.total), 0) / allInvoices.length;
      const large = allInvoices.filter(i => Number(i.total) > avg * 3);
      if (large.length > 0) {
        insights.push({
          insight_type: "large_invoices",
          severity: "info",
          title: sr ? `${large.length} neuobičajeno velikih faktura` : `${large.length} Unusually Large Invoices`,
          description: sr
            ? `Pronađene su ${large.length} fakture koje su više od 3x proseka (${avg.toFixed(0)} RSD).`
            : `Found ${large.length} invoices exceeding 3x the average (${avg.toFixed(0)} RSD).`,
          data: { average: avg, count: large.length },
        });
      }
    }

    // 3. Low/zero stock
    const { data: lowStock } = await supabase
      .from("inventory_stock")
      .select("product_id, quantity_on_hand, min_stock_level")
      .eq("tenant_id", tenant_id)
      .gt("min_stock_level", 0);

    if (lowStock) {
      const critical = lowStock.filter(s => Number(s.quantity_on_hand) <= 0);
      const low = lowStock.filter(s => Number(s.quantity_on_hand) > 0 && Number(s.quantity_on_hand) < Number(s.min_stock_level));
      if (critical.length > 0) {
        insights.push({
          insight_type: "zero_stock",
          severity: "critical",
          title: sr ? `${critical.length} artikala bez zaliha` : `${critical.length} Items Out of Stock`,
          description: sr
            ? `${critical.length} artikala ima nulte ili negativne zalihe i zahtevaju hitnu nabavku.`
            : `${critical.length} items have zero or negative stock and need immediate restocking.`,
          data: { count: critical.length },
        });
      }
      if (low.length > 0) {
        insights.push({
          insight_type: "low_stock",
          severity: "warning",
          title: sr ? `${low.length} artikala sa niskim zalihama` : `${low.length} Low Stock Items`,
          description: sr
            ? `${low.length} artikala je ispod minimalnog nivoa zaliha.`
            : `${low.length} items are below their minimum stock level.`,
          data: { count: low.length },
        });
      }
    }

    // 4. Draft journal entries needing attention
    const { count: draftJournals } = await supabase
      .from("journal_entries")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant_id)
      .eq("status", "draft");

    if (draftJournals && draftJournals > 5) {
      insights.push({
        insight_type: "draft_journals",
        severity: "info",
        title: sr ? `${draftJournals} naloga u nacrtu` : `${draftJournals} Draft Journal Entries`,
        description: sr
          ? `Imate ${draftJournals} naloga za knjiženje u statusu nacrta. Razmotrite njihovo knjiženje ili brisanje.`
          : `You have ${draftJournals} draft journal entries. Consider posting or deleting them.`,
        data: { count: draftJournals },
      });
    }

    // 5. Payroll cost check
    const { data: recentPayroll } = await supabase
      .from("payroll_runs")
      .select("total_gross, period_month, period_year")
      .eq("tenant_id", tenant_id)
      .in("status", ["calculated", "approved", "paid"])
      .order("period_year", { ascending: false })
      .order("period_month", { ascending: false })
      .limit(3);

    if (recentPayroll && recentPayroll.length >= 2) {
      const latest = Number(recentPayroll[0].total_gross);
      const prev = Number(recentPayroll[1].total_gross);
      if (prev > 0) {
        const change = ((latest - prev) / prev) * 100;
        if (Math.abs(change) > 20) {
          insights.push({
            insight_type: "payroll_anomaly",
            severity: "warning",
            title: sr
              ? `Troškovi zarada ${change > 0 ? "porasli" : "pali"} ${Math.abs(change).toFixed(0)}%`
              : `Payroll Costs ${change > 0 ? "Up" : "Down"} ${Math.abs(change).toFixed(0)}%`,
            description: sr
              ? `Troškovi zarada su se promenili za ${change.toFixed(1)}% u poslednja 2 meseca.`
              : `Payroll costs changed by ${change.toFixed(1)}% over the last 2 months.`,
            data: { change_percent: change, latest, previous: prev },
          });
        }
      }
    }

    // Cache insights (delete old, insert new)
    await supabase.from("ai_insights_cache").delete().eq("tenant_id", tenant_id);
    if (insights.length > 0) {
      await supabase.from("ai_insights_cache").insert(
        insights.map(i => ({ tenant_id, ...i }))
      );
    }

    // If no insights, return a positive message
    if (insights.length === 0) {
      insights.push({
        insight_type: "all_clear",
        severity: "info",
        title: sr ? "Sve je u redu" : "All Clear",
        description: sr
          ? "Nema uočenih anomalija. Vaš sistem radi normalno."
          : "No anomalies detected. Your system is running smoothly.",
        data: {},
      });
    }

    return new Response(JSON.stringify({ insights }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-insights error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
