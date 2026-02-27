import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ════════════════════════════════════════════
// Serbian Accounting Law Knowledge Base
// Zakon o računovodstvu (Sl. glasnik RS, br. 73/2019, 44/2021, 138/2022)
// Zakon o porezu na dodatu vrednost
// Pravilnik o kontnom okviru
// ════════════════════════════════════════════

interface ComplianceCheck {
  id: string;
  category: "journal" | "vat" | "invoicing" | "payroll" | "assets" | "reporting" | "general";
  severity: "error" | "warning" | "info";
  title: string;
  title_sr: string;
  description: string;
  description_sr: string;
  law_reference: string;
  affected_count: number;
  details?: any;
}

async function runComplianceChecks(supabase: any, tenantId: string): Promise<ComplianceCheck[]> {
  const checks: ComplianceCheck[] = [];
  const today = new Date().toISOString().split("T")[0];
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // ─── 1. JOURNAL ENTRY CHECKS ───

  // 1.1 Unbalanced journal entries (DR ≠ CR)
  try {
    const { data: unbalanced } = await supabase.rpc("execute_readonly_query", {
      query_text: `
        SELECT je.id, je.entry_number, je.entry_date,
          COALESCE(SUM(jl.debit), 0) as total_debit,
          COALESCE(SUM(jl.credit), 0) as total_credit
        FROM journal_entries je
        JOIN journal_lines jl ON jl.journal_entry_id = je.id
        WHERE je.tenant_id = '${tenantId}' AND je.status = 'posted'
        GROUP BY je.id, je.entry_number, je.entry_date
        HAVING ABS(COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0)) > 0.01
        LIMIT 20
      `,
    });
    if (unbalanced && unbalanced.length > 0) {
      checks.push({
        id: "JE_UNBALANCED",
        category: "journal",
        severity: "error",
        title: "Unbalanced journal entries detected",
        title_sr: "Nebalansirani nalozi za knjiženje",
        description: `${unbalanced.length} posted journal entries have debit ≠ credit, violating double-entry principle.`,
        description_sr: `${unbalanced.length} proknjiženih naloga ima duguje ≠ potražuje, što krši princip dvojnog knjiženja.`,
        law_reference: "Zakon o računovodstvu, čl. 9 — Sistem dvojnog knjiženja",
        affected_count: unbalanced.length,
        details: unbalanced.slice(0, 5),
      });
    }
  } catch (e) { console.warn("Check 1.1 failed:", e); }

  // 1.2 Journal entries without description
  try {
    const { count: noDescCount } = await supabase
      .from("journal_entries")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "posted")
      .or("description.is.null,description.eq.");

    if (noDescCount && noDescCount > 0) {
      checks.push({
        id: "JE_NO_DESCRIPTION",
        category: "journal",
        severity: "warning",
        title: "Journal entries without description",
        title_sr: "Nalozi bez opisa knjiženja",
        description: `${noDescCount} posted entries lack a description. Serbian law requires each entry to have clear documentation.`,
        description_sr: `${noDescCount} proknjiženih naloga nema opis. Zakon zahteva da svaki nalog ima jasnu dokumentaciju.`,
        law_reference: "Zakon o računovodstvu, čl. 8 — Sadržaj računovodstvene isprave",
        affected_count: noDescCount,
      });
    }
  } catch (e) { console.warn("Check 1.2 failed:", e); }

  // 1.3 Journal entries posted to future dates
  try {
    const { data: futureEntries, count: futureCount } = await supabase
      .from("journal_entries")
      .select("id, entry_number, entry_date", { count: "exact" })
      .eq("tenant_id", tenantId)
      .eq("status", "posted")
      .gt("entry_date", today)
      .limit(5);

    if (futureCount && futureCount > 0) {
      checks.push({
        id: "JE_FUTURE_DATE",
        category: "journal",
        severity: "warning",
        title: "Journal entries with future dates",
        title_sr: "Nalozi sa budućim datumima",
        description: `${futureCount} posted entries have dates in the future, which may indicate data entry errors.`,
        description_sr: `${futureCount} proknjiženih naloga ima datume u budućnosti, što može ukazivati na grešku.`,
        law_reference: "Zakon o računovodstvu, čl. 10 — Rokovi knjiženja",
        affected_count: futureCount,
        details: futureEntries,
      });
    }
  } catch (e) { console.warn("Check 1.3 failed:", e); }

  // ─── 2. VAT / PDV CHECKS ───

  // 2.1 Invoices without VAT where required
  try {
    const { data: noVatInvoices, count: noVatCount } = await supabase
      .from("invoices")
      .select("id, invoice_number, partner_name, total", { count: "exact" })
      .eq("tenant_id", tenantId)
      .in("status", ["sent", "paid", "posted"])
      .or("tax.is.null,tax.eq.0")
      .gt("total", 0)
      .limit(10);

    if (noVatCount && noVatCount > 5) {
      checks.push({
        id: "VAT_MISSING_ON_INVOICES",
        category: "vat",
        severity: "warning",
        title: "Invoices with zero VAT",
        title_sr: "Fakture bez PDV-a",
        description: `${noVatCount} invoices have zero tax. Verify these are legitimately VAT-exempt (export, exempt activity, etc.).`,
        description_sr: `${noVatCount} faktura nema obračunat PDV. Proverite da li su legitimno oslobođene (izvoz, oslobođena delatnost itd.).`,
        law_reference: "Zakon o PDV, čl. 24, 25 — Poreska oslobođenja",
        affected_count: noVatCount,
      });
    }
  } catch (e) { console.warn("Check 2.1 failed:", e); }

  // 2.2 PDV period not submitted on time (15th of following month)
  try {
    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

    if (new Date().getDate() > 15) {
      const { data: unsubmitted } = await supabase
        .from("pdv_periods")
        .select("id, period_month, period_year, status")
        .eq("tenant_id", tenantId)
        .eq("period_month", prevMonth)
        .eq("period_year", prevYear)
        .neq("status", "submitted")
        .neq("status", "closed")
        .maybeSingle();

      if (unsubmitted) {
        checks.push({
          id: "VAT_LATE_SUBMISSION",
          category: "vat",
          severity: "error",
          title: `VAT return for ${prevMonth}/${prevYear} not submitted`,
          title_sr: `PDV prijava za ${prevMonth}/${prevYear} nije podneta`,
          description: `The VAT return deadline (15th of following month) has passed and the period is still not submitted.`,
          description_sr: `Rok za podnošenje PDV prijave (15. u narednom mesecu) je prošao, a period još nije podnet.`,
          law_reference: "Zakon o PDV, čl. 50 — Podnošenje poreske prijave",
          affected_count: 1,
        });
      }
    }
  } catch (e) { console.warn("Check 2.2 failed:", e); }

  // 2.3 Output VAT account (4700) balance mismatch
  try {
    const { data: vatAccount } = await supabase
      .from("chart_of_accounts")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("code", "4700")
      .maybeSingle();

    if (vatAccount) {
      const { data: vatBalance } = await supabase.rpc("execute_readonly_query", {
        query_text: `
          SELECT COALESCE(SUM(credit), 0) - COALESCE(SUM(debit), 0) as balance
          FROM journal_lines jl
          JOIN journal_entries je ON je.id = jl.journal_entry_id
          WHERE jl.account_id = '${vatAccount.id}' AND je.tenant_id = '${tenantId}' AND je.status = 'posted'
            AND je.entry_date >= '${currentYear}-01-01'
        `,
      });

      const { data: invoiceVat } = await supabase.rpc("execute_readonly_query", {
        query_text: `
          SELECT COALESCE(SUM(tax), 0) as total_vat
          FROM invoices
          WHERE tenant_id = '${tenantId}' AND status IN ('paid', 'posted')
            AND invoice_date >= '${currentYear}-01-01'
        `,
      });

      const glVat = Number(vatBalance?.[0]?.balance || 0);
      const invVat = Number(invoiceVat?.[0]?.total_vat || 0);
      const diff = Math.abs(glVat - invVat);

      if (diff > 1 && invVat > 0) {
        const pctDiff = ((diff / invVat) * 100).toFixed(1);
        checks.push({
          id: "VAT_GL_MISMATCH",
          category: "vat",
          severity: diff / invVat > 0.05 ? "error" : "warning",
          title: "VAT account vs invoice total mismatch",
          title_sr: "Razlika PDV konta i faktura",
          description: `GL account 4700 balance (${glVat.toFixed(2)}) differs from invoice VAT total (${invVat.toFixed(2)}) by ${pctDiff}%.`,
          description_sr: `Saldo konta 4700 (${glVat.toFixed(2)}) razlikuje se od ukupnog PDV-a na fakturama (${invVat.toFixed(2)}) za ${pctDiff}%.`,
          law_reference: "Pravilnik o kontnom okviru — Konto 4700 Obaveze za PDV",
          affected_count: 1,
          details: { gl_balance: glVat, invoice_total: invVat, difference: diff },
        });
      }
    }
  } catch (e) { console.warn("Check 2.3 failed:", e); }

  // ─── 3. INVOICING CHECKS ───

  // 3.1 Invoice numbering gaps
  try {
    const { data: gaps } = await supabase.rpc("execute_readonly_query", {
      query_text: `
        WITH numbered AS (
          SELECT invoice_number, ROW_NUMBER() OVER (ORDER BY invoice_number) as rn
          FROM invoices WHERE tenant_id = '${tenantId}' AND invoice_number ~ '^[0-9]+$'
            AND invoice_date >= '${currentYear}-01-01'
        )
        SELECT a.invoice_number as prev_num, b.invoice_number as next_num,
          CAST(b.invoice_number AS BIGINT) - CAST(a.invoice_number AS BIGINT) - 1 as gap_size
        FROM numbered a JOIN numbered b ON b.rn = a.rn + 1
        WHERE CAST(b.invoice_number AS BIGINT) - CAST(a.invoice_number AS BIGINT) > 1
        LIMIT 10
      `,
    });
    if (gaps && gaps.length > 0) {
      const totalGaps = gaps.reduce((s: number, g: any) => s + Number(g.gap_size), 0);
      checks.push({
        id: "INV_NUMBER_GAPS",
        category: "invoicing",
        severity: "error",
        title: `${gaps.length} invoice numbering gaps (${totalGaps} missing)`,
        title_sr: `${gaps.length} prekida u numeraciji faktura (${totalGaps} nedostaje)`,
        description: `Serbian law requires sequential invoice numbering without gaps within a fiscal year.`,
        description_sr: `Zakon zahteva neprekidnu numeraciju faktura bez preskakanja u okviru poreskog perioda.`,
        law_reference: "Zakon o PDV, čl. 42 — Sadržaj računa; Pravilnik o računima",
        affected_count: gaps.length,
        details: gaps.slice(0, 5),
      });
    }
  } catch (e) { console.warn("Check 3.1 failed:", e); }

  // 3.2 Invoices missing required fields (PIB, address)
  try {
    const { count: noPibCount } = await supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .in("status", ["sent", "paid", "posted"])
      .or("partner_pib.is.null,partner_pib.eq.");

    if (noPibCount && noPibCount > 0) {
      checks.push({
        id: "INV_MISSING_PIB",
        category: "invoicing",
        severity: "warning",
        title: `${noPibCount} invoices missing partner PIB`,
        title_sr: `${noPibCount} faktura bez PIB-a partnera`,
        description: `VAT invoices must include the buyer's PIB (tax ID number) for domestic B2B transactions.`,
        description_sr: `PDV fakture moraju sadržati PIB kupca za domaće B2B transakcije.`,
        law_reference: "Zakon o PDV, čl. 42, st. 4 — Obavezni podaci na računu",
        affected_count: noPibCount,
      });
    }
  } catch (e) { console.warn("Check 3.2 failed:", e); }

  // ─── 4. PAYROLL CHECKS ───

  // 4.1 Payroll not calculated for current month (after 25th)
  try {
    if (new Date().getDate() >= 25) {
      const { count: payrollCount } = await supabase
        .from("payroll_runs")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("period_month", currentMonth)
        .eq("period_year", currentYear);

      if (!payrollCount || payrollCount === 0) {
        checks.push({
          id: "PAYROLL_NOT_CALCULATED",
          category: "payroll",
          severity: "warning",
          title: `Payroll for ${currentMonth}/${currentYear} not calculated`,
          title_sr: `Plate za ${currentMonth}/${currentYear} nisu obračunate`,
          description: `Payroll must be processed before month end per labor law requirements.`,
          description_sr: `Plate moraju biti obračunate pre kraja meseca u skladu sa Zakonom o radu.`,
          law_reference: "Zakon o radu, čl. 110 — Rokovi za isplatu zarade",
          affected_count: 1,
        });
      }
    }
  } catch (e) { console.warn("Check 4.1 failed:", e); }

  // 4.2 Employees without active contracts
  try {
    const { data: noContract } = await supabase.rpc("execute_readonly_query", {
      query_text: `
        SELECT e.id, e.full_name FROM employees e
        WHERE e.tenant_id = '${tenantId}' AND e.status = 'active'
        AND NOT EXISTS (
          SELECT 1 FROM employee_contracts ec
          WHERE ec.employee_id = e.id AND ec.tenant_id = '${tenantId}'
          AND (ec.end_date IS NULL OR ec.end_date >= '${today}')
        )
        LIMIT 20
      `,
    });
    if (noContract && noContract.length > 0) {
      checks.push({
        id: "PAYROLL_NO_CONTRACT",
        category: "payroll",
        severity: "error",
        title: `${noContract.length} active employees without valid contracts`,
        title_sr: `${noContract.length} aktivnih zaposlenih bez važećeg ugovora`,
        description: `Active employees must have a valid employment contract on file per Serbian labor law.`,
        description_sr: `Aktivni zaposleni moraju imati važeći ugovor o radu u skladu sa Zakonom o radu.`,
        law_reference: "Zakon o radu, čl. 30 — Ugovor o radu",
        affected_count: noContract.length,
        details: noContract.slice(0, 5),
      });
    }
  } catch (e) { console.warn("Check 4.2 failed:", e); }

  // ─── 5. FIXED ASSETS CHECKS ───

  // 5.1 Assets without depreciation schedule
  try {
    const { data: noDepreciation } = await supabase.rpc("execute_readonly_query", {
      query_text: `
        SELECT a.id, a.asset_code, a.name, a.acquisition_cost
        FROM assets a
        WHERE a.tenant_id = '${tenantId}' AND a.status = 'active'
          AND a.asset_type IN ('fixed', 'intangible')
          AND a.acquisition_cost > 0
          AND NOT EXISTS (
            SELECT 1 FROM depreciation_schedules ds WHERE ds.asset_id = a.id
          )
        LIMIT 20
      `,
    });
    if (noDepreciation && noDepreciation.length > 0) {
      checks.push({
        id: "ASSET_NO_DEPRECIATION",
        category: "assets",
        severity: "warning",
        title: `${noDepreciation.length} fixed assets without depreciation schedule`,
        title_sr: `${noDepreciation.length} osnovnih sredstava bez plana amortizacije`,
        description: `Fixed assets with acquisition cost must have a depreciation schedule per accounting standards.`,
        description_sr: `Osnovna sredstva sa nabavnom vrednošću moraju imati plan amortizacije prema MRS/MSFI.`,
        law_reference: "MRS 16 — Nekretnine, postrojenja i oprema; Zakon o računovodstvu, čl. 20",
        affected_count: noDepreciation.length,
      });
    }
  } catch (e) { console.warn("Check 5.1 failed:", e); }

  // ─── 6. REPORTING CHECKS ───

  // 6.1 Trial balance not zero (revenue - expense accounts should net)
  try {
    const { data: trialBalance } = await supabase.rpc("execute_readonly_query", {
      query_text: `
        SELECT COALESCE(SUM(jl.debit), 0) as total_debit, COALESCE(SUM(jl.credit), 0) as total_credit
        FROM journal_lines jl
        JOIN journal_entries je ON je.id = jl.journal_entry_id
        WHERE je.tenant_id = '${tenantId}' AND je.status = 'posted'
          AND je.entry_date >= '${currentYear}-01-01'
      `,
    });
    if (trialBalance && trialBalance.length > 0) {
      const diff = Math.abs(Number(trialBalance[0].total_debit) - Number(trialBalance[0].total_credit));
      if (diff > 0.01) {
        checks.push({
          id: "TB_UNBALANCED",
          category: "reporting",
          severity: "error",
          title: "Trial balance is not balanced",
          title_sr: "Bruto bilans nije uravnotežen",
          description: `Total debits and credits differ by ${diff.toFixed(2)} RSD for ${currentYear}. This indicates a system error.`,
          description_sr: `Ukupno duguje i potražuje razlikuju se za ${diff.toFixed(2)} RSD u ${currentYear}. Ovo ukazuje na grešku u sistemu.`,
          law_reference: "Zakon o računovodstvu, čl. 9 — Dvojno knjiženje",
          affected_count: 1,
          details: trialBalance[0],
        });
      }
    }
  } catch (e) { console.warn("Check 6.1 failed:", e); }

  // ─── 7. GENERAL COMPLIANCE ───

  // 7.1 Legal entity missing required fields
  try {
    const { data: legalEntities } = await supabase
      .from("legal_entities")
      .select("id, name, pib, maticni_broj, address")
      .eq("tenant_id", tenantId);

    if (legalEntities) {
      const incomplete = legalEntities.filter((le: any) => !le.pib || !le.maticni_broj);
      if (incomplete.length > 0) {
        checks.push({
          id: "LEGAL_ENTITY_INCOMPLETE",
          category: "general",
          severity: "error",
          title: `${incomplete.length} legal entities missing PIB or Maticni broj`,
          title_sr: `${incomplete.length} pravnih lica bez PIB-a ili matičnog broja`,
          description: `All legal entities must have PIB and Maticni broj configured for regulatory filings.`,
          description_sr: `Sva pravna lica moraju imati PIB i matični broj za regulatorne izveštaje.`,
          law_reference: "Zakon o registraciji privrednih subjekata",
          affected_count: incomplete.length,
        });
      }
    }
  } catch (e) { console.warn("Check 7.1 failed:", e); }

  return checks;
}

