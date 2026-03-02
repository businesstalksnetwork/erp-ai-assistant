import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/error-handler.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";

interface ComplianceCheck {
  id: string; category: "journal" | "vat" | "invoicing" | "payroll" | "assets" | "reporting" | "general";
  severity: "error" | "warning" | "info"; title: string; title_sr: string; description: string; description_sr: string;
  law_reference: string; affected_count: number; details?: any;
}

async function runComplianceChecks(supabase: any, tenantId: string): Promise<ComplianceCheck[]> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) { throw new Error("Invalid tenant_id format"); }
  const checks: ComplianceCheck[] = [];
  const today = new Date().toISOString().split("T")[0];
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // 1. Journal Entry Checks
  // 1.1: Check for missing journal entries for specific periods
  const { data: missingJournalEntries } = await supabase.from("missing_journal_entry_periods").select("*").eq("tenant_id", tenantId);
  if (missingJournalEntries && missingJournalEntries.length > 0) {
    missingJournalEntries.forEach((entry) => {
      checks.push({
        id: `1.1-${entry.year}-${entry.month}`,
        category: "journal",
        severity: "error",
        title: "Nedostaje knjižno odobrenje",
        title_sr: "Nedostaje knjižno odobrenje",
        description: `Nema knjižnog odobrenja za ${entry.month}/${entry.year}`,
        description_sr: `Nema knjižnog odobrenja za ${entry.month}/${entry.year}`,
        law_reference: "Zakon o računovodstvu",
        affected_count: 1,
        details: entry,
      });
    });
  }

  // 1.2: Check for unbalanced journal entries
  const { data: unbalancedJournalEntries } = await supabase.from("journal_entries").select("id, entry_date, description, journal_entry_lines(amount, type)").eq("tenant_id", tenantId);
  if (unbalancedJournalEntries && unbalancedJournalEntries.length > 0) {
    unbalancedJournalEntries.forEach((entry: any) => {
      let debitSum = 0; let creditSum = 0;
      entry.journal_entry_lines.forEach((line: any) => {
        if (line.type === "debit") { debitSum += line.amount; } else if (line.type === "credit") { creditSum += line.amount; }
      });
      if (Math.abs(debitSum - creditSum) > 0.01) {
        checks.push({
          id: `1.2-${entry.id}`,
          category: "journal",
          severity: "error",
          title: "Neuravnoteženi unos",
          title_sr: "Neuravnoteženi unos",
          description: `Debitni i kreditni računi nisu jednaki za unos ${entry.id}`,
          description_sr: `Debitni i kreditni računi nisu jednaki za unos ${entry.id}`,
          law_reference: "Zakon o računovodstvu",
          affected_count: 1,
          details: { entryId: entry.id, debitSum, creditSum },
        });
      }
    });
  }

  // 1.3: Check for journal entries without supporting documents
  const { data: entriesWithoutDocs } = await supabase.from("journal_entries").select("id, entry_date, description").eq("tenant_id", tenantId).is("supporting_document_url", null);
  if (entriesWithoutDocs && entriesWithoutDocs.length > 0) {
    entriesWithoutDocs.forEach((entry: any) => {
      checks.push({
        id: `1.3-${entry.id}`,
        category: "journal",
        severity: "warning",
        title: "Unos bez prateće dokumentacije",
        title_sr: "Unos bez prateće dokumentacije",
        description: `Unos ${entry.id} nema prateću dokumentaciju`,
        description_sr: `Unos ${entry.id} nema prateću dokumentaciju`,
        law_reference: "Zakon o računovodstvu",
        affected_count: 1,
        details: { entryId: entry.id },
      });
    });
  }

  // 2. VAT Checks
  // 2.1: Check for late VAT returns
  const { data: lateVatReturns } = await supabase.from("vat_returns").select("*").eq("tenant_id", tenantId).lt("due_date", today).eq("status", "pending");
  if (lateVatReturns && lateVatReturns.length > 0) {
    lateVatReturns.forEach((vatReturn) => {
      checks.push({
        id: `2.1-${vatReturn.id}`,
        category: "vat",
        severity: "error",
        title: "Zakašnjelo prijava PDV-a",
        title_sr: "Zakašnjelo prijava PDV-a",
        description: `Prijava PDV-a za period ${vatReturn.period_start} - ${vatReturn.period_end} je zakašnjela`,
        description_sr: `Prijava PDV-a za period ${vatReturn.period_start} - ${vatReturn.period_end} je zakašnjela`,
        law_reference: "Zakon o PDV-u",
        affected_count: 1,
        details: vatReturn,
      });
    });
  }

  // 2.2: Check for discrepancies between VAT collected and VAT paid
  const { data: vatDiscrepancies } = await supabase.from("vat_returns").select("*").eq("tenant_id", tenantId).lt("due_date", today);
  if (vatDiscrepancies && vatDiscrepancies.length > 0) {
    vatDiscrepancies.forEach((vatReturn: any) => {
      const vatCollected = vatReturn.vat_collected || 0;
      const vatPaid = vatReturn.vat_paid || 0;
      const discrepancy = vatCollected - vatPaid;
      if (Math.abs(discrepancy) > 100) {
        checks.push({
          id: `2.2-${vatReturn.id}`,
          category: "vat",
          severity: "warning",
          title: "Razlika u PDV-u",
          title_sr: "Razlika u PDV-u",
          description: `Postoji značajna razlika između naplaćenog i plaćenog PDV-a za period ${vatReturn.period_start} - ${vatReturn.period_end}`,
          description_sr: `Postoji značajna razlika između naplaćenog i plaćenog PDV-a za period ${vatReturn.period_start} - ${vatReturn.period_end}`,
          law_reference: "Zakon o PDV-u",
          affected_count: 1,
          details: { vatReturnId: vatReturn.id, vatCollected, vatPaid, discrepancy },
        });
      }
    });
  }

  // 2.3: Check for VAT IDs on invoices
  const { data: invoicesWithoutVatIds } = await supabase.from("invoices").select("id, invoice_number, client_name").eq("tenant_id", tenantId).is("client_vat_id", null);
  if (invoicesWithoutVatIds && invoicesWithoutVatIds.length > 0) {
    invoicesWithoutVatIds.forEach((invoice: any) => {
      checks.push({
        id: `2.3-${invoice.id}`,
        category: "vat",
        severity: "info",
        title: "Faktura bez PDV ID-a",
        title_sr: "Faktura bez PDV ID-a",
        description: `Faktura ${invoice.invoice_number} za klijenta ${invoice.client_name} nema PDV ID`,
        description_sr: `Faktura ${invoice.invoice_number} za klijenta ${invoice.client_name} nema PDV ID`,
        law_reference: "Zakon o PDV-u",
        affected_count: 1,
        details: { invoiceId: invoice.id, invoiceNumber: invoice.invoice_number, clientName: invoice.client_name },
      });
    });
  }

  // 3. Invoicing Checks
  // 3.1: Check for overdue invoices
  const { data: overdueInvoices } = await supabase.from("invoices").select("id, invoice_number, client_name, due_date").eq("tenant_id", tenantId).lt("due_date", today).eq("status", "unpaid");
  if (overdueInvoices && overdueInvoices.length > 0) {
    overdueInvoices.forEach((invoice: any) => {
      checks.push({
        id: `3.1-${invoice.id}`,
        category: "invoicing",
        severity: "warning",
        title: "Zakašnjela faktura",
        title_sr: "Zakašnjela faktura",
        description: `Faktura ${invoice.invoice_number} za klijenta ${invoice.client_name} je zakašnjela`,
        description_sr: `Faktura ${invoice.invoice_number} za klijenta ${invoice.client_name} je zakašnjela`,
        law_reference: "Zakon o obligacionim odnosima",
        affected_count: 1,
        details: { invoiceId: invoice.id, invoiceNumber: invoice.invoice_number, clientName: invoice.client_name, dueDate: invoice.due_date },
      });
    });
  }

  // 3.2: Check for invoices without a specified payment method
  const { data: invoicesWithoutPaymentMethod } = await supabase.from("invoices").select("id, invoice_number, client_name").eq("tenant_id", tenantId).is("payment_method", null);
  if (invoicesWithoutPaymentMethod && invoicesWithoutPaymentMethod.length > 0) {
    invoicesWithoutPaymentMethod.forEach((invoice: any) => {
      checks.push({
        id: `3.2-${invoice.id}`,
        category: "invoicing",
        severity: "info",
        title: "Faktura bez načina plaćanja",
        title_sr: "Faktura bez načina plaćanja",
        description: `Faktura ${invoice.invoice_number} za klijenta ${invoice.client_name} nema specificiran način plaćanja`,
        description_sr: `Faktura ${invoice.invoice_number} za klijenta ${invoice.client_name} nema specificiran način plaćanja`,
        law_reference: "Zakon o obligacionim odnosima",
        affected_count: 1,
        details: { invoiceId: invoice.id, invoiceNumber: invoice.invoice_number, clientName: invoice.client_name },
      });
    });
  }

  // 4. Payroll Checks
  // 4.1: Check for missing payroll records for employees
  const firstDayOfYear = `${currentYear}-01-01`;
  const { data: employeesWithoutPayroll } = await supabase.from("employees").select("id, full_name").eq("tenant_id", tenantId);
  if (employeesWithoutPayroll && employeesWithoutPayroll.length > 0) {
    for (const employee of employeesWithoutPayroll) {
      const { data: payrollExists } = await supabase.from("payroll_records").select("id").eq("employee_id", employee.id).gte("payment_date", firstDayOfYear).limit(1);
      if (!payrollExists || payrollExists.length === 0) {
        checks.push({
          id: `4.1-${employee.id}`,
          category: "payroll",
          severity: "warning",
          title: "Nedostaju isplate zarada",
          title_sr: "Nedostaju isplate zarada",
          description: `Nema isplate zarade za ${employee.full_name} u ${currentYear}`,
          description_sr: `Nema isplate zarade za ${employee.full_name} u ${currentYear}`,
          law_reference: "Zakon o radu",
          affected_count: 1,
          details: { employeeId: employee.id, employeeName: employee.full_name },
        });
      }
    }
  }

  // 4.2: Check for employees without a contract
  const { data: employeesWithoutContracts } = await supabase.from("employees").select("id, full_name").eq("tenant_id", tenantId).is("employment_contract_url", null);
  if (employeesWithoutContracts && employeesWithoutContracts.length > 0) {
    employeesWithoutContracts.forEach((employee: any) => {
      checks.push({
        id: `4.2-${employee.id}`,
        category: "payroll",
        severity: "info",
        title: "Zaposleni bez ugovora",
        title_sr: "Zaposleni bez ugovora",
        description: `Zaposleni ${employee.full_name} nema ugovor o radu`,
        description_sr: `Zaposleni ${employee.full_name} nema ugovor o radu`,
        law_reference: "Zakon o radu",
        affected_count: 1,
        details: { employeeId: employee.id, employeeName: employee.full_name },
      });
    });
  }

  // 5. Assets Checks
  // 5.1: Check for assets without depreciation records
  const { data: assetsWithoutDepreciation } = await supabase.from("assets").select("id, name, purchase_date").eq("tenant_id", tenantId);
  if (assetsWithoutDepreciation && assetsWithoutDepreciation.length > 0) {
    for (const asset of assetsWithoutDepreciation) {
      const { data: depreciationExists } = await supabase.from("depreciation_records").select("id").eq("asset_id", asset.id).gte("depreciation_date", firstDayOfYear).limit(1);
      if (!depreciationExists || depreciationExists.length === 0) {
        checks.push({
          id: `5.1-${asset.id}`,
          category: "assets",
          severity: "warning",
          title: "Nedostaje amortizacija",
          title_sr: "Nedostaje amortizacija",
          description: `Nema amortizacije za imovinu ${asset.name} u ${currentYear}`,
          description_sr: `Nema amortizacije za imovinu ${asset.name} u ${currentYear}`,
          law_reference: "Zakon o porezu na dobit",
          affected_count: 1,
          details: { assetId: asset.id, assetName: asset.name },
        });
      }
    }
  }

  // 6. Reporting Checks
  // 6.1: Check for missing annual financial reports
  const { data: missingFinancialReports } = await supabase.from("financial_reports").select("*").eq("tenant_id", tenantId).eq("year", currentYear - 1);
  if (!missingFinancialReports || missingFinancialReports.length === 0) {
    checks.push({
      id: `6.1-${currentYear - 1}`,
      category: "reporting",
      severity: "error",
      title: "Nedostaje godišnji finansijski izveštaj",
      title_sr: "Nedostaje godišnji finansijski izveštaj",
      description: `Nema finansijskog izveštaja za ${currentYear - 1}`,
      description_sr: `Nema finansijskog izveštaja za ${currentYear - 1}`,
      law_reference: "Zakon o računovodstvu",
      affected_count: 1,
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

    const { tenant_id } = await req.json();
    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id required" }), { status: 400, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });
    }

    const { data: membership } = await supabase.from("tenant_members").select("id").eq("tenant_id", tenant_id).eq("user_id", user.id).eq("status", "active").maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });
    }

    const checks = await runComplianceChecks(supabase, tenant_id);

    // CR7-06: Audit log for compliance checker
    try {
      await supabase.from("ai_action_log").insert({
        tenant_id: tenant_id,
        user_id: user.id,
        action_type: "compliance_check",
        module: "compliance",
        model_version: "rule-based",
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
