import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// --- UBL 2.1 XML Builder for Serbian eFaktura ---

function escapeXml(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatAmount(n: number): string {
  return n.toFixed(2);
}

function formatPrice(n: number): string {
  // SEF allows up to 4 decimals for cbc:PriceAmount
  const s = n.toFixed(4);
  // Trim trailing zeros but keep at least 2 decimals
  return s.replace(/0{1,2}$/, '');
}

/** Map tax_rate_value to UBL TaxCategory ID per Serbian eFaktura 2026 spec.
 *  2026 change (Sl. glasnik RS 109/2025): S split into S10/S20, AE split into AE10/AE20.
 *  Effective for tax periods starting after March 31, 2026. */
function getTaxCategoryId(taxRateValue: number, isReverseCharge = false): string {
  if (taxRateValue === 0) return "O"; // Zero-rated / exempt
  if (isReverseCharge) {
    // Reverse charge: AE10 for 10%, AE20 for 20%
    return taxRateValue === 10 ? "AE10" : "AE20";
  }
  // Standard rated: S10 for 10%, S20 for 20%
  return taxRateValue === 10 ? "S10" : "S20";
}

interface InvoiceLine {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  tax_amount: number;
  tax_rate_value: number;
  total_with_tax: number;
  sort_order: number;
  product_id: string | null;
}

interface SupplierInfo {
  pib: string;
  maticni_broj: string;
  name: string;
  address: string;
  city: string;
  postal_code: string;
  country: string;
  email?: string;
  bank_account?: string;
}

interface BuyerInfo {
  pib: string;
  maticni_broj: string;
  name: string;
  address: string;
  city: string;
  postal_code: string;
  country: string;
  email?: string;
}

interface InvoiceData {
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  currency: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  notes: string | null;
  advance_amount_applied: number;
}

function buildUblXml(
  invoice: InvoiceData,
  supplier: SupplierInfo,
  buyer: BuyerInfo,
  lines: InvoiceLine[],
  isReverseCharge = false
): string {
  // Group lines by tax rate for TaxSubtotal
  const taxGroups = new Map<number, { taxable: number; tax: number }>();
  for (const line of lines) {
    const key = line.tax_rate_value;
    const existing = taxGroups.get(key) || { taxable: 0, tax: 0 };
    existing.taxable += line.line_total;
    existing.tax += line.tax_amount;
    taxGroups.set(key, existing);
  }

  const taxSubtotals = Array.from(taxGroups.entries())
    .map(
      ([rate, amounts]) => `
      <cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="${escapeXml(invoice.currency)}">${formatAmount(amounts.taxable)}</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="${escapeXml(invoice.currency)}">${formatAmount(amounts.tax)}</cbc:TaxAmount>
        <cac:TaxCategory>
          <cbc:ID>${getTaxCategoryId(rate, isReverseCharge)}</cbc:ID>
          <cbc:Percent>${rate}</cbc:Percent>
          <cac:TaxScheme>
            <cbc:ID>VAT</cbc:ID>
          </cac:TaxScheme>
        </cac:TaxCategory>
      </cac:TaxSubtotal>`
    )
    .join("");

  const invoiceLines = lines
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(
      (line, idx) => `
    <cac:InvoiceLine>
      <cbc:ID>${idx + 1}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="C62">${line.quantity}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="${escapeXml(invoice.currency)}">${formatAmount(line.line_total)}</cbc:LineExtensionAmount>
      <cac:Item>
        <cbc:Name>${escapeXml(line.description)}</cbc:Name>${
        line.product_id
          ? `
        <cac:SellersItemIdentification>
          <cbc:ID>${escapeXml(line.product_id)}</cbc:ID>
        </cac:SellersItemIdentification>`
          : ""
      }
        <cac:ClassifiedTaxCategory>
          <cbc:ID>${getTaxCategoryId(line.tax_rate_value, isReverseCharge)}</cbc:ID>
          <cbc:Percent>${line.tax_rate_value}</cbc:Percent>
          <cac:TaxScheme>
            <cbc:ID>VAT</cbc:ID>
          </cac:TaxScheme>
        </cac:ClassifiedTaxCategory>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="${escapeXml(invoice.currency)}">${formatPrice(line.unit_price)}</cbc:PriceAmount>
      </cac:Price>
    </cac:InvoiceLine>`
    )
    .join("");

  const prepaidAmount = invoice.advance_amount_applied || 0;
  const payableAmount = invoice.total - prepaidAmount;

  const supplierCountry = supplier.country || "RS";
  const buyerCountry = buyer.country || "RS";

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns:cec="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:sbt="http://mfin.gov.rs/srbdt/srbdtext" xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:mfin.gov.rs:srbdt:2022</cbc:CustomizationID>
  <cbc:ID>${escapeXml(invoice.invoice_number)}</cbc:ID>
  <cbc:IssueDate>${escapeXml(invoice.invoice_date)}</cbc:IssueDate>${
    invoice.due_date
      ? `
  <cbc:DueDate>${escapeXml(invoice.due_date)}</cbc:DueDate>`
      : ""
  }
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>${
    invoice.notes
      ? `
  <cbc:Note>${escapeXml(invoice.notes)}</cbc:Note>`
      : ""
  }
  <cbc:DocumentCurrencyCode>${escapeXml(invoice.currency)}</cbc:DocumentCurrencyCode>
  <cac:InvoicePeriod>
    <cbc:DescriptionCode>35</cbc:DescriptionCode>
  </cac:InvoicePeriod>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cbc:EndpointID schemeID="9948">${escapeXml(supplier.pib)}</cbc:EndpointID>
      <cac:PartyName>
        <cbc:Name>${escapeXml(supplier.name)}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${escapeXml(supplier.address)}</cbc:StreetName>
        <cbc:CityName>${escapeXml(supplier.city)}</cbc:CityName>${
    supplier.postal_code
      ? `
        <cbc:PostalZone>${escapeXml(supplier.postal_code)}</cbc:PostalZone>`
      : ""
  }
        <cac:Country>
          <cbc:IdentificationCode>${escapeXml(supplierCountry)}</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>RS${escapeXml(supplier.pib)}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escapeXml(supplier.name)}</cbc:RegistrationName>${
    supplier.maticni_broj
      ? `
        <cbc:CompanyID>${escapeXml(supplier.maticni_broj)}</cbc:CompanyID>`
      : ""
  }
      </cac:PartyLegalEntity>${
    supplier.email
      ? `
      <cac:Contact>
        <cbc:ElectronicMail>${escapeXml(supplier.email)}</cbc:ElectronicMail>
      </cac:Contact>`
      : ""
  }
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cbc:EndpointID schemeID="9948">${escapeXml(buyer.pib)}</cbc:EndpointID>
      <cac:PartyName>
        <cbc:Name>${escapeXml(buyer.name)}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${escapeXml(buyer.address)}</cbc:StreetName>
        <cbc:CityName>${escapeXml(buyer.city)}</cbc:CityName>${
    buyer.postal_code
      ? `
        <cbc:PostalZone>${escapeXml(buyer.postal_code)}</cbc:PostalZone>`
      : ""
  }
        <cac:Country>
          <cbc:IdentificationCode>${escapeXml(buyerCountry)}</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>RS${escapeXml(buyer.pib)}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escapeXml(buyer.name)}</cbc:RegistrationName>${
    buyer.maticni_broj
      ? `
        <cbc:CompanyID>${escapeXml(buyer.maticni_broj)}</cbc:CompanyID>`
      : ""
  }
      </cac:PartyLegalEntity>${
    buyer.email
      ? `
      <cac:Contact>
        <cbc:ElectronicMail>${escapeXml(buyer.email)}</cbc:ElectronicMail>
      </cac:Contact>`
      : ""
  }
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:Delivery>
    <cbc:ActualDeliveryDate>${escapeXml(invoice.invoice_date)}</cbc:ActualDeliveryDate>
  </cac:Delivery>
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>${
    supplier.bank_account
      ? `
    <cac:PayeeFinancialAccount>
      <cbc:ID>${escapeXml(supplier.bank_account)}</cbc:ID>
    </cac:PayeeFinancialAccount>`
      : ""
  }
  </cac:PaymentMeans>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${escapeXml(invoice.currency)}">${formatAmount(invoice.tax_amount)}</cbc:TaxAmount>${taxSubtotals}
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${escapeXml(invoice.currency)}">${formatAmount(invoice.subtotal)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${escapeXml(invoice.currency)}">${formatAmount(invoice.subtotal)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${escapeXml(invoice.currency)}">${formatAmount(invoice.total)}</cbc:TaxInclusiveAmount>
    <cbc:AllowanceTotalAmount currencyID="${escapeXml(invoice.currency)}">0.00</cbc:AllowanceTotalAmount>
    <cbc:PrepaidAmount currencyID="${escapeXml(invoice.currency)}">${formatAmount(prepaidAmount)}</cbc:PrepaidAmount>
    <cbc:PayableRoundingAmount currencyID="${escapeXml(invoice.currency)}">0.00</cbc:PayableRoundingAmount>
    <cbc:PayableAmount currencyID="${escapeXml(invoice.currency)}">${formatAmount(payableAmount)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>${invoiceLines}
</Invoice>`;
}

// --- Main handler ---

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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

    const { invoice_id, tenant_id, test, request_id } = await req.json();

    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify tenant membership
    const { data: membership } = await supabase
      .from("tenant_members").select("id")
      .eq("user_id", caller.id).eq("tenant_id", tenant_id).eq("status", "active").maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: "Forbidden: not a member of this tenant" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Look up SEF connection
    const { data: connection, error: connErr } = await supabase
      .from("sef_connections")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("is_active", true)
      .maybeSingle();

    if (connErr || !connection) {
      return new Response(
        JSON.stringify({ error: "SEF connection not configured or inactive" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Test mode: just verify connection is active
    if (test) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "SEF connection is active",
          environment: connection.environment,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!invoice_id) {
      return new Response(JSON.stringify({ error: "invoice_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Idempotency check ---
    const sefRequestId = request_id || crypto.randomUUID();

    const { data: existingSub } = await supabase
      .from("sef_submissions")
      .select("*")
      .eq("invoice_id", invoice_id)
      .eq("tenant_id", tenant_id)
      .in("status", ["pending", "submitted", "accepted"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingSub) {
      if (existingSub.status === "accepted") {
        return new Response(
          JSON.stringify({
            success: true, status: "accepted", sef_invoice_id: existingSub.sef_invoice_id,
            message: "Invoice already accepted by SEF", idempotent: true,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (existingSub.status === "pending" || existingSub.status === "submitted") {
        await supabase.from("sef_submissions").update({ status: "submitted" }).eq("id", existingSub.id);
        return new Response(
          JSON.stringify({
            success: true, status: existingSub.status,
            message: "Submission already in progress. Poll status to confirm.",
            submission_id: existingSub.id, idempotent: true,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Fetch invoice with lines
    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .select("*, invoice_lines(*)")
      .eq("id", invoice_id)
      .eq("tenant_id", tenant_id)
      .single();

    if (invErr || !invoice) {
      return new Response(
        JSON.stringify({ error: "Invoice not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch supplier (legal entity) and buyer (partner) data for UBL parties
    const [legalEntityRes, partnerRes, bankAccountRes] = await Promise.all([
      invoice.legal_entity_id
        ? supabase.from("legal_entities").select("*").eq("id", invoice.legal_entity_id).single()
        : Promise.resolve({ data: null, error: null }),
      invoice.partner_id
        ? supabase.from("partners").select("*").eq("id", invoice.partner_id).single()
        : Promise.resolve({ data: null, error: null }),
      // Get primary bank account for the legal entity
      invoice.legal_entity_id
        ? supabase.from("bank_accounts").select("account_number").eq("legal_entity_id", invoice.legal_entity_id).eq("is_primary", true).eq("is_active", true).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    const legalEntity = legalEntityRes.data;
    const partner = partnerRes.data;

    if (!legalEntity || !legalEntity.pib) {
      return new Response(
        JSON.stringify({ error: "Legal entity with PIB is required for SEF submission. Please configure the legal entity on this invoice." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const buyerPib = partner?.pib || invoice.partner_pib;
    if (!buyerPib) {
      return new Response(
        JSON.stringify({ error: "Buyer PIB (partner tax ID) is required for SEF submission." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build supplier and buyer info
    const supplierInfo: SupplierInfo = {
      pib: legalEntity.pib,
      maticni_broj: legalEntity.maticni_broj || "",
      name: legalEntity.name,
      address: legalEntity.address || "",
      city: legalEntity.city || "",
      postal_code: legalEntity.postal_code || "",
      country: legalEntity.country || "RS",
      bank_account: bankAccountRes.data?.account_number || undefined,
    };

    const buyerInfo: BuyerInfo = {
      pib: buyerPib,
      maticni_broj: partner?.maticni_broj || "",
      name: partner?.name || invoice.partner_name,
      address: partner?.address || invoice.partner_address || "",
      city: partner?.city || "",
      postal_code: partner?.postal_code || "",
      country: partner?.country || "RS",
      email: partner?.email || undefined,
    };

    const invoiceData: InvoiceData = {
      invoice_number: invoice.invoice_number,
      invoice_date: invoice.invoice_date,
      due_date: invoice.due_date || "",
      currency: invoice.currency,
      subtotal: invoice.subtotal,
      tax_amount: invoice.tax_amount,
      total: invoice.total,
      notes: invoice.notes,
      advance_amount_applied: invoice.advance_amount_applied || 0,
    };

    const invoiceLines: InvoiceLine[] = (invoice.invoice_lines || []).map((line: any) => ({
      id: line.id,
      description: line.description,
      quantity: line.quantity,
      unit_price: line.unit_price,
      line_total: line.line_total,
      tax_amount: line.tax_amount,
      tax_rate_value: line.tax_rate_value,
      total_with_tax: line.total_with_tax,
      sort_order: line.sort_order,
      product_id: line.product_id,
    }));

    // Generate UBL 2.1 XML — detect reverse charge from sale_type
    const isReverseCharge = invoice.sale_type === 'reverse_charge';
    const ublXml = buildUblXml(invoiceData, supplierInfo, buyerInfo, invoiceLines, isReverseCharge);

    // Create submission record
    const { data: submission, error: subErr } = await supabase
      .from("sef_submissions")
      .insert({
        tenant_id,
        invoice_id,
        sef_connection_id: connection.id,
        status: "pending",
        request_payload: { requestId: sefRequestId, format: "UBL2.1", invoice_number: invoice.invoice_number },
      })
      .select()
      .single();

    if (subErr) {
      return new Response(JSON.stringify({ error: subErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sandbox mode: simulate acceptance
    if (connection.environment === "sandbox") {
      const fakeSefId = `SEF-${Date.now()}`;

      await supabase.from("sef_submissions").update({
        status: "accepted", sef_invoice_id: fakeSefId,
        response_payload: { simulated: true, sef_id: fakeSefId, format: "UBL2.1" },
        resolved_at: new Date().toISOString(),
      }).eq("id", submission.id);

      await supabase.from("invoices").update({ sef_status: "accepted" }).eq("id", invoice_id);
      await supabase.from("sef_connections").update({ last_sync_at: new Date().toISOString(), last_error: null }).eq("id", connection.id);

      return new Response(
        JSON.stringify({ success: true, status: "accepted", sef_invoice_id: fakeSefId, simulated: true, format: "UBL2.1" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Production mode: real API call with UBL XML payload
    try {
      const uploadUrl = `${connection.api_url}/publicApi/sales-invoice/ubl/upload/${sefRequestId}`;
      const apiRes = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "ApiKey": connection.api_key_encrypted,
          "Content-Type": "application/xml",
          "Accept": "application/json",
        },
        body: ublXml,
      });

      if (apiRes.status === 429) {
        await supabase.from("sef_submissions").update({
          status: "rate_limited",
          response_payload: { status: 429, message: "Rate limited" },
        }).eq("id", submission.id);

        await supabase.from("invoices").update({ sef_status: "submitted" }).eq("id", invoice_id);

        return new Response(JSON.stringify({
          success: false, status: "rate_limited",
          message: "SEF rate limit exceeded (3 req/sec). Retry after delay.",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const resBody = await apiRes.json().catch(async () => ({ raw: await apiRes.text() }));

      if (apiRes.ok) {
        await supabase.from("sef_submissions").update({
          status: "submitted",
          response_payload: resBody,
        }).eq("id", submission.id);

        await supabase.from("invoices").update({ sef_status: "submitted" }).eq("id", invoice_id);
        await supabase.from("sef_connections").update({ last_sync_at: new Date().toISOString(), last_error: null }).eq("id", connection.id);

        return new Response(JSON.stringify({
          success: true, status: "submitted",
          message: "UBL 2.1 XML uploaded. Poll status endpoint to confirm acceptance.",
          format: "UBL2.1",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } else {
        await supabase.from("sef_submissions").update({
          status: "error",
          response_payload: resBody,
        }).eq("id", submission.id);

        await supabase.from("sef_connections").update({ last_error: JSON.stringify(resBody) }).eq("id", connection.id);

        return new Response(JSON.stringify({
          success: false, status: "error",
          message: `SEF API returned ${apiRes.status}`,
          details: resBody,
        }), { status: apiRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } catch (fetchErr: unknown) {
      const errMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      await supabase.from("sef_submissions").update({
        status: "error",
        response_payload: { error: errMsg },
      }).eq("id", submission.id);

      await supabase.from("sef_connections").update({ last_error: errMsg }).eq("id", connection.id);

      return new Response(JSON.stringify({
        success: false, status: "error", message: errMsg,
      }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
