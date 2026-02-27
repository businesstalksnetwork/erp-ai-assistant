import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const formatDate = (d: string | null) => {
  if (!d) return "—";
  const dt = new Date(d);
  return `${dt.getDate().toString().padStart(2, "0")}.${(dt.getMonth() + 1).toString().padStart(2, "0")}.${dt.getFullYear()}`;
};

const formatNum = (n: number) =>
  n.toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const escapeHtml = (str: string | null | undefined): string => {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
};

const baseStyles = `
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; color: #333; margin: 40px; }
  .header { display: flex; justify-content: space-between; margin-bottom: 30px; }
  .company-info { font-size: 11px; line-height: 1.6; }
  .company-name { font-size: 18px; font-weight: bold; color: #1a1a1a; }
  .report-title { font-size: 22px; font-weight: bold; color: #2563eb; text-align: center; margin: 20px 0; }
  .report-subtitle { text-align: center; font-size: 13px; color: #666; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  th { background: #2563eb; color: white; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; }
  th.right { text-align: right; }
  td { padding: 10px 12px; border-bottom: 1px solid #eee; }
  td.right { text-align: right; font-variant-numeric: tabular-nums; }
  .totals-row { font-weight: bold; background: #f0f4ff; }
  .section-header { font-size: 16px; font-weight: bold; margin: 20px 0 10px; color: #1a1a1a; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 10px; color: #666; }
  .summary-box { margin: 20px 0; padding: 16px; background: #f8f9fa; border-radius: 6px; border-left: 4px solid #2563eb; }
  .summary-label { font-size: 11px; color: #666; text-transform: uppercase; }
  .summary-value { font-size: 20px; font-weight: bold; }
  @media print { body { margin: 20px; } }
`;

function companyHeader(legalEntity: any) {
  return `<div class="header"><div>
    <div class="company-name">${legalEntity?.name || "Company"}</div>
    <div class="company-info">
      ${legalEntity?.address ? `${legalEntity.address}<br>` : ""}
      ${legalEntity?.city ? `${legalEntity.city}, ` : ""}${legalEntity?.country || "RS"}<br>
      ${legalEntity?.pib ? `PIB: ${legalEntity.pib}<br>` : ""}
      ${legalEntity?.maticni_broj ? `Matični broj: ${legalEntity.maticni_broj}` : ""}
    </div>
  </div></div>`;
}

