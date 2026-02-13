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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { type, invoice_id, payroll_item_id } = body;

    if (type === "payslip" && payroll_item_id) {
      return await generatePayslip(admin, payroll_item_id, corsHeaders);
    }

    if (!invoice_id) {
      return new Response(JSON.stringify({ error: "invoice_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch invoice
    const { data: invoice, error: invErr } = await admin
      .from("invoices")
      .select("*")
      .eq("id", invoice_id)
      .single();
    if (invErr || !invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user belongs to tenant
    const { data: membership } = await admin
      .from("tenant_members")
      .select("id")
      .eq("user_id", user.id)
      .eq("tenant_id", invoice.tenant_id)
      .eq("status", "active")
      .maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch invoice lines
    const { data: lines = [] } = await admin
      .from("invoice_lines")
      .select("*")
      .eq("invoice_id", invoice_id)
      .order("sort_order");

    // Fetch legal entity
    const { data: legalEntity } = await admin
      .from("legal_entities")
      .select("*")
      .eq("tenant_id", invoice.tenant_id)
      .limit(1)
      .maybeSingle();

    // Fetch bank account
    const { data: bankAccount } = await admin
      .from("bank_accounts")
      .select("*")
      .eq("tenant_id", invoice.tenant_id)
      .eq("is_primary", true)
      .limit(1)
      .maybeSingle();

    // Build HTML invoice
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
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
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company-name">${legalEntity?.name || "Company"}</div>
      <div class="company-info">
        ${legalEntity?.address ? `${legalEntity.address}<br>` : ""}
        ${legalEntity?.city ? `${legalEntity.city}, ` : ""}${legalEntity?.country || "RS"}<br>
        ${legalEntity?.pib ? `PIB: ${legalEntity.pib}<br>` : ""}
        ${legalEntity?.maticni_broj ? `Matični broj: ${legalEntity.maticni_broj}` : ""}
      </div>
    </div>
    <div>
      <div class="invoice-title">FAKTURA</div>
      <div class="invoice-meta">
        <strong>Broj:</strong> ${invoice.invoice_number}<br>
        <strong>Datum:</strong> ${formatDate(invoice.invoice_date)}<br>
        ${invoice.due_date ? `<strong>Rok plaćanja:</strong> ${formatDate(invoice.due_date)}<br>` : ""}
        <strong>Valuta:</strong> ${invoice.currency}
      </div>
    </div>
  </div>

  <div class="partner-section">
    <div class="partner-label">Kupac / Partner</div>
    <div class="partner-name">${invoice.partner_name}</div>
    ${invoice.partner_address ? `<div>${invoice.partner_address}</div>` : ""}
    ${invoice.partner_pib ? `<div>PIB: ${invoice.partner_pib}</div>` : ""}
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Opis</th>
        <th class="right">Količina</th>
        <th class="right">Cena</th>
        <th class="right">PDV %</th>
        <th class="right">PDV</th>
        <th class="right">Ukupno</th>
      </tr>
    </thead>
    <tbody>
      ${(lines || []).map((line: any, i: number) => `
        <tr>
          <td>${i + 1}</td>
          <td>${line.description || ""}</td>
          <td class="right">${formatNum(Number(line.quantity))}</td>
          <td class="right">${formatNum(Number(line.unit_price))}</td>
          <td class="right">${Number(line.tax_rate_value)}%</td>
          <td class="right">${formatNum(Number(line.tax_amount))}</td>
          <td class="right">${formatNum(Number(line.total_with_tax))}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-row"><span>Osnova:</span><span>${formatNum(Number(invoice.subtotal))} ${invoice.currency}</span></div>
    <div class="totals-row"><span>PDV:</span><span>${formatNum(Number(invoice.tax_amount))} ${invoice.currency}</span></div>
    <div class="totals-row grand"><span>UKUPNO:</span><span>${formatNum(Number(invoice.total))} ${invoice.currency}</span></div>
  </div>

  ${bankAccount ? `
  <div class="bank-info">
    <span class="bank-label">Podaci za uplatu:</span><br>
    Banka: ${bankAccount.bank_name}<br>
    Račun: ${bankAccount.account_number}
  </div>
  ` : ""}

  ${invoice.notes ? `<div style="margin-top:20px;"><strong>Napomena:</strong> ${invoice.notes}</div>` : ""}

  <div class="footer">
    Faktura je generisana elektronski i važi bez potpisa i pečata.
  </div>
</body>
</html>`;

    return new Response(html, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function generatePayslip(admin: any, payrollItemId: string, corsHeaders: Record<string, string>) {
  const { data: item, error: itemErr } = await admin
    .from("payroll_items")
    .select("*, payroll_runs(period_month, period_year, status, tenant_id)")
    .eq("id", payrollItemId)
    .single();
  if (itemErr || !item) {
    return new Response(JSON.stringify({ error: "Payroll item not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const tenantId = item.payroll_runs?.tenant_id;

  const { data: employee } = await admin
    .from("employees")
    .select("*, departments(name), locations(name)")
    .eq("id", item.employee_id)
    .single();

  const { data: legalEntity } = await admin
    .from("legal_entities")
    .select("*")
    .eq("tenant_id", tenantId)
    .limit(1)
    .maybeSingle();

  const period = item.payroll_runs;
  const months = ["Januar", "Februar", "Mart", "April", "Maj", "Jun", "Jul", "Avgust", "Septembar", "Oktobar", "Novembar", "Decembar"];
  const periodLabel = `${months[(period?.period_month || 1) - 1]} ${period?.period_year || ""}`;

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; color: #333; margin: 40px; }
  .header { display: flex; justify-content: space-between; margin-bottom: 30px; }
  .company-name { font-size: 18px; font-weight: bold; color: #1a1a1a; }
  .company-info { font-size: 11px; line-height: 1.6; }
  .title { font-size: 22px; font-weight: bold; color: #2563eb; text-align: center; margin: 20px 0; }
  .subtitle { text-align: center; font-size: 14px; color: #666; margin-bottom: 24px; }
  .employee-section { background: #f8f9fa; padding: 16px; border-radius: 6px; margin-bottom: 24px; }
  .emp-label { font-size: 10px; text-transform: uppercase; color: #666; margin-bottom: 2px; }
  .emp-value { font-size: 13px; font-weight: 600; }
  .emp-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th { background: #2563eb; color: white; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; }
  th.right { text-align: right; }
  td { padding: 10px 12px; border-bottom: 1px solid #eee; }
  td.right { text-align: right; font-variant-numeric: tabular-nums; }
  .totals { margin-left: auto; width: 300px; margin-top: 20px; }
  .totals-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #eee; }
  .totals-row.grand { font-size: 16px; font-weight: bold; border-top: 2px solid #333; border-bottom: none; padding-top: 10px; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 10px; color: #666; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company-name">${legalEntity?.name || "Company"}</div>
      <div class="company-info">
        ${legalEntity?.address ? `${legalEntity.address}<br>` : ""}
        ${legalEntity?.city ? `${legalEntity.city}, ` : ""}${legalEntity?.country || "RS"}<br>
        ${legalEntity?.pib ? `PIB: ${legalEntity.pib}` : ""}
      </div>
    </div>
  </div>

  <div class="title">PLATNA LISTA</div>
  <div class="subtitle">${periodLabel}</div>

  <div class="employee-section">
    <div class="emp-grid">
      <div><div class="emp-label">Ime i prezime</div><div class="emp-value">${employee?.full_name || "—"}</div></div>
      <div><div class="emp-label">JMBG</div><div class="emp-value">${employee?.jmbg || "—"}</div></div>
      <div><div class="emp-label">Pozicija</div><div class="emp-value">${employee?.position || "—"}</div></div>
      <div><div class="emp-label">Odeljenje</div><div class="emp-value">${employee?.departments?.name || "—"}</div></div>
      <div><div class="emp-label">Lokacija</div><div class="emp-value">${employee?.locations?.name || "—"}</div></div>
      <div><div class="emp-label">Radni dani</div><div class="emp-value">${item.actual_working_days} / ${item.working_days}</div></div>
    </div>
  </div>

  <table>
    <thead><tr>
      <th>Stavka</th>
      <th class="right">Iznos (RSD)</th>
    </tr></thead>
    <tbody>
      <tr><td>Bruto zarada</td><td class="right">${formatNum(Number(item.gross_salary))}</td></tr>
      <tr><td>Oporezivi osnov</td><td class="right">${formatNum(Number(item.taxable_base))}</td></tr>
      <tr><td>Porez na dohodak (10%)</td><td class="right">- ${formatNum(Number(item.income_tax))}</td></tr>
      <tr><td>PIO doprinos (14%)</td><td class="right">- ${formatNum(Number(item.pension_contribution))}</td></tr>
      <tr><td>Zdravstveno osiguranje (5.15%)</td><td class="right">- ${formatNum(Number(item.health_contribution))}</td></tr>
      <tr><td>Osiguranje od nezaposlenosti (0.75%)</td><td class="right">- ${formatNum(Number(item.unemployment_contribution))}</td></tr>
      ${item.overtime_hours_count > 0 ? `<tr><td>Prekovremeni rad (${item.overtime_hours_count}h)</td><td class="right">uklj.</td></tr>` : ""}
      ${item.night_work_hours_count > 0 ? `<tr><td>Noćni rad (${item.night_work_hours_count}h)</td><td class="right">uklj.</td></tr>` : ""}
      ${item.leave_days_deducted > 0 ? `<tr><td>Odbitak za odsustvo (${item.leave_days_deducted} dana)</td><td class="right">- ${formatNum(Number(item.leave_deduction_amount))}</td></tr>` : ""}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-row"><span>Bruto zarada:</span><span>${formatNum(Number(item.gross_salary))} RSD</span></div>
    <div class="totals-row"><span>Ukupni doprinosi:</span><span>${formatNum(Number(item.pension_contribution) + Number(item.health_contribution) + Number(item.unemployment_contribution))} RSD</span></div>
    <div class="totals-row"><span>Porez:</span><span>${formatNum(Number(item.income_tax))} RSD</span></div>
    <div class="totals-row grand"><span>NETO ZARADA:</span><span>${formatNum(Number(item.net_salary))} RSD</span></div>
    <div class="totals-row" style="margin-top:12px; color:#666;"><span>Ukupan trošak poslodavca:</span><span>${formatNum(Number(item.total_cost))} RSD</span></div>
  </div>

  <div class="footer">
    Platna lista je generisana elektronski.
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
  });
}
