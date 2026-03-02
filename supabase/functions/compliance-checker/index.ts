import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/error-handler.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";
import { checkRateLimit, rateLimitHeaders } from "../_shared/rate-limiter.ts";

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

/**
 * CR10-09: Batched compliance checks — eliminates N+1 queries.
 * Previously: 1 query per employee + 1 per asset (500 employees = 500+ queries).
 * Now: All checks use batch queries with JOINs or LEFT JOINs.
 */
async function runComplianceChecks(supabase: any, tenantId: string): Promise<ComplianceCheck[]> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
    throw new Error("Invalid tenant_id format");
  }
  const checks: ComplianceCheck[] = [];
  const today = new Date().toISOString().split("T")[0];
  const currentYear = new Date().getFullYear();
  const firstDayOfYear = `${currentYear}-01-01`;

  // Run all independent queries in parallel
  const [
    journalEntriesRes,
    entriesWithoutDocsRes,
    lateVatRes,
    vatDiscRes,
    invoicesNoVatRes,
    overdueInvRes,
    invoicesNoPayRes,
    employeesRes,
    employeesNoContractRes,
    assetsRes,
    financialReportsRes,
  ] = await Promise.all([
    // 1.2: All journal entries with lines for balance check
    supabase.from("journal_entries").select("id, entry_date, description, journal_entry_lines(amount, type)").eq("tenant_id", tenantId).limit(5000),
    // 1.3: Journal entries without supporting docs
    supabase.from("journal_entries").select("id, entry_date, description").eq("tenant_id", tenantId).is("supporting_document_url", null).limit(5000),
    // 2.1: Late VAT returns
    supabase.from("vat_returns").select("*").eq("tenant_id", tenantId).lt("due_date", today).eq("status", "pending").limit(5000),
    // 2.2: VAT discrepancies
    supabase.from("vat_returns").select("*").eq("tenant_id", tenantId).lt("due_date", today).limit(5000),
    // 2.3: Invoices without VAT ID
    supabase.from("invoices").select("id, invoice_number, client_name").eq("tenant_id", tenantId).is("client_vat_id", null).limit(5000),
    // 3.1: Overdue invoices
    supabase.from("invoices").select("id, invoice_number, client_name, due_date").eq("tenant_id", tenantId).lt("due_date", today).eq("status", "unpaid").limit(5000),
    // 3.2: Invoices without payment method
    supabase.from("invoices").select("id, invoice_number, client_name").eq("tenant_id", tenantId).is("payment_method", null).limit(5000),
    // 4.1: All employees (we'll batch-check payroll below)
    supabase.from("employees").select("id, full_name").eq("tenant_id", tenantId).limit(5000),
    // 4.2: Employees without contract
    supabase.from("employees").select("id, full_name").eq("tenant_id", tenantId).is("employment_contract_url", null).limit(5000),
    // 5.1: All assets (we'll batch-check depreciation below)
    supabase.from("assets").select("id, name, purchase_date").eq("tenant_id", tenantId).limit(5000),
    // 6.1: Annual financial reports
    supabase.from("financial_reports").select("*").eq("tenant_id", tenantId).eq("year", currentYear - 1).limit(5000),
  ]);

  // 1.2: Unbalanced journal entries
  const unbalanced = journalEntriesRes.data || [];
  for (const entry of unbalanced) {
    let debitSum = 0, creditSum = 0;
    (entry.journal_entry_lines || []).forEach((line: any) => {
      if (line.type === "debit") debitSum += line.amount;
      else if (line.type === "credit") creditSum += line.amount;
    });
    if (Math.abs(debitSum - creditSum) > 0.01) {
      checks.push({
        id: `1.2-${entry.id}`, category: "journal", severity: "error",
        title: "Neuravnoteženi unos", title_sr: "Neuravnoteženi unos",
        description: `Debitni i kreditni računi nisu jednaki za unos ${entry.id}`,
        description_sr: `Debitni i kreditni računi nisu jednaki za unos ${entry.id}`,
        law_reference: "Zakon o računovodstvu", affected_count: 1,
        details: { entryId: entry.id, debitSum, creditSum },
      });
    }
  }

  // 1.3: Entries without docs
  for (const entry of entriesWithoutDocsRes.data || []) {
    checks.push({
      id: `1.3-${entry.id}`, category: "journal", severity: "warning",
      title: "Unos bez prateće dokumentacije", title_sr: "Unos bez prateće dokumentacije",
      description: `Unos ${entry.id} nema prateću dokumentaciju`,
      description_sr: `Unos ${entry.id} nema prateću dokumentaciju`,
      law_reference: "Zakon o računovodstvu", affected_count: 1,
      details: { entryId: entry.id },
    });
  }

  // 2.1: Late VAT returns
  for (const vr of lateVatRes.data || []) {
    checks.push({
      id: `2.1-${vr.id}`, category: "vat", severity: "error",
      title: "Zakašnjelo prijava PDV-a", title_sr: "Zakašnjelo prijava PDV-a",
      description: `Prijava PDV-a za period ${vr.period_start} - ${vr.period_end} je zakašnjela`,
      description_sr: `Prijava PDV-a za period ${vr.period_start} - ${vr.period_end} je zakašnjela`,
      law_reference: "Zakon o PDV-u", affected_count: 1, details: vr,
    });
  }

  // 2.2: VAT discrepancies
  for (const vr of vatDiscRes.data || []) {
    const disc = (vr.vat_collected || 0) - (vr.vat_paid || 0);
    if (Math.abs(disc) > 100) {
      checks.push({
        id: `2.2-${vr.id}`, category: "vat", severity: "warning",
        title: "Razlika u PDV-u", title_sr: "Razlika u PDV-u",
        description: `Postoji značajna razlika između naplaćenog i plaćenog PDV-a za period ${vr.period_start} - ${vr.period_end}`,
        description_sr: `Postoji značajna razlika između naplaćenog i plaćenog PDV-a za period ${vr.period_start} - ${vr.period_end}`,
        law_reference: "Zakon o PDV-u", affected_count: 1,
        details: { vatReturnId: vr.id, vatCollected: vr.vat_collected, vatPaid: vr.vat_paid, discrepancy: disc },
      });
    }
  }

  // 2.3: Invoices without VAT ID
  for (const inv of invoicesNoVatRes.data || []) {
    checks.push({
      id: `2.3-${inv.id}`, category: "vat", severity: "info",
      title: "Faktura bez PDV ID-a", title_sr: "Faktura bez PDV ID-a",
      description: `Faktura ${inv.invoice_number} za klijenta ${inv.client_name} nema PDV ID`,
      description_sr: `Faktura ${inv.invoice_number} za klijenta ${inv.client_name} nema PDV ID`,
      law_reference: "Zakon o PDV-u", affected_count: 1,
      details: { invoiceId: inv.id, invoiceNumber: inv.invoice_number, clientName: inv.client_name },
    });
  }

  // 3.1: Overdue invoices
  for (const inv of overdueInvRes.data || []) {
    checks.push({
      id: `3.1-${inv.id}`, category: "invoicing", severity: "warning",
      title: "Zakašnjela faktura", title_sr: "Zakašnjela faktura",
      description: `Faktura ${inv.invoice_number} za klijenta ${inv.client_name} je zakašnjela`,
      description_sr: `Faktura ${inv.invoice_number} za klijenta ${inv.client_name} je zakašnjela`,
      law_reference: "Zakon o obligacionim odnosima", affected_count: 1,
      details: { invoiceId: inv.id, invoiceNumber: inv.invoice_number, clientName: inv.client_name, dueDate: inv.due_date },
    });
  }

  // 3.2: Invoices without payment method
  for (const inv of invoicesNoPayRes.data || []) {
    checks.push({
      id: `3.2-${inv.id}`, category: "invoicing", severity: "info",
      title: "Faktura bez načina plaćanja", title_sr: "Faktura bez načina plaćanja",
      description: `Faktura ${inv.invoice_number} za klijenta ${inv.client_name} nema specificiran način plaćanja`,
      description_sr: `Faktura ${inv.invoice_number} za klijenta ${inv.client_name} nema specificiran način plaćanja`,
      law_reference: "Zakon o obligacionim odnosima", affected_count: 1,
      details: { invoiceId: inv.id, invoiceNumber: inv.invoice_number, clientName: inv.client_name },
    });
  }

  // 4.1: CR10-09 FIX — Batch payroll check (single query instead of N+1)
  const employees = employeesRes.data || [];
  if (employees.length > 0) {
    const employeeIds = employees.map((e: any) => e.id);
    const { data: payrollRecords } = await supabase
      .from("payroll_records")
      .select("employee_id")
      .in("employee_id", employeeIds)
      .gte("payment_date", firstDayOfYear);

    const employeesWithPayroll = new Set((payrollRecords || []).map((r: any) => r.employee_id));
    for (const emp of employees) {
      if (!employeesWithPayroll.has(emp.id)) {
        checks.push({
          id: `4.1-${emp.id}`, category: "payroll", severity: "warning",
          title: "Nedostaju isplate zarada", title_sr: "Nedostaju isplate zarada",
          description: `Nema isplate zarade za ${emp.full_name} u ${currentYear}`,
          description_sr: `Nema isplate zarade za ${emp.full_name} u ${currentYear}`,
          law_reference: "Zakon o radu", affected_count: 1,
          details: { employeeId: emp.id, employeeName: emp.full_name },
        });
      }
    }
  }

  // 4.2: Employees without contract
  for (const emp of employeesNoContractRes.data || []) {
    checks.push({
      id: `4.2-${emp.id}`, category: "payroll", severity: "info",
      title: "Zaposleni bez ugovora", title_sr: "Zaposleni bez ugovora",
      description: `Zaposleni ${emp.full_name} nema ugovor o radu`,
      description_sr: `Zaposleni ${emp.full_name} nema ugovor o radu`,
      law_reference: "Zakon o radu", affected_count: 1,
      details: { employeeId: emp.id, employeeName: emp.full_name },
    });
  }

  // 5.1: CR10-09 FIX — Batch asset depreciation check (single query instead of N+1)
  const assets = assetsRes.data || [];
  if (assets.length > 0) {
    const assetIds = assets.map((a: any) => a.id);
    const { data: depRecords } = await supabase
      .from("depreciation_records")
      .select("asset_id")
      .in("asset_id", assetIds)
      .gte("depreciation_date", firstDayOfYear);

    const assetsWithDep = new Set((depRecords || []).map((r: any) => r.asset_id));
    for (const asset of assets) {
      if (!assetsWithDep.has(asset.id)) {
        checks.push({
          id: `5.1-${asset.id}`, category: "assets", severity: "warning",
          title: "Nedostaje amortizacija", title_sr: "Nedostaje amortizacija",
          description: `Nema amortizacije za imovinu ${asset.name} u ${currentYear}`,
          description_sr: `Nema amortizacije za imovinu ${asset.name} u ${currentYear}`,
          law_reference: "Zakon o porezu na dobit", affected_count: 1,
          details: { assetId: asset.id, assetName: asset.name },
        });
      }
    }
  }

  // 6.1: Missing annual financial report
  if (!financialReportsRes.data || financialReportsRes.data.length === 0) {
    checks.push({
      id: `6.1-${currentYear - 1}`, category: "reporting", severity: "error",
      title: "Nedostaje godišnji finansijski izveštaj", title_sr: "Nedostaje godišnji finansijski izveštaj",
      description: `Nema finansijskog izveštaja za ${currentYear - 1}`,
      description_sr: `Nema finansijskog izveštaja za ${currentYear - 1}`,
      law_reference: "Zakon o računovodstvu", affected_count: 1,
      details: { year: currentYear - 1 },
    });
  }

  return checks;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authErr } = await anonClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });
    }

    // Rate limit: CRUD category (30/min)
    const rl = await checkRateLimit(`compliance-checker:${user.id}`, "crud");
    if (!rl.allowed) {
      return new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: withSecurityHeaders({ ...corsHeaders, ...rateLimitHeaders(rl.retryAfterMs!), "Content-Type": "application/json" }),
      });
    }

    const { tenant_id } = await req.json();
    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id required" }), { status: 400, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });
    }

    const { data: membership } = await supabase.from("tenant_members").select("id").eq("tenant_id", tenant_id).eq("user_id", user.id).eq("status", "active").maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });
    }

    const checks = await runComplianceChecks(supabase, tenant_id);

    // Audit log
    try {
      await supabase.from("ai_action_log").insert({
        tenant_id: tenant_id,
        user_id: user.id,
        action_type: "compliance_check",
        module: "compliance",
        model_version: "rule-based-v2",
        user_decision: "auto",
        reasoning: `Compliance check completed: ${checks.length} issues found (${checks.filter(c => c.severity === "error").length} errors, ${checks.filter(c => c.severity === "warning").length} warnings)`,
      });
    } catch (e) {
      console.warn("Failed to log AI action:", e);
    }

    return new Response(JSON.stringify({ success: true, checks }), { headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });
  } catch (err) {
    return createErrorResponse(err, req, { logPrefix: "compliance-checker" });
  }
});