function wrapHtml(title: string, content: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>${baseStyles}</style></head><body>${content}<div class="footer">Izveštaj je generisan elektronski.</div></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json();
    const { type } = body;

    // Helper: verify tenant membership for financial reports
    const verifyMembership = async (tenantId: string) => {
      const { data: mem } = await admin
        .from("tenant_members").select("id")
        .eq("user_id", user!.id).eq("tenant_id", tenantId).eq("status", "active").maybeSingle();
      if (!mem) {
        return new Response(JSON.stringify({ error: "Forbidden: not a member of this tenant" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return null;
    };

    // --- Payslip (SEC-4: verify tenant membership) ---
    if (type === "payslip" && body.payroll_item_id) {
      // Fetch payroll item to get tenant_id before rendering
      const { data: payItem } = await admin
        .from("payroll_items")
        .select("payroll_runs(tenant_id)")
        .eq("id", body.payroll_item_id)
        .single();
      const payslipTenantId = payItem?.payroll_runs?.tenant_id;
      if (payslipTenantId) {
        const forbidden = await verifyMembership(payslipTenantId);
        if (forbidden) return forbidden;
      }
      return await generatePayslip(admin, body.payroll_item_id, corsHeaders);
    }

    // --- Financial Reports (require tenant membership) ---
    if ((type === "trial_balance" || type === "income_statement" || type === "balance_sheet" || type === "aging_report") && body.tenant_id) {
      const forbidden = await verifyMembership(body.tenant_id);
      if (forbidden) return forbidden;
    }
    if (type === "trial_balance") {
      return await generateTrialBalance(admin, body, corsHeaders);
    }
    if (type === "income_statement") {
      return await generateIncomeStatement(admin, body, corsHeaders);
    }
    if (type === "balance_sheet") {
      return await generateBalanceSheet(admin, body, corsHeaders);
    }
    if (type === "pdv_return") {
      return await generatePdvReturn(admin, body, user!, corsHeaders);
    }
    if (type === "aging_report") {
      return await generateAgingReport(admin, body, corsHeaders);
    }
    if (type === "ios_kompenzacija") {
      const forbidden = await verifyMembership(body.tenant_id);
      if (forbidden) return forbidden;
      return await generateIosKompenzacija(admin, body, corsHeaders);
    }
    if (type === "asset_revers") {
      const forbidden = await verifyMembership(body.tenant_id);
      if (forbidden) return forbidden;
      return await generateAssetRevers(admin, body, corsHeaders);
    }
    if (type === "asset_registry_report") {
      const forbidden = await verifyMembership(body.tenant_id);
      if (forbidden) return forbidden;
      return await generateAssetRegistryReport(admin, body, corsHeaders);
    }
    if (type === "account_card") {
      const forbidden = await verifyMembership(body.tenant_id);
      if (forbidden) return forbidden;
      return await generateAccountCard(admin, body, corsHeaders);
    }
    if (type === "ios_report") {
      const forbidden = await verifyMembership(body.tenant_id);
      if (forbidden) return forbidden;
      return await generateIosReport(admin, body, corsHeaders);
    }
    if (type === "cash_flow_statement") {
      const forbidden = await verifyMembership(body.tenant_id);
      if (forbidden) return forbidden;
      return await generateCashFlowStatementPdf(admin, body, corsHeaders);
    }

    // --- Invoice PDF (default) ---
    const { invoice_id } = body;
    if (!invoice_id) {
      return new Response(JSON.stringify({ error: "invoice_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return await generateInvoicePdf(admin, user, invoice_id, corsHeaders);
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─── Invoice PDF ───
async function generateInvoicePdf(admin: any, user: any, invoice_id: string, corsHeaders: Record<string, string>) {
  const { data: invoice, error: invErr } = await admin
    .from("invoices").select("*").eq("id", invoice_id).single();
  if (invErr || !invoice) {
    return new Response(JSON.stringify({ error: "Invoice not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: membership } = await admin
    .from("tenant_members").select("id")
    .eq("user_id", user.id).eq("tenant_id", invoice.tenant_id).eq("status", "active").maybeSingle();
  if (!membership) {
    return new Response(JSON.stringify({ error: "Access denied" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: lines = [] } = await admin.from("invoice_lines").select("*").eq("invoice_id", invoice_id).order("sort_order");
  const { data: legalEntity } = await admin.from("legal_entities").select("*").eq("tenant_id", invoice.tenant_id).limit(1).maybeSingle();
  const { data: bankAccount } = await admin.from("bank_accounts").select("*").eq("tenant_id", invoice.tenant_id).eq("is_primary", true).limit(1).maybeSingle();

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; color: #333; margin: 40px; }
  .header { display: flex; justify-content: space-between; margin-bottom: 30px; }
  .company-info { font-size: 11px; line-height: 1.6; }
  .company-name { font-size: 18px; font-weight: bold; color: #1a1a1a; }
  .invoice-title { font-size: 24px; font-weight: bold; color: #2563eb; text-align: right; }
  .invoice-meta { text-align: right; font-size: 11px; line-height: 1.8; margin-top: 8px; }
  .partner-section { background: #f8f9fa; padding: 16px; border-radius: 6px; margin-bottom: 24px; }
  .partner-label { font-size: 10px; text-transform: uppercase; color: #666; margin-bottom: 4px; }
  .partner-name { font-size: 14px; font-weight: bold; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  th { background: #2563eb; color: white; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; }
  th.right { text-align: right; }
  td { padding: 10px 12px; border-bottom: 1px solid #eee; }
  td.right { text-align: right; font-variant-numeric: tabular-nums; }
  .totals { margin-left: auto; width: 280px; }
  .totals-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #eee; }
  .totals-row.grand { font-size: 16px; font-weight: bold; border-top: 2px solid #333; border-bottom: none; padding-top: 10px; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 10px; color: #666; }
  .bank-info { margin-top: 20px; padding: 12px; background: #f0f4ff; border-radius: 6px; font-size: 11px; }
  .bank-label { font-weight: bold; color: #2563eb; }
  </style></head><body>
  <div class="header"><div>
    <div class="company-name">${legalEntity?.name || "Company"}</div>
    <div class="company-info">
      ${legalEntity?.address ? `${legalEntity.address}<br>` : ""}
      ${legalEntity?.city ? `${legalEntity.city}, ` : ""}${legalEntity?.country || "RS"}<br>
      ${legalEntity?.pib ? `PIB: ${legalEntity.pib}<br>` : ""}
      ${legalEntity?.maticni_broj ? `Matični broj: ${legalEntity.maticni_broj}` : ""}
    </div>
  </div><div>
    <div class="invoice-title">FAKTURA</div>
    <div class="invoice-meta">
      <strong>Broj:</strong> ${invoice.invoice_number}<br>
      <strong>Datum:</strong> ${formatDate(invoice.invoice_date)}<br>
      ${invoice.due_date ? `<strong>Rok plaćanja:</strong> ${formatDate(invoice.due_date)}<br>` : ""}
      <strong>Valuta:</strong> ${invoice.currency}
    </div>
  </div></div>
  <div class="partner-section">
    <div class="partner-label">Kupac / Partner</div>
    <div class="partner-name">${escapeHtml(invoice.partner_name)}</div>
    ${invoice.partner_address ? `<div>${escapeHtml(invoice.partner_address)}</div>` : ""}
    ${invoice.partner_pib ? `<div>PIB: ${escapeHtml(invoice.partner_pib)}</div>` : ""}
  </div>
  <table><thead><tr><th>#</th><th>Opis</th><th class="right">Količina</th><th class="right">Cena</th><th class="right">PDV %</th><th class="right">PDV</th><th class="right">Ukupno</th></tr></thead><tbody>
    ${(lines || []).map((line: any, i: number) => `<tr><td>${i + 1}</td><td>${line.description || ""}</td><td class="right">${formatNum(Number(line.quantity))}</td><td class="right">${formatNum(Number(line.unit_price))}</td><td class="right">${Number(line.tax_rate_value)}%</td><td class="right">${formatNum(Number(line.tax_amount))}</td><td class="right">${formatNum(Number(line.total_with_tax))}</td></tr>`).join("")}
  </tbody></table>
  <div class="totals">
    <div class="totals-row"><span>Osnova:</span><span>${formatNum(Number(invoice.subtotal))} ${invoice.currency}</span></div>
    <div class="totals-row"><span>PDV:</span><span>${formatNum(Number(invoice.tax_amount))} ${invoice.currency}</span></div>
    <div class="totals-row grand"><span>UKUPNO:</span><span>${formatNum(Number(invoice.total))} ${invoice.currency}</span></div>
  </div>
  ${bankAccount ? `<div class="bank-info"><span class="bank-label">Podaci za uplatu:</span><br>Banka: ${bankAccount.bank_name}<br>Račun: ${bankAccount.account_number}</div>` : ""}
  ${invoice.notes ? `<div style="margin-top:20px;"><strong>Napomena:</strong> ${invoice.notes}</div>` : ""}
  <div class="footer">Faktura je generisana elektronski i važi bez potpisa i pečata.</div>
  </body></html>`;

  return new Response(html, { headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } });
}

// ─── Payslip ───
async function generatePayslip(admin: any, payrollItemId: string, corsHeaders: Record<string, string>) {
  const { data: item, error: itemErr } = await admin
    .from("payroll_items").select("*, payroll_runs(period_month, period_year, status, tenant_id)").eq("id", payrollItemId).single();
  if (itemErr || !item) {
    return new Response(JSON.stringify({ error: "Payroll item not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const tenantId = item.payroll_runs?.tenant_id;
  const { data: employee } = await admin.from("employees").select("*, departments(name), locations(name)").eq("id", item.employee_id).single();
  const { data: legalEntity } = await admin.from("legal_entities").select("*").eq("tenant_id", tenantId).limit(1).maybeSingle();

  const period = item.payroll_runs;
  const months = ["Januar", "Februar", "Mart", "April", "Maj", "Jun", "Jul", "Avgust", "Septembar", "Oktobar", "Novembar", "Decembar"];
  const periodLabel = `${months[(period?.period_month || 1) - 1]} ${period?.period_year || ""}`;

  const content = `${companyHeader(legalEntity)}
  <div class="report-title">PLATNA LISTA</div>
  <div class="report-subtitle">${periodLabel}</div>
  <div style="background:#f8f9fa;padding:16px;border-radius:6px;margin-bottom:24px;">
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
      <div><div class="summary-label">Ime i prezime</div><div style="font-size:13px;font-weight:600">${employee?.full_name || "—"}</div></div>
      <div><div class="summary-label">JMBG</div><div style="font-size:13px;font-weight:600">${employee?.jmbg || "—"}</div></div>
      <div><div class="summary-label">Pozicija</div><div style="font-size:13px;font-weight:600">${employee?.position || "—"}</div></div>
      <div><div class="summary-label">Odeljenje</div><div style="font-size:13px;font-weight:600">${employee?.departments?.name || "—"}</div></div>
      <div><div class="summary-label">Lokacija</div><div style="font-size:13px;font-weight:600">${employee?.locations?.name || "—"}</div></div>
      <div><div class="summary-label">Radni dani</div><div style="font-size:13px;font-weight:600">${item.actual_working_days} / ${item.working_days}</div></div>
    </div>
  </div>
  <table><thead><tr><th>Stavka</th><th class="right">Iznos (RSD)</th></tr></thead><tbody>
    <tr><td>Bruto zarada</td><td class="right">${formatNum(Number(item.gross_salary))}</td></tr>
    <tr><td>Oporezivi osnov</td><td class="right">${formatNum(Number(item.taxable_base))}</td></tr>
    <tr><td>Porez na dohodak (10%)</td><td class="right">- ${formatNum(Number(item.income_tax))}</td></tr>
    <tr><td>PIO doprinos (14%)</td><td class="right">- ${formatNum(Number(item.pension_contribution))}</td></tr>
    <tr><td>Zdravstveno osiguranje (5.15%)</td><td class="right">- ${formatNum(Number(item.health_contribution))}</td></tr>
    <tr><td>Osiguranje od nezaposlenosti (0.75%)</td><td class="right">- ${formatNum(Number(item.unemployment_contribution))}</td></tr>
    ${item.overtime_hours_count > 0 ? `<tr><td>Prekovremeni rad (${item.overtime_hours_count}h)</td><td class="right">uklj.</td></tr>` : ""}
    ${item.night_work_hours_count > 0 ? `<tr><td>Noćni rad (${item.night_work_hours_count}h)</td><td class="right">uklj.</td></tr>` : ""}
    ${item.leave_days_deducted > 0 ? `<tr><td>Odbitak za odsustvo (${item.leave_days_deducted} dana)</td><td class="right">- ${formatNum(Number(item.leave_deduction_amount))}</td></tr>` : ""}
  </tbody></table>
  <div style="margin-left:auto;width:300px;margin-top:20px;">
    <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee;"><span>Bruto zarada:</span><span>${formatNum(Number(item.gross_salary))} RSD</span></div>
    <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee;"><span>Ukupni doprinosi:</span><span>${formatNum(Number(item.pension_contribution) + Number(item.health_contribution) + Number(item.unemployment_contribution))} RSD</span></div>
    <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee;"><span>Porez:</span><span>${formatNum(Number(item.income_tax))} RSD</span></div>
    <div style="display:flex;justify-content:space-between;padding:10px 0;font-size:16px;font-weight:bold;border-top:2px solid #333;"><span>NETO ZARADA:</span><span>${formatNum(Number(item.net_salary))} RSD</span></div>
    <div style="display:flex;justify-content:space-between;padding:6px 0;margin-top:12px;color:#666;"><span>Ukupan trošak poslodavca:</span><span>${formatNum(Number(item.total_cost))} RSD</span></div>
  </div>`;

  return new Response(wrapHtml("Platna Lista", content), {
    headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
  });
}

// ─── Trial Balance ───
async function generateTrialBalance(admin: any, body: any, corsHeaders: Record<string, string>) {
  const { tenant_id, date_from, date_to } = body;
  if (!tenant_id) return new Response(JSON.stringify({ error: "tenant_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const { data: legalEntity } = await admin.from("legal_entities").select("*").eq("tenant_id", tenant_id).limit(1).maybeSingle();

  let query = admin.from("journal_lines").select(`debit, credit, account:chart_of_accounts(id, code, name, account_type), journal_entry:journal_entries!inner(status, entry_date, tenant_id)`).eq("journal_entry.status", "posted").eq("journal_entry.tenant_id", tenant_id);
  if (date_from) query = query.gte("journal_entry.entry_date", date_from);
  if (date_to) query = query.lte("journal_entry.entry_date", date_to);
  const { data: lines = [] } = await query;

  const map = new Map<string, { code: string; name: string; type: string; debit: number; credit: number }>();
  for (const l of lines as any[]) {
    if (!l.account) continue;
    const id = l.account.id;
    if (!map.has(id)) map.set(id, { code: l.account.code, name: l.account.name, type: l.account.account_type, debit: 0, credit: 0 });
    const r = map.get(id)!;
    r.debit += Number(l.debit);
    r.credit += Number(l.credit);
  }
  const rows = Array.from(map.values()).filter(r => r.debit !== 0 || r.credit !== 0).sort((a, b) => a.code.localeCompare(b.code));
  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);

  const periodLabel = date_from && date_to ? `${formatDate(date_from)} — ${formatDate(date_to)}` : date_from ? `Od ${formatDate(date_from)}` : date_to ? `Do ${formatDate(date_to)}` : "Svi periodi";

  const content = `${companyHeader(legalEntity)}
  <div class="report-title">BRUTO BILANS</div>
  <div class="report-subtitle">${periodLabel}</div>
  <table><thead><tr><th>Šifra</th><th>Naziv konta</th><th>Tip</th><th class="right">Duguje</th><th class="right">Potražuje</th><th class="right">Saldo</th></tr></thead><tbody>
    ${rows.map(r => `<tr><td style="font-family:monospace">${r.code}</td><td>${r.name}</td><td>${r.type}</td><td class="right">${formatNum(r.debit)}</td><td class="right">${formatNum(r.credit)}</td><td class="right" style="font-weight:600">${formatNum(r.debit - r.credit)}</td></tr>`).join("")}
  </tbody><tfoot><tr class="totals-row"><td colspan="3" style="padding:10px 12px;font-weight:bold">UKUPNO</td><td class="right" style="padding:10px 12px;font-weight:bold">${formatNum(totalDebit)}</td><td class="right" style="padding:10px 12px;font-weight:bold">${formatNum(totalCredit)}</td><td class="right" style="padding:10px 12px;font-weight:bold">${formatNum(totalDebit - totalCredit)}</td></tr></tfoot></table>`;

  return new Response(wrapHtml("Bruto Bilans", content), { headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } });
}

// ─── Income Statement ───
async function generateIncomeStatement(admin: any, body: any, corsHeaders: Record<string, string>) {
  const { tenant_id, date_from, date_to } = body;
  if (!tenant_id) return new Response(JSON.stringify({ error: "tenant_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const { data: legalEntity } = await admin.from("legal_entities").select("*").eq("tenant_id", tenant_id).limit(1).maybeSingle();

  let query = admin.from("journal_lines").select(`debit, credit, account:chart_of_accounts!inner(id, code, name, account_type), journal_entry:journal_entries!inner(status, entry_date, tenant_id)`).eq("journal_entry.status", "posted").eq("journal_entry.tenant_id", tenant_id).in("account.account_type", ["revenue", "expense"]);
  if (date_from) query = query.gte("journal_entry.entry_date", date_from);
  if (date_to) query = query.lte("journal_entry.entry_date", date_to);
  const { data: lines = [] } = await query;

  const map = new Map<string, { code: string; name: string; type: string; amount: number }>();
  for (const l of lines as any[]) {
    if (!l.account) continue;
    const id = l.account.id;
    if (!map.has(id)) map.set(id, { code: l.account.code, name: l.account.name, type: l.account.account_type, amount: 0 });
    const r = map.get(id)!;
    r.amount += l.account.account_type === "revenue" ? Number(l.credit) - Number(l.debit) : Number(l.debit) - Number(l.credit);
  }
  const all = Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
  const rev = all.filter(r => r.type === "revenue");
  const exp = all.filter(r => r.type === "expense");
  const totalRev = rev.reduce((s, r) => s + r.amount, 0);
  const totalExp = exp.reduce((s, r) => s + r.amount, 0);
  const net = totalRev - totalExp;
  const periodLabel = date_from && date_to ? `${formatDate(date_from)} — ${formatDate(date_to)}` : "Svi periodi";

  const renderSection = (title: string, items: typeof rev, total: number) => `
    <div class="section-header">${title}</div>
    <table><thead><tr><th>Šifra</th><th>Naziv konta</th><th class="right">Iznos (RSD)</th></tr></thead><tbody>
      ${items.map(r => `<tr><td style="font-family:monospace">${r.code}</td><td>${r.name}</td><td class="right">${formatNum(r.amount)}</td></tr>`).join("")}
    </tbody><tfoot><tr class="totals-row"><td colspan="2" style="padding:10px 12px;font-weight:bold">Ukupno ${title}</td><td class="right" style="padding:10px 12px;font-weight:bold">${formatNum(total)}</td></tr></tfoot></table>`;

  const content = `${companyHeader(legalEntity)}
  <div class="report-title">BILANS USPEHA</div>
  <div class="report-subtitle">${periodLabel}</div>
  ${renderSection("Prihodi", rev, totalRev)}
  ${renderSection("Rashodi", exp, totalExp)}
  <div class="summary-box" style="display:flex;justify-content:space-between;align-items:center;">
    <div><div class="summary-label">Neto rezultat</div><div class="summary-value" style="color:${net >= 0 ? '#16a34a' : '#dc2626'}">${net >= 0 ? "DOBIT" : "GUBITAK"}</div></div>
    <div class="summary-value">${formatNum(Math.abs(net))} RSD</div>
  </div>`;

  return new Response(wrapHtml("Bilans Uspeha", content), { headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } });
}

// ─── Balance Sheet ───
async function generateBalanceSheet(admin: any, body: any, corsHeaders: Record<string, string>) {
  const { tenant_id, as_of_date } = body;
  if (!tenant_id) return new Response(JSON.stringify({ error: "tenant_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const { data: legalEntity } = await admin.from("legal_entities").select("*").eq("tenant_id", tenant_id).limit(1).maybeSingle();

  let query = admin.from("journal_lines").select(`debit, credit, account:chart_of_accounts!inner(id, code, name, account_type), journal_entry:journal_entries!inner(status, entry_date, tenant_id)`).eq("journal_entry.status", "posted").eq("journal_entry.tenant_id", tenant_id).in("account.account_type", ["asset", "liability", "equity"]);
  if (as_of_date) query = query.lte("journal_entry.entry_date", as_of_date);
  const { data: lines = [] } = await query;

  const map = new Map<string, { code: string; name: string; type: string; balance: number }>();
  for (const l of lines as any[]) {
    if (!l.account) continue;
    const id = l.account.id;
    if (!map.has(id)) map.set(id, { code: l.account.code, name: l.account.name, type: l.account.account_type, balance: 0 });
    const r = map.get(id)!;
    r.balance += l.account.account_type === "asset" ? Number(l.debit) - Number(l.credit) : Number(l.credit) - Number(l.debit);
  }
  const all = Array.from(map.values()).filter(r => r.balance !== 0).sort((a, b) => a.code.localeCompare(b.code));
  const assets = all.filter(r => r.type === "asset");
  const liab = all.filter(r => r.type === "liability");
  const eq = all.filter(r => r.type === "equity");
  const totalA = assets.reduce((s, r) => s + r.balance, 0);
  const totalL = liab.reduce((s, r) => s + r.balance, 0);
  const totalE = eq.reduce((s, r) => s + r.balance, 0);

  const renderSection = (title: string, items: typeof assets, total: number) => `
    <div class="section-header">${title}</div>
    <table><thead><tr><th>Šifra</th><th>Naziv konta</th><th class="right">Saldo (RSD)</th></tr></thead><tbody>
      ${items.map(r => `<tr><td style="font-family:monospace">${r.code}</td><td>${r.name}</td><td class="right">${formatNum(r.balance)}</td></tr>`).join("")}
    </tbody><tfoot><tr class="totals-row"><td colspan="2" style="padding:10px 12px;font-weight:bold">Ukupno ${title}</td><td class="right" style="padding:10px 12px;font-weight:bold">${formatNum(total)}</td></tr></tfoot></table>`;

  const content = `${companyHeader(legalEntity)}
  <div class="report-title">BILANS STANJA</div>
  <div class="report-subtitle">Na dan: ${formatDate(as_of_date || new Date().toISOString().split("T")[0])}</div>
  ${renderSection("Aktiva (Imovina)", assets, totalA)}
  ${renderSection("Obaveze", liab, totalL)}
  ${renderSection("Kapital", eq, totalE)}
  <div class="summary-box" style="display:flex;justify-content:space-between;align-items:center;">
    <div><div class="summary-label">Aktiva = Obaveze + Kapital</div><div style="font-size:14px;font-weight:600">${formatNum(totalA)} = ${formatNum(totalL + totalE)}</div></div>
    <div style="padding:4px 12px;border-radius:4px;font-weight:bold;color:white;background:${Math.abs(totalA - (totalL + totalE)) < 0.01 ? '#16a34a' : '#dc2626'}">${Math.abs(totalA - (totalL + totalE)) < 0.01 ? "URAVNOTEŽEN" : "NEURAVNOTEŽEN"}</div>
  </div>`;

  return new Response(wrapHtml("Bilans Stanja", content), { headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } });
}

// ─── PDV Return ───
async function generatePdvReturn(admin: any, body: any, user: any, corsHeaders: Record<string, string>) {
  const { pdv_period_id } = body;
  if (!pdv_period_id) return new Response(JSON.stringify({ error: "pdv_period_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const { data: period, error: pErr } = await admin.from("pdv_periods").select("*").eq("id", pdv_period_id).single();
  if (pErr || !period) return new Response(JSON.stringify({ error: "PDV period not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  // Verify tenant membership for PDV period's tenant
  const { data: membership } = await admin
    .from("tenant_members").select("id")
    .eq("user_id", user.id).eq("tenant_id", period.tenant_id).eq("status", "active").maybeSingle();
  if (!membership) {
    return new Response(JSON.stringify({ error: "Forbidden: not a member of this tenant" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { data: legalEntity } = await admin.from("legal_entities").select("*").eq("tenant_id", period.tenant_id).limit(1).maybeSingle();
  const { data: entries = [] } = await admin.from("pdv_entries").select("*").eq("pdv_period_id", pdv_period_id).order("popdv_section, document_date");

  const sections = [
    { code: "3", label: "Promet dobara i usluga (opšta stopa)", direction: "output" },
    { code: "3a", label: "Promet dobara i usluga (posebna stopa)", direction: "output" },
    { code: "4", label: "Oslobođen promet sa pravom na odbitak", direction: "output" },
    { code: "5", label: "Oslobođen promet bez prava na odbitak", direction: "output" },
    { code: "6", label: "Promet izvršen van RS", direction: "output" },
    { code: "8a", label: "Nabavke sa pravom na odbitak (opšta stopa)", direction: "input" },
    { code: "8b", label: "Nabavke sa pravom na odbitak (posebna stopa)", direction: "input" },
    { code: "8v", label: "Uvoz dobara", direction: "input" },
    { code: "9", label: "Nabavke bez prava na odbitak", direction: "input" },
    { code: "10", label: "Ispravka odbitka prethodnog poreza", direction: "input" },
    { code: "11", label: "Posebni postupci oporezivanja", direction: "output" },
  ];

  const summary = sections.map(sec => {
    const sEntries = entries.filter((e: any) => e.popdv_section === sec.code);
    return { ...sec, base: sEntries.reduce((s: number, e: any) => s + Number(e.base_amount), 0), vat: sEntries.reduce((s: number, e: any) => s + Number(e.vat_amount), 0), count: sEntries.length };
  });

  const content = `${companyHeader(legalEntity)}
  <div class="report-title">ПОРЕСКА ПРИЈАВА ЗА ПДВ (ПОПДВ)</div>
  <div class="report-subtitle">${period.period_name} (${formatDate(period.start_date)} — ${formatDate(period.end_date)})</div>
  <table><thead><tr><th>Одељак</th><th>Опис</th><th>Смер</th><th class="right">Основица (RSD)</th><th class="right">ПДВ (RSD)</th><th class="right">Бр. док.</th></tr></thead><tbody>
    ${summary.map(s => `<tr${s.count === 0 ? ' style="color:#999"' : ""}><td style="font-family:monospace;font-weight:bold">${s.code}</td><td>${s.label}</td><td>${s.direction === "output" ? "Излаз" : "Улаз"}</td><td class="right">${formatNum(s.base)}</td><td class="right">${formatNum(s.vat)}</td><td class="right">${s.count}</td></tr>`).join("")}
  </tbody><tfoot>
    <tr class="totals-row"><td colspan="3" style="padding:10px 12px;text-align:right;font-weight:bold">Излазни ПДВ:</td><td class="right" style="padding:10px 12px;font-weight:bold">${formatNum(summary.filter(s => s.direction === "output").reduce((a, s) => a + s.base, 0))}</td><td class="right" style="padding:10px 12px;font-weight:bold">${formatNum(Number(period.output_vat))}</td><td></td></tr>
    <tr class="totals-row"><td colspan="3" style="padding:10px 12px;text-align:right;font-weight:bold">Улазни ПДВ:</td><td class="right" style="padding:10px 12px;font-weight:bold">${formatNum(summary.filter(s => s.direction === "input").reduce((a, s) => a + s.base, 0))}</td><td class="right" style="padding:10px 12px;font-weight:bold">${formatNum(Number(period.input_vat))}</td><td></td></tr>
  </tfoot></table>
  <div class="summary-box" style="display:flex;justify-content:space-between;align-items:center;">
    <div><div class="summary-label">${Number(period.vat_liability) >= 0 ? "Обавеза за плаћање ПДВ" : "Право на повраћај ПДВ"}</div><div class="summary-value" style="color:${Number(period.vat_liability) >= 0 ? '#dc2626' : '#16a34a'}">${formatNum(Math.abs(Number(period.vat_liability)))} RSD</div></div>
  </div>`;

  return new Response(wrapHtml("PDV Prijava", content), { headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } });
}

// ─── Aging Report ───
async function generateAgingReport(admin: any, body: any, corsHeaders: Record<string, string>) {
  const { tenant_id, report_type } = body;
  if (!tenant_id) return new Response(JSON.stringify({ error: "tenant_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const { data: legalEntity } = await admin.from("legal_entities").select("*").eq("tenant_id", tenant_id).limit(1).maybeSingle();

  const tableName = report_type === "ap" ? "ap_aging_snapshots" : "ar_aging_snapshots";
  const { data: snapshots = [] } = await admin.from(tableName).select("*").eq("tenant_id", tenant_id).order("snapshot_date", { ascending: false }).limit(50);

  const title = report_type === "ap" ? "STAROST OBAVEZA (AP)" : "STAROST POTRAŽIVANJA (AR)";

  const content = `${companyHeader(legalEntity)}
  <div class="report-title">${title}</div>
  <div class="report-subtitle">Generisano: ${formatDate(new Date().toISOString().split("T")[0])}</div>
  <table><thead><tr><th>Datum</th><th>Partner</th><th class="right">Tekuće</th><th class="right">1-30 dana</th><th class="right">31-60 dana</th><th class="right">61-90 dana</th><th class="right">90+ dana</th><th class="right">Ukupno</th></tr></thead><tbody>
    ${(snapshots as any[]).map(r => `<tr><td>${r.snapshot_date}</td><td>${r.partner_id || "—"}</td><td class="right">${formatNum(Number(r.bucket_current))}</td><td class="right">${formatNum(Number(r.bucket_30))}</td><td class="right">${formatNum(Number(r.bucket_60))}</td><td class="right">${formatNum(Number(r.bucket_90))}</td><td class="right">${formatNum(Number(r.bucket_over90))}</td><td class="right" style="font-weight:bold">${formatNum(Number(r.total_outstanding))}</td></tr>`).join("")}
  </tbody></table>`;

  return new Response(wrapHtml(title, content), { headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } });
}

// ─── IOS (Izvod Otvorenih Stavki) for Kompenzacija ───
async function generateIosKompenzacija(admin: any, body: any, corsHeaders: Record<string, string>) {
  const { tenant_id, kompenzacija_id } = body;
  if (!tenant_id || !kompenzacija_id) {
    return new Response(JSON.stringify({ error: "tenant_id and kompenzacija_id required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: legalEntity } = await admin.from("legal_entities").select("*").eq("tenant_id", tenant_id).limit(1).maybeSingle();
  const { data: komp, error: kompErr } = await admin.from("kompenzacija").select("*, partners(name, pib, address, city)").eq("id", kompenzacija_id).single();
  if (kompErr || !komp) {
    return new Response(JSON.stringify({ error: "Kompenzacija not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Fetch kompenzacija items with open_items details
  const { data: items = [] } = await admin.from("kompenzacija_items").select("*, open_items(document_number, original_amount, remaining_amount, currency, direction, due_date)").eq("kompenzacija_id", kompenzacija_id);

  const receivableItems = items.filter((i: any) => i.direction === "receivable");
  const payableItems = items.filter((i: any) => i.direction === "payable");
  const partner = (komp as any).partners;
  const totalAmount = Number(komp.total_amount);

  const itemRows = (list: any[], label: string) => list.map((item: any, idx: number) => {
    const oi = item.open_items;
    return `<tr>
      <td>${idx + 1}</td>
      <td>${oi?.document_number || "—"}</td>
      <td>${formatDate(oi?.due_date)}</td>
      <td class="right">${formatNum(Number(oi?.original_amount || 0))}</td>
      <td class="right">${formatNum(Number(item.amount))}</td>
    </tr>`;
  }).join("");

  const content = `${companyHeader(legalEntity)}
  <div class="report-title">ИЗВОД ОТВОРЕНИХ СТАВКИ (ИОС)</div>
  <div class="report-subtitle">Izjava o međusobnom prebijanju potraživanja i obaveza</div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px;">
    <div style="background:#f8f9fa;padding:16px;border-radius:6px;">
      <div class="summary-label">Poverilac / Naša firma</div>
      <div style="font-size:14px;font-weight:bold;margin-top:4px;">${legalEntity?.name || "—"}</div>
      ${legalEntity?.pib ? `<div>PIB: ${legalEntity.pib}</div>` : ""}
      ${legalEntity?.address ? `<div>${legalEntity.address}</div>` : ""}
    </div>
    <div style="background:#f8f9fa;padding:16px;border-radius:6px;">
      <div class="summary-label">Dužnik / Partner</div>
      <div style="font-size:14px;font-weight:bold;margin-top:4px;">${partner?.name || "—"}</div>
      ${partner?.pib ? `<div>PIB: ${partner.pib}</div>` : ""}
      ${partner?.address ? `<div>${partner.address}${partner?.city ? `, ${partner.city}` : ""}</div>` : ""}
    </div>
  </div>

  <div style="margin-bottom:4px;font-size:11px;color:#666;">Dokument br: ${komp.document_number} | Datum: ${formatDate(komp.document_date)}</div>

  <div class="section-header">Naša potraživanja (Receivables)</div>
  <table><thead><tr><th>#</th><th>Dokument</th><th>Rok</th><th class="right">Iznos</th><th class="right">Prebijeno</th></tr></thead><tbody>
    ${itemRows(receivableItems, "receivable")}
    <tr class="totals-row"><td colspan="4" style="text-align:right;font-weight:bold;">Ukupno potraživanja:</td><td class="right" style="font-weight:bold;">${formatNum(receivableItems.reduce((s: number, i: any) => s + Number(i.amount), 0))}</td></tr>
  </tbody></table>

  <div class="section-header">Naše obaveze (Payables)</div>
  <table><thead><tr><th>#</th><th>Dokument</th><th>Rok</th><th class="right">Iznos</th><th class="right">Prebijeno</th></tr></thead><tbody>
    ${itemRows(payableItems, "payable")}
    <tr class="totals-row"><td colspan="4" style="text-align:right;font-weight:bold;">Ukupno obaveze:</td><td class="right" style="font-weight:bold;">${formatNum(payableItems.reduce((s: number, i: any) => s + Number(i.amount), 0))}</td></tr>
  </tbody></table>

  <div class="summary-box">
    <div class="summary-label">Ukupan iznos kompenzacije</div>
    <div class="summary-value">${formatNum(totalAmount)} RSD</div>
  </div>

  <div style="margin-top:40px;display:grid;grid-template-columns:1fr 1fr;gap:40px;">
    <div style="border-top:1px solid #333;padding-top:8px;text-align:center;">
      <div style="font-size:11px;color:#666;">Za ${legalEntity?.name || "firmu"}</div>
      <div style="margin-top:24px;">_________________________</div>
      <div style="font-size:10px;color:#666;">M.P. i potpis</div>
    </div>
    <div style="border-top:1px solid #333;padding-top:8px;text-align:center;">
      <div style="font-size:11px;color:#666;">Za ${partner?.name || "partnera"}</div>
      <div style="margin-top:24px;">_________________________</div>
      <div style="font-size:10px;color:#666;">M.P. i potpis</div>
    </div>
  </div>`;

  return new Response(wrapHtml("IOS - Izvod Otvorenih Stavki", content), {
    headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
  });
}

// ─── Asset Revers PDF ───
async function generateAssetRevers(admin: any, body: any, corsHeaders: Record<string, string>) {
  const { tenant_id, revers_id } = body;
  if (!tenant_id || !revers_id) {
    return new Response(JSON.stringify({ error: "tenant_id and revers_id required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: revers, error: rErr } = await admin
    .from("asset_reverses")
    .select("*, assets(name, asset_code, inventory_number, serial_number, acquisition_cost, acquisition_date, asset_type, category_id, asset_categories(name)), employees(first_name, last_name, employee_id, position, jmbg)")
    .eq("id", revers_id)
    .eq("tenant_id", tenant_id)
    .single();

  if (rErr || !revers) {
    return new Response(JSON.stringify({ error: "Revers not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: legalEntity } = await admin.from("legal_entities").select("*").eq("tenant_id", tenant_id).limit(1).maybeSingle();

  const isHandover = revers.revers_type === "handover";
  const title = isHandover ? "РЕВЕРС — Задужење средства" : "РЕВЕРС — Раздужење средства";
  const asset = revers.assets || {};
  const emp = revers.employees || {};

  const content = `${companyHeader(legalEntity)}
  <div class="report-title">${title}</div>
  <div class="report-subtitle">Број: ${revers.revers_number} | Датум: ${formatDate(revers.revers_date)}</div>

  <div class="section-header">Подаци о средству</div>
  <table>
    <tbody>
      <tr><td style="width:200px;font-weight:600;background:#f8f9fa;">Шифра средства</td><td>${asset.asset_code || "—"}</td></tr>
      <tr><td style="font-weight:600;background:#f8f9fa;">Назив</td><td>${asset.name || "—"}</td></tr>
      <tr><td style="font-weight:600;background:#f8f9fa;">Инвентарни број</td><td>${asset.inventory_number || "—"}</td></tr>
      <tr><td style="font-weight:600;background:#f8f9fa;">Серијски број</td><td>${asset.serial_number || "—"}</td></tr>
      <tr><td style="font-weight:600;background:#f8f9fa;">Категорија</td><td>${asset.asset_categories?.name || "—"}</td></tr>
      <tr><td style="font-weight:600;background:#f8f9fa;">Набавна вредност</td><td>${asset.acquisition_cost ? formatNum(Number(asset.acquisition_cost)) + " RSD" : "—"}</td></tr>
      <tr><td style="font-weight:600;background:#f8f9fa;">Датум набавке</td><td>${formatDate(asset.acquisition_date)}</td></tr>
      ${revers.condition_on_handover ? `<tr><td style="font-weight:600;background:#f8f9fa;">Стање при примопредаји</td><td>${escapeHtml(revers.condition_on_handover)}</td></tr>` : ""}
      ${revers.accessories ? `<tr><td style="font-weight:600;background:#f8f9fa;">Пратећа опрема</td><td>${escapeHtml(revers.accessories)}</td></tr>` : ""}
    </tbody>
  </table>

  <div class="section-header">${isHandover ? "Задужује се" : "Раздужује се"}</div>
  <table>
    <tbody>
      <tr><td style="width:200px;font-weight:600;background:#f8f9fa;">Име и презиме</td><td>${emp.first_name || ""} ${emp.last_name || ""}</td></tr>
      <tr><td style="font-weight:600;background:#f8f9fa;">Матични број запосленог</td><td>${emp.employee_id || "—"}</td></tr>
      <tr><td style="font-weight:600;background:#f8f9fa;">ЈМБГ</td><td>${emp.jmbg || "—"}</td></tr>
      <tr><td style="font-weight:600;background:#f8f9fa;">Позиција</td><td>${emp.position || "—"}</td></tr>
    </tbody>
  </table>

  ${revers.notes ? `<div style="margin:20px 0;"><strong>Напомена:</strong> ${revers.notes}</div>` : ""}

  <div style="margin-top:20px;padding:12px;background:#f0f4ff;border-radius:6px;font-size:11px;">
    ${isHandover
      ? "Потписом овог реверса, запослени потврђује да је преузео горе наведено средство у исправном стању и обавезује се да ће исто користити пажљиво и наменски, те да ће га вратити на захтев послодавца."
      : "Потписом овог реверса, послодавац потврђује да је запослени вратио горе наведено средство."
    }
  </div>

  <div style="margin-top:50px;display:grid;grid-template-columns:1fr 1fr;gap:40px;">
    <div style="border-top:1px solid #333;padding-top:8px;text-align:center;">
      <div style="font-size:11px;color:#666;">Издао (послодавац)</div>
      <div style="margin-top:30px;">_________________________</div>
      <div style="font-size:10px;color:#666;">М.П. и потпис</div>
    </div>
    <div style="border-top:1px solid #333;padding-top:8px;text-align:center;">
      <div style="font-size:11px;color:#666;">${isHandover ? "Преузео (запослени)" : "Вратио (запослени)"}</div>
      <div style="margin-top:30px;">_________________________</div>
      ${revers.signed_by_name ? `<div style="font-size:11px;font-weight:600;margin-top:4px;">${revers.signed_by_name}</div>` : ""}
      ${revers.signed_at ? `<div style="font-size:10px;color:#666;">Потписано: ${formatDate(revers.signed_at)}</div>` : `<div style="font-size:10px;color:#666;">Потпис запосленог</div>`}
    </div>
  </div>`;

  return new Response(wrapHtml("Реверс", content), {
    headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
  });
}

// ─── Asset Registry Report PDF ───
async function generateAssetRegistryReport(admin: any, body: any, corsHeaders: Record<string, string>) {
  const { tenant_id } = body;
  const { data: legalEntity } = await admin.from("legal_entities").select("*").eq("tenant_id", tenant_id).limit(1).maybeSingle();
  const { data: assets = [] } = await admin.from("assets")
    .select("*, asset_categories(name), asset_locations(name)")
    .eq("tenant_id", tenant_id)
    .order("asset_code");

  const rows = assets.map((a: any, i: number) => `<tr>
    <td>${i + 1}</td>
    <td class="right">${a.asset_code}</td>
    <td>${a.name}</td>
    <td>${a.asset_type}</td>
    <td>${a.asset_categories?.name || "—"}</td>
    <td>${a.asset_locations?.name || "—"}</td>
    <td class="right">${a.acquisition_cost ? formatNum(Number(a.acquisition_cost)) : "—"}</td>
    <td class="right">${a.current_value ? formatNum(Number(a.current_value)) : "—"}</td>
    <td>${a.status}</td>
  </tr>`).join("");

  const totalAcq = assets.reduce((s: number, a: any) => s + (Number(a.acquisition_cost) || 0), 0);
  const totalCur = assets.reduce((s: number, a: any) => s + (Number(a.current_value) || 0), 0);

  const content = `${companyHeader(legalEntity)}
  <div class="report-title">REGISTAR IMOVINE</div>
  <div class="report-subtitle">Ukupno sredstava: ${assets.length} | Datum: ${formatDate(new Date().toISOString())}</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;">
    <div class="summary-box"><div class="summary-label">Nabavna vrednost</div><div class="summary-value">${formatNum(totalAcq)} RSD</div></div>
    <div class="summary-box"><div class="summary-label">Sadašnja vrednost</div><div class="summary-value">${formatNum(totalCur)} RSD</div></div>
  </div>
  <table><thead><tr><th>#</th><th>Šifra</th><th>Naziv</th><th>Tip</th><th>Kategorija</th><th>Lokacija</th><th class="right">Nabavna</th><th class="right">Sadašnja</th><th>Status</th></tr></thead>
  <tbody>${rows}
    <tr class="totals-row"><td colspan="6" style="text-align:right;font-weight:bold;">UKUPNO:</td><td class="right">${formatNum(totalAcq)}</td><td class="right">${formatNum(totalCur)}</td><td></td></tr>
  </tbody></table>`;

  return new Response(wrapHtml("Registar imovine", content), {
    headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
  });
}

// ─── Account Card (Kartica Konta) ───
async function generateAccountCard(admin: any, body: any, corsHeaders: Record<string, string>) {
  const { tenant_id, date_from, date_to, account_id } = body;
  if (!tenant_id) return new Response(JSON.stringify({ error: "tenant_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const { data: legalEntity } = await admin.from("legal_entities").select("*").eq("tenant_id", tenant_id).limit(1).maybeSingle();

  // Opening balance
  let openingBalance = 0;
  if (date_from) {
    let obQuery = admin.from("journal_lines").select("debit, credit, account_id, journal_entry:journal_entries!inner(status, entry_date, tenant_id)")
      .eq("journal_entry.status", "posted").eq("journal_entry.tenant_id", tenant_id).lt("journal_entry.entry_date", date_from);
    if (account_id) obQuery = obQuery.eq("account_id", account_id);
    const { data: obLines = [] } = await obQuery;
    openingBalance = (obLines as any[]).reduce((s: number, l: any) => s + Number(l.debit) - Number(l.credit), 0);
  }

  // Period lines
  let query = admin.from("journal_lines").select("debit, credit, description, account:chart_of_accounts(code, name), journal_entry:journal_entries!inner(entry_number, entry_date, status, tenant_id, description)")
    .eq("journal_entry.status", "posted").eq("journal_entry.tenant_id", tenant_id);
  if (account_id) query = query.eq("account_id", account_id);
  if (date_from) query = query.gte("journal_entry.entry_date", date_from);
  if (date_to) query = query.lte("journal_entry.entry_date", date_to);
  const { data: lines = [] } = await query;

  // Group by account
  const map = new Map<string, { code: string; name: string; lines: any[]; totalDebit: number; totalCredit: number }>();
  for (const l of lines as any[]) {
    if (!l.account) continue;
    const key = l.account.code;
    if (!map.has(key)) map.set(key, { code: l.account.code, name: l.account.name, lines: [], totalDebit: 0, totalCredit: 0 });
    const g = map.get(key)!;
    g.lines.push(l);
    g.totalDebit += Number(l.debit);
    g.totalCredit += Number(l.credit);
  }
  const accounts = Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
  const periodLabel = date_from && date_to ? `${formatDate(date_from)} — ${formatDate(date_to)}` : "Svi periodi";

  let html = `${companyHeader(legalEntity)}<div class="report-title">KARTICA KONTA</div><div class="report-subtitle">${periodLabel}</div>`;

  for (const acc of accounts) {
    let balance = date_from ? openingBalance : 0;
    html += `<div class="section-header">${acc.code} — ${acc.name}</div><table><thead><tr><th>Datum</th><th>Nalog</th><th>Opis</th><th class="right">Duguje</th><th class="right">Potražuje</th><th class="right">Saldo</th></tr></thead><tbody>`;
    if (date_from) {
      html += `<tr style="background:#f0f4ff;font-style:italic"><td colspan="3">Početno stanje</td><td class="right">${openingBalance > 0 ? formatNum(openingBalance) : ""}</td><td class="right">${openingBalance < 0 ? formatNum(Math.abs(openingBalance)) : ""}</td><td class="right">${formatNum(openingBalance)}</td></tr>`;
    }
    for (const l of acc.lines) {
      balance += Number(l.debit) - Number(l.credit);
      html += `<tr><td>${l.journal_entry?.entry_date ? formatDate(l.journal_entry.entry_date) : ""}</td><td>${l.journal_entry?.entry_number || ""}</td><td>${escapeHtml(l.description || l.journal_entry?.description)}</td><td class="right">${Number(l.debit) > 0 ? formatNum(Number(l.debit)) : ""}</td><td class="right">${Number(l.credit) > 0 ? formatNum(Number(l.credit)) : ""}</td><td class="right" style="font-weight:600">${formatNum(balance)}</td></tr>`;
    }
    html += `<tr class="totals-row"><td colspan="3">Ukupno</td><td class="right">${formatNum(acc.totalDebit)}</td><td class="right">${formatNum(acc.totalCredit)}</td><td class="right">${formatNum(balance)}</td></tr></tbody></table>`;
  }

  return new Response(wrapHtml("Kartica Konta", html), { headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } });
}

// ─── IOS Report PDF ───
async function generateIosReport(admin: any, body: any, corsHeaders: Record<string, string>) {
  const { tenant_id, cutoff_date } = body;
  if (!tenant_id) return new Response(JSON.stringify({ error: "tenant_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const { data: legalEntity } = await admin.from("legal_entities").select("*").eq("tenant_id", tenant_id).limit(1).maybeSingle();

  const cutoff = cutoff_date || new Date().toISOString().split("T")[0];
  const { data: openItems = [] } = await admin.from("open_items")
    .select("partner_id, original_amount, remaining_amount, direction, due_date, partners(name, pib)")
    .eq("tenant_id", tenant_id).eq("status", "open").lte("created_at", cutoff + "T23:59:59");

  const map = new Map<string, { name: string; pib: string; receivable: number; payable: number; items: number }>();
  for (const item of openItems as any[]) {
    const pid = item.partner_id || "unknown";
    if (!map.has(pid)) map.set(pid, { name: item.partners?.name || "Nepoznat", pib: item.partners?.pib || "", receivable: 0, payable: 0, items: 0 });
    const e = map.get(pid)!;
    e.items++;
    const amt = Number(item.remaining_amount || item.original_amount || 0);
    if (item.direction === "receivable") e.receivable += amt; else e.payable += amt;
  }
  const partners = Array.from(map.values()).sort((a, b) => Math.abs(b.receivable - b.payable) - Math.abs(a.receivable - a.payable));
  const totalRec = partners.reduce((s, p) => s + p.receivable, 0);
  const totalPay = partners.reduce((s, p) => s + p.payable, 0);

  const content = `${companyHeader(legalEntity)}
  <div class="report-title">IOS — IZVOD OTVORENIH STAVKI</div>
  <div class="report-subtitle">Datum preseka: ${formatDate(cutoff)}</div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:24px;">
    <div class="summary-box"><div class="summary-label">Potraživanja</div><div class="summary-value" style="color:#16a34a">${formatNum(totalRec)} RSD</div></div>
    <div class="summary-box"><div class="summary-label">Obaveze</div><div class="summary-value" style="color:#dc2626">${formatNum(totalPay)} RSD</div></div>
    <div class="summary-box"><div class="summary-label">Neto saldo</div><div class="summary-value">${formatNum(totalRec - totalPay)} RSD</div></div>
  </div>
  <table><thead><tr><th>Partner</th><th>PIB</th><th class="right">Potraživanja</th><th class="right">Obaveze</th><th class="right">Neto</th><th class="right">Stavke</th></tr></thead><tbody>
    ${partners.map(p => `<tr><td>${escapeHtml(p.name)}</td><td>${p.pib}</td><td class="right" style="color:#16a34a">${formatNum(p.receivable)}</td><td class="right" style="color:#dc2626">${formatNum(p.payable)}</td><td class="right" style="font-weight:600;color:${p.receivable - p.payable >= 0 ? '#16a34a' : '#dc2626'}">${formatNum(p.receivable - p.payable)}</td><td class="right">${p.items}</td></tr>`).join("")}
  </tbody><tfoot><tr class="totals-row"><td colspan="2">UKUPNO</td><td class="right">${formatNum(totalRec)}</td><td class="right">${formatNum(totalPay)}</td><td class="right">${formatNum(totalRec - totalPay)}</td><td class="right">${partners.reduce((s, p) => s + p.items, 0)}</td></tr></tfoot></table>`;

  return new Response(wrapHtml("IOS — Izvod Otvorenih Stavki", content), { headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } });
}

// ─── Cash Flow Statement PDF ───
async function generateCashFlowStatementPdf(admin: any, body: any, corsHeaders: Record<string, string>) {
  const { tenant_id, date_from, date_to } = body;
  if (!tenant_id) return new Response(JSON.stringify({ error: "tenant_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const { data: legalEntity } = await admin.from("legal_entities").select("*").eq("tenant_id", tenant_id).limit(1).maybeSingle();

  // Fetch all posted lines for the period
  let query = admin.from("journal_lines").select("debit, credit, account:chart_of_accounts!inner(code, account_type), journal_entry:journal_entries!inner(status, entry_date, tenant_id)")
    .eq("journal_entry.status", "posted").eq("journal_entry.tenant_id", tenant_id);
  if (date_from) query = query.gte("journal_entry.entry_date", date_from);
  if (date_to) query = query.lte("journal_entry.entry_date", date_to);
  const { data: lines = [] } = await query;

  // Aggregate by prefix
  const byPrefix = new Map<string, number>();
  const revenue = { total: 0 }, expenses = { total: 0 };
  for (const l of lines as any[]) {
    const code = l.account?.code || "";
    for (const len of [1, 2, 3]) {
      const p = code.substring(0, len);
      byPrefix.set(p, (byPrefix.get(p) || 0) + Number(l.debit) - Number(l.credit));
    }
    if (l.account?.account_type === "revenue") revenue.total += Number(l.credit) - Number(l.debit);
    if (l.account?.account_type === "expense") expenses.total += Number(l.debit) - Number(l.credit);
  }
  const netIncome = revenue.total - expenses.total;
  const depreciation = Math.abs(byPrefix.get("540") || 0);
  const operatingCF = netIncome + depreciation;
  const investingCF = -(Math.abs(byPrefix.get("02") || 0) + Math.abs(byPrefix.get("01") || 0));
  const financingCF = byPrefix.get("41") || 0;

  const periodLabel = date_from && date_to ? `${formatDate(date_from)} — ${formatDate(date_to)}` : "Svi periodi";

  const row = (label: string, amount: number) => `<tr><td>${label}</td><td class="right" style="color:${amount >= 0 ? '#16a34a' : '#dc2626'}">${formatNum(amount)}</td></tr>`;
  const totalRow = (label: string, amount: number) => `<tr class="totals-row"><td style="font-weight:bold">${label}</td><td class="right" style="font-weight:bold;color:${amount >= 0 ? '#16a34a' : '#dc2626'}">${formatNum(amount)}</td></tr>`;

  const content = `${companyHeader(legalEntity)}
  <div class="report-title">IZVEŠTAJ O TOKOVIMA GOTOVINE</div>
  <div class="report-subtitle">${periodLabel} — Indirektni metod</div>
  <div class="section-header">A. Poslovne aktivnosti</div>
  <table><tbody>
    ${row("Neto rezultat", netIncome)}
    ${row("Amortizacija", depreciation)}
    ${totalRow("Neto gotovina iz poslovnih aktivnosti", operatingCF)}
  </tbody></table>
  <div class="section-header">B. Investicione aktivnosti</div>
  <table><tbody>
    ${row("Nabavka osnovnih sredstava", -(Math.abs(byPrefix.get("02") || 0)))}
    ${row("Nabavka nematerijalnih ulaganja", -(Math.abs(byPrefix.get("01") || 0)))}
    ${totalRow("Neto gotovina iz investicija", investingCF)}
  </tbody></table>
  <div class="section-header">C. Finansijske aktivnosti</div>
  <table><tbody>
    ${row("Neto kreditna aktivnost", financingCF)}
    ${totalRow("Neto gotovina iz finansiranja", financingCF)}
  </tbody></table>
  <div class="summary-box" style="display:flex;justify-content:space-between;align-items:center;">
    <div><div class="summary-label">Ukupna promena gotovine</div><div class="summary-value" style="color:${(operatingCF + investingCF + financingCF) >= 0 ? '#16a34a' : '#dc2626'}">${formatNum(operatingCF + investingCF + financingCF)} RSD</div></div>
  </div>`;

  return new Response(wrapHtml("Tokovi Gotovine", content), { headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } });
}