// AI-powered compliance analysis
async function enrichWithAI(checks: ComplianceCheck[], language: string): Promise<{ summary: string; priority_actions: string[] }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY || checks.length === 0) {
    return { summary: "", priority_actions: [] };
  }

  try {
    const sr = language === "sr";
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a Serbian accounting compliance expert. Analyze the compliance check results and:
1. Provide a 2-3 sentence executive summary of the compliance posture
2. List 3-5 prioritized corrective actions ordered by regulatory risk
3. Reference specific Serbian laws where applicable

Respond in ${sr ? "Serbian (Latin script)" : "English"}.`,
          },
          {
            role: "user",
            content: `Compliance check results:\n${JSON.stringify(checks.map(c => ({
              id: c.id, severity: c.severity, title: sr ? c.title_sr : c.title,
              description: sr ? c.description_sr : c.description,
              law: c.law_reference, count: c.affected_count,
            })), null, 2)}`,
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "provide_compliance_summary",
            description: "Return compliance analysis summary",
            parameters: {
              type: "object",
              properties: {
                summary: { type: "string", description: "2-3 sentence executive summary" },
                priority_actions: {
                  type: "array",
                  items: { type: "string" },
                  description: "3-5 prioritized corrective actions",
                },
              },
              required: ["summary", "priority_actions"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "provide_compliance_summary" } },
      }),
    });

    if (!response.ok) return { summary: "", priority_actions: [] };

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return { summary: "", priority_actions: [] };

    return JSON.parse(toolCall.function.arguments);
  } catch (e) {
    console.warn("AI compliance enrichment failed:", e);
    return { summary: "", priority_actions: [] };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user: caller }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { tenant_id, language } = await req.json();
    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify tenant membership
    const { data: membership } = await supabase
      .from("tenant_members").select("id")
      .eq("user_id", caller.id).eq("tenant_id", tenant_id).eq("status", "active").maybeSingle();

    if (!membership) {
      const { data: isSuperAdmin } = await supabase
        .from("user_roles").select("id")
        .eq("user_id", caller.id).eq("role", "super_admin").maybeSingle();
      if (!isSuperAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const checks = await runComplianceChecks(supabase, tenant_id);

    // AI enrichment
    const { summary, priority_actions } = await enrichWithAI(checks, language || "en");

    // Log AI action
    await supabase.from("ai_action_log").insert({
      tenant_id,
      user_id: caller.id,
      action_type: "compliance_check",
      module: "accounting",
      model_version: "rule-based+gemini-3-flash",
      user_decision: "auto",
      reasoning: `Found ${checks.length} compliance issues: ${checks.filter(c => c.severity === 'error').length} errors, ${checks.filter(c => c.severity === 'warning').length} warnings`,
    }).catch(() => {});

    // Stats
    const stats = {
      total: checks.length,
      errors: checks.filter(c => c.severity === "error").length,
      warnings: checks.filter(c => c.severity === "warning").length,
      info: checks.filter(c => c.severity === "info").length,
    };

    return new Response(JSON.stringify({
      checks,
      stats,
      ai_summary: summary || undefined,
      priority_actions: priority_actions.length > 0 ? priority_actions : undefined,
      checked_at: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("compliance-checker error:", e);
    return new Response(JSON.stringify({ error: e.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
