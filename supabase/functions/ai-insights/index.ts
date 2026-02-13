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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: caller }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { tenant_id, language, module } = await req.json();
    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Verify tenant membership
    const { data: membership } = await supabase
      .from("tenant_members").select("id")
      .eq("user_id", caller.id).eq("tenant_id", tenant_id).eq("status", "active").maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check cache
    const cacheKey = module ? `${tenant_id}_${module}` : tenant_id;
    const { data: cached } = await supabase
      .from("ai_insights_cache")
      .select("*")
      .eq("tenant_id", tenant_id)
      .gt("expires_at", new Date().toISOString())
      .order("generated_at", { ascending: false });

    // Filter cached by module if applicable
    if (cached && cached.length > 0 && module) {
      const moduleInsights = filterByModule(cached, module);
      if (moduleInsights.length > 0) {
        return new Response(JSON.stringify({ insights: moduleInsights }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (cached && cached.length > 0 && !module) {
      return new Response(JSON.stringify({ insights: cached }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const insights: Insight[] = [];
    const sr = language === "sr";
    const today = new Date().toISOString().split("T")[0];

    // ─── Core insights (always generated) ───

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
          ? `Imate ${overdueCount} dospelih faktura u ukupnom iznosu od ${totalOverdue.toLocaleString("sr-RS", { minimumFractionDigits: 2 })} RSD.`
          : `You have ${overdueCount} overdue invoices totaling ${totalOverdue.toLocaleString("en-US", { minimumFractionDigits: 2 })} RSD.`,
        data: { count: overdueCount, total: totalOverdue, top: overdueInvoices },
      });
    }

    // 2. Large invoices (> 3x average)
    const { data: allInvoices } = await supabase
      .from("invoices")
      .select("total, partner_name, invoice_number")
      .eq("tenant_id", tenant_id).eq("status", "paid");

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
      .eq("tenant_id", tenant_id).gt("min_stock_level", 0);

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

    // 4. Draft journal entries
    const { count: draftJournals } = await supabase
      .from("journal_entries")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant_id).eq("status", "draft");

    if (draftJournals && draftJournals > 5) {
      insights.push({
        insight_type: "draft_journals",
        severity: "info",
        title: sr ? `${draftJournals} naloga u nacrtu` : `${draftJournals} Draft Journal Entries`,
        description: sr
          ? `Imate ${draftJournals} naloga za knjiženje u statusu nacrta.`
          : `You have ${draftJournals} draft journal entries. Consider posting or deleting them.`,
        data: { count: draftJournals },
      });
    }

    // 5. Payroll anomaly
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

    // ─── Analytics-specific insights ───
    if (!module || module === "analytics") {
      // 6. Budget variance check
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;
      const { data: budgets } = await supabase
        .from("budgets")
        .select("account_id, amount, month, fiscal_year")
        .eq("tenant_id", tenant_id)
        .eq("fiscal_year", currentYear);

      if (budgets && budgets.length > 0) {
        // Get actual amounts from journal lines for current year
        const { data: journalLines } = await supabase
          .from("journal_lines")
          .select("amount, side, account_id, journal:journal_entry_id(status, entry_date)")
          .eq("tenant_id", tenant_id) as any;

        if (journalLines) {
          const actualsByAccount: Record<string, number> = {};
          for (const line of journalLines as any[]) {
            if (line.journal?.status !== "posted") continue;
            const entryDate = line.journal?.entry_date || "";
            if (!entryDate.startsWith(String(currentYear))) continue;
            const entryMonth = parseInt(entryDate.substring(5, 7));
            const key = `${line.account_id}_${entryMonth}`;
            const amt = Number(line.amount) || 0;
            const net = line.side === "debit" ? amt : -amt;
            actualsByAccount[key] = (actualsByAccount[key] || 0) + Math.abs(net);
          }

          let overBudgetCount = 0;
          for (const b of budgets) {
            if (b.month > currentMonth) continue;
            const key = `${b.account_id}_${b.month}`;
            const actual = actualsByAccount[key] || 0;
            if (b.amount > 0 && actual > b.amount * 1.2) {
              overBudgetCount++;
            }
          }

          if (overBudgetCount > 0) {
            insights.push({
              insight_type: "budget_variance",
              severity: "warning",
              title: sr ? `${overBudgetCount} konta prekoračila budžet` : `${overBudgetCount} Accounts Over Budget`,
              description: sr
                ? `${overBudgetCount} konta su prekoračila budžet za više od 20%.`
                : `${overBudgetCount} accounts have exceeded their budget by more than 20%.`,
              data: { count: overBudgetCount },
            });
          }
        }
      }

      // 7. Revenue trend (month-over-month decline for 2+ months)
      const { data: revLines } = await supabase
        .from("journal_lines")
        .select("amount, side, accounts:account_id(account_type), journal:journal_entry_id(status, entry_date)")
        .eq("tenant_id", tenant_id) as any;

      if (revLines) {
        const monthlyRev: Record<string, number> = {};
        for (const line of revLines as any[]) {
          if (line.journal?.status !== "posted" || line.accounts?.account_type !== "revenue") continue;
          const d = line.journal?.entry_date || "";
          const key = d.substring(0, 7);
          const amt = Number(line.amount) || 0;
          monthlyRev[key] = (monthlyRev[key] || 0) + (line.side === "credit" ? amt : -amt);
        }

        const months = Object.keys(monthlyRev).sort().slice(-3);
        if (months.length >= 3) {
          const vals = months.map(m => monthlyRev[m]);
          if (vals[2] < vals[1] && vals[1] < vals[0]) {
            insights.push({
              insight_type: "revenue_declining",
              severity: "warning",
              title: sr ? "Prihodi u padu 3 meseca zaredom" : "Revenue Declining 3 Months Straight",
              description: sr
                ? "Prihodi opadaju u poslednja 3 meseca. Razmotrite analizu uzroka."
                : "Revenue has been declining for 3 consecutive months. Consider investigating root causes.",
              data: { months, values: vals },
            });
          }
        }
      }
    }

    // Cache insights
    await supabase.from("ai_insights_cache").delete().eq("tenant_id", tenant_id);
    if (insights.length > 0) {
      await supabase.from("ai_insights_cache").insert(
        insights.map(i => ({ tenant_id, ...i }))
      );
    }

    // Filter by module before returning
    const filtered = module ? filterByModule(insights, module) : insights;

    if (filtered.length === 0) {
      filtered.push({
        insight_type: "all_clear",
        severity: "info",
        title: sr ? "Sve je u redu" : "All Clear",
        description: sr
          ? "Nema uočenih anomalija. Vaš sistem radi normalno."
          : "No anomalies detected. Your system is running smoothly.",
        data: {},
      });
    }

    return new Response(JSON.stringify({ insights: filtered }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-insights error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/** Filter insights by module context */
function filterByModule(insights: any[], module: string): any[] {
  const moduleMap: Record<string, string[]> = {
    analytics: ["overdue_invoices", "large_invoices", "budget_variance", "revenue_declining", "payroll_anomaly", "all_clear"],
    inventory: ["zero_stock", "low_stock", "all_clear"],
    hr: ["payroll_anomaly", "all_clear"],
    accounting: ["overdue_invoices", "large_invoices", "draft_journals", "all_clear"],
  };
  const allowed = moduleMap[module];
  if (!allowed) return insights;
  return insights.filter(i => allowed.includes(i.insight_type));
}
