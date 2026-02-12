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

    const { invoice_id } = await req.json();
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
