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

    // Verify tenant membership (super admins bypass)
    const { data: isSuperAdmin } = await supabase
      .from("user_roles").select("id")
      .eq("user_id", caller.id).eq("role", "super_admin").maybeSingle();

    if (!isSuperAdmin) {
      const { data: membership } = await supabase
        .from("tenant_members").select("id")
        .eq("user_id", caller.id).eq("tenant_id", tenant_id).eq("status", "active").maybeSingle();
      if (!membership) {
        return new Response(JSON.stringify({ error: "Forbidden" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Check cache
    const { data: cached } = await supabase
      .from("ai_insights_cache")
      .select("*")
      .eq("tenant_id", tenant_id)
      .gt("expires_at", new Date().toISOString())
      .order("generated_at", { ascending: false });

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
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

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

    // ─── Anomaly Detection: Expense spikes ───
    if (!module || module === "analytics" || module === "accounting") {
      // Detect month-over-month expense spikes > 50%
      const { data: expenseLines } = await supabase
        .from("journal_lines")
        .select("debit, account_id, journal_entry_id")
        .eq("tenant_id", tenant_id) as any;

      if (expenseLines && expenseLines.length > 0) {
        // Get journal entries to filter by posted + date
        const jeIds = [...new Set(expenseLines.map((l: any) => l.journal_entry_id))];
        const { data: journalEntries } = await supabase
          .from("journal_entries")
          .select("id, entry_date, status")
          .eq("tenant_id", tenant_id)
          .eq("status", "posted")
          .in("id", jeIds.slice(0, 500));

        if (journalEntries) {
          const jeMap = new Map(journalEntries.map(j => [j.id, j]));
          
          // Get expense accounts
          const { data: expenseAccounts } = await supabase
            .from("chart_of_accounts")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("account_type", "expense");

          if (expenseAccounts) {
            const expenseAccountIds = new Set(expenseAccounts.map(a => a.id));
            const monthlyExpense: Record<string, number> = {};

            for (const line of expenseLines) {
              if (!expenseAccountIds.has(line.account_id)) continue;
              const je = jeMap.get(line.journal_entry_id);
              if (!je) continue;
              const month = je.entry_date.substring(0, 7);
              monthlyExpense[month] = (monthlyExpense[month] || 0) + Number(line.debit || 0);
            }

            const months = Object.keys(monthlyExpense).sort();
            if (months.length >= 2) {
              const latest = monthlyExpense[months[months.length - 1]];
              const prev = monthlyExpense[months[months.length - 2]];
              if (prev > 0 && latest > prev * 1.5) {
                const spike = ((latest - prev) / prev * 100).toFixed(0);
                insights.push({
                  insight_type: "expense_spike",
                  severity: "critical",
                  title: sr ? `Skok troškova od ${spike}%` : `Expense Spike: ${spike}% Increase`,
                  description: sr
                    ? `Troškovi u ${months[months.length - 1]} su porasli za ${spike}% u odnosu na prethodni mesec. Proverite neočekivane rashode.`
                    : `Expenses in ${months[months.length - 1]} spiked ${spike}% vs prior month. Review for unexpected charges.`,
                  data: { latest_month: months[months.length - 1], latest_amount: latest, previous_amount: prev },
                });
              }
            }
          }
        }
      }

      // Detect potential duplicate supplier invoices (same supplier + same total within 3 days)
      const { data: recentSupplierInvoices } = await supabase
        .from("supplier_invoices")
        .select("id, supplier_name, total, invoice_date, invoice_number")
        .eq("tenant_id", tenant_id)
        .order("invoice_date", { ascending: false })
        .limit(200);

      if (recentSupplierInvoices && recentSupplierInvoices.length > 1) {
        const duplicates: Array<{ supplier: string; total: number; dates: string[] }> = [];
        for (let i = 0; i < recentSupplierInvoices.length; i++) {
          for (let j = i + 1; j < recentSupplierInvoices.length; j++) {
            const a = recentSupplierInvoices[i];
            const b = recentSupplierInvoices[j];
            if (a.supplier_name === b.supplier_name && Number(a.total) === Number(b.total) && Number(a.total) > 0) {
              const daysDiff = Math.abs(new Date(a.invoice_date).getTime() - new Date(b.invoice_date).getTime()) / (1000 * 60 * 60 * 24);
              if (daysDiff <= 3) {
                duplicates.push({
                  supplier: a.supplier_name,
                  total: Number(a.total),
                  dates: [a.invoice_date, b.invoice_date],
                });
              }
            }
          }
        }

        if (duplicates.length > 0) {
          insights.push({
            insight_type: "duplicate_invoices",
            severity: "critical",
            title: sr ? `${duplicates.length} mogućih duplikata faktura` : `${duplicates.length} Potential Duplicate Invoices`,
            description: sr
              ? `Pronađene su ${duplicates.length} parova faktura od istog dobavljača sa istim iznosom unutar 3 dana.`
              : `Found ${duplicates.length} invoice pairs from the same supplier with matching amounts within 3 days.`,
            data: { count: duplicates.length, samples: duplicates.slice(0, 3) },
          });
        }
      }

      // Unusual posting patterns: journal entries posted on weekends
      const { data: weekendPostings } = await supabase
        .from("journal_entries")
        .select("id, entry_date, description")
        .eq("tenant_id", tenant_id)
        .eq("status", "posted")
        .order("entry_date", { ascending: false })
        .limit(100);

      if (weekendPostings) {
        const weekendEntries = weekendPostings.filter(je => {
          const day = new Date(je.entry_date).getDay();
          return day === 0 || day === 6;
        });

        if (weekendEntries.length >= 5) {
          insights.push({
            insight_type: "weekend_postings",
            severity: "warning",
            title: sr ? `${weekendEntries.length} knjiženja vikendom` : `${weekendEntries.length} Weekend Postings`,
            description: sr
              ? `${weekendEntries.length} naloga je knjiženo vikendom. Ovo može ukazivati na neovlašćena knjiženja.`
              : `${weekendEntries.length} journal entries were posted on weekends. This may indicate unauthorized postings.`,
            data: { count: weekendEntries.length },
          });
        }
      }
    }

    // ─── Dormant accounts alert ───
    if (!module || module === "crm") {
      const { data: dormantPartners, count: dormantCount } = await supabase
        .from("partners")
        .select("id, name", { count: "exact" })
        .eq("tenant_id", tenant_id)
        .eq("dormancy_status", "dormant")
        .eq("is_active", true)
        .limit(5);

      if (dormantCount && dormantCount > 0) {
        insights.push({
          insight_type: "dormant_accounts",
          severity: "warning",
          title: sr ? `${dormantCount} neaktivnih partnera` : `${dormantCount} Dormant Partner Accounts`,
          description: sr
            ? `${dormantCount} aktivnih partnera je klasifikovano kao neaktivno. Razmotrite reaktivaciju ili deaktivaciju.`
            : `${dormantCount} active partners are classified as dormant. Consider re-engagement or deactivation.`,
          data: { count: dormantCount, samples: dormantPartners?.map(p => p.name) },
        });
      }

      const { data: atRiskPartners, count: atRiskCount } = await supabase
        .from("partners")
        .select("id, name", { count: "exact" })
        .eq("tenant_id", tenant_id)
        .eq("dormancy_status", "at_risk")
        .eq("is_active", true)
        .limit(5);

      if (atRiskCount && atRiskCount > 0) {
        insights.push({
          insight_type: "at_risk_accounts",
          severity: "warning",
          title: sr ? `${atRiskCount} partnera u riziku` : `${atRiskCount} At-Risk Partners`,
          description: sr
            ? `${atRiskCount} partnera je u riziku od gubitka. Preporučujemo hitno kontaktiranje.`
            : `${atRiskCount} partners are at risk of churning. Recommend immediate outreach.`,
          data: { count: atRiskCount },
        });
      }
    }

    // ─── Inventory-specific insights ───
    if (!module || module === "inventory") {
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const { data: recentMovements } = await supabase
        .from("inventory_movements")
        .select("product_id")
        .eq("tenant_id", tenant_id)
        .in("movement_type", ["sale", "transfer_out", "production_consume"])
        .gte("created_at", ninetyDaysAgo);

      if (recentMovements && lowStock) {
        const movedProductIds = new Set(recentMovements.map(m => m.product_id));
        const slowMovers = lowStock.filter(s => Number(s.quantity_on_hand) > 0 && !movedProductIds.has(s.product_id));
        if (slowMovers.length > 0) {
          insights.push({
            insight_type: "slow_moving",
            severity: "info",
            title: sr ? `${slowMovers.length} artikala bez prometa 90+ dana` : `${slowMovers.length} Slow-Moving Items (90+ days)`,
            description: sr
              ? `${slowMovers.length} artikala sa zalihama nema izlaznih kretanja u poslednjih 90 dana.`
              : `${slowMovers.length} items with stock have had no outbound movements in the last 90 days.`,
            data: { count: slowMovers.length },
          });
        }
      }

      if (lowStock) {
        const belowMin = lowStock.filter(s => Number(s.quantity_on_hand) > 0 && Number(s.quantity_on_hand) < Number(s.min_stock_level));
        if (belowMin.length > 3) {
          insights.push({
            insight_type: "reorder_suggestion",
            severity: "warning",
            title: sr ? `${belowMin.length} artikala treba dopuniti` : `${belowMin.length} Items Need Reordering`,
            description: sr
              ? `${belowMin.length} artikala je ispod minimalnog nivoa. Preporučujemo kreiranje nabavnih naloga.`
              : `${belowMin.length} items are below minimum levels. Consider creating purchase orders.`,
            data: { count: belowMin.length },
          });
        }
      }
    }

    // ─── HR-specific insights ───
    if (!module || module === "hr") {
      const { data: overtimeRecords } = await supabase
        .from("overtime_hours")
        .select("employee_id, hours")
        .eq("tenant_id", tenant_id)
        .eq("year", currentYear)
        .eq("month", currentMonth);

      if (overtimeRecords) {
        const excessive = overtimeRecords.filter(o => Number(o.hours) > 40);
        if (excessive.length > 0) {
          insights.push({
            insight_type: "excessive_overtime",
            severity: "warning",
            title: sr ? `${excessive.length} zaposlenih sa prekomernim prekovremenim` : `${excessive.length} Employees with Excessive Overtime`,
            description: sr
              ? `${excessive.length} zaposlenih ima više od 40 sati prekovremenog rada ovog meseca.`
              : `${excessive.length} employees have logged more than 40 overtime hours this month.`,
            data: { count: excessive.length },
          });
        }
      }

      const { data: leaveBalances } = await supabase
        .from("annual_leave_balances")
        .select("employee_id, entitled_days, carried_over_days, used_days")
        .eq("tenant_id", tenant_id)
        .eq("year", currentYear);

      if (leaveBalances) {
        const lowLeave = leaveBalances.filter(b => (b.entitled_days + b.carried_over_days - b.used_days) <= 3 && (b.entitled_days + b.carried_over_days - b.used_days) >= 0);
        if (lowLeave.length > 0) {
          insights.push({
            insight_type: "leave_balance_warning",
            severity: "info",
            title: sr ? `${lowLeave.length} zaposlenih sa malo preostalih dana` : `${lowLeave.length} Employees Low on Leave Days`,
            description: sr
              ? `${lowLeave.length} zaposlenih ima 3 ili manje preostalih dana godišnjeg odmora.`
              : `${lowLeave.length} employees have 3 or fewer remaining leave days this year.`,
            data: { count: lowLeave.length },
          });
        }
      }
    }

    // ─── CRM-specific insights ───
    if (!module || module === "crm") {
      const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

      const { count: staleCount } = await supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant_id)
        .eq("status", "new")
        .lt("created_at", fourteenDaysAgo);

      if (staleCount && staleCount > 0) {
        insights.push({
          insight_type: "stale_leads",
          severity: "warning",
          title: sr ? `${staleCount} neaktivnih lead-ova` : `${staleCount} Stale Leads`,
          description: sr
            ? `${staleCount} lead-ova je u statusu "novi" više od 14 dana bez akcije.`
            : `${staleCount} leads have been in "new" status for over 14 days without any action.`,
          data: { count: staleCount },
        });
      }

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: atRiskDeals } = await supabase
        .from("opportunities")
        .select("id, name, value")
        .eq("tenant_id", tenant_id)
        .eq("stage", "negotiation")
        .lt("updated_at", sevenDaysAgo);

      if (atRiskDeals && atRiskDeals.length > 0) {
        const totalAtRisk = atRiskDeals.reduce((s, d) => s + Number(d.value || 0), 0);
        insights.push({
          insight_type: "high_value_at_risk",
          severity: "critical",
          title: sr ? `${atRiskDeals.length} poslova u riziku` : `${atRiskDeals.length} High-Value Deals at Risk`,
          description: sr
            ? `${atRiskDeals.length} poslova u fazi pregovaranja nisu ažurirana 7+ dana (ukupno ${totalAtRisk.toLocaleString("sr-RS")} RSD).`
            : `${atRiskDeals.length} negotiation-stage deals haven't been updated in 7+ days (total ${totalAtRisk.toLocaleString("en-US")} RSD).`,
          data: { count: atRiskDeals.length, totalValue: totalAtRisk },
        });
      }
    }

    // ─── Analytics-specific insights ───
    if (!module || module === "analytics") {
      const { data: budgets } = await supabase
        .from("budgets")
        .select("account_id, amount, month, fiscal_year")
        .eq("tenant_id", tenant_id)
        .eq("fiscal_year", currentYear);

      if (budgets && budgets.length > 0) {
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

      // Revenue trend
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
    analytics: ["overdue_invoices", "large_invoices", "budget_variance", "revenue_declining", "payroll_anomaly", "expense_spike", "duplicate_invoices", "weekend_postings", "all_clear"],
    inventory: ["zero_stock", "low_stock", "slow_moving", "reorder_suggestion", "all_clear"],
    hr: ["payroll_anomaly", "excessive_overtime", "leave_balance_warning", "all_clear"],
    crm: ["stale_leads", "high_value_at_risk", "dormant_accounts", "at_risk_accounts", "all_clear"],
    accounting: ["overdue_invoices", "large_invoices", "draft_journals", "expense_spike", "duplicate_invoices", "weekend_postings", "all_clear"],
  };
  const allowed = moduleMap[module];
  if (!allowed) return insights;
  return insights.filter(i => allowed.includes(i.insight_type));
}
