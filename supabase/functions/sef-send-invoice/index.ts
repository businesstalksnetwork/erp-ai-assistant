import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// SEF API endpoints
const SEF_API_BASE = 'https://efaktura.mfin.gov.rs/api/publicApi';

interface InvoiceData {
  invoiceId: string;
  companyId: string;
  action?: 'send' | 'storno';
  originalSefId?: string; // For storno - the SEF ID of the original invoice
}

interface Company {
  id: string;
  name: string;
  pib: string;
  maticni_broj: string;
  address: string;
  bank_account: string | null;
  sef_api_key: string | null;
}

interface Invoice {
  id: string;
  invoice_number: string;
  issue_date: string;
  service_date: string | null;
  client_name: string;
  client_address: string | null;
  client_pib: string | null;
  client_maticni_broj: string | null;
  client_type: 'domestic' | 'foreign';
  description: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  foreign_currency: string | null;
  foreign_amount: number | null;
  exchange_rate: number | null;
  payment_deadline: string | null;
  payment_method: string | null;
  note: string | null;
  is_proforma: boolean;
}

interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  item_type: 'products' | 'services';
}

function formatDate(dateStr: string): string {
  return dateStr; // Already in YYYY-MM-DD format
}

function formatVatId(value: string): string {
  const v = value.replace(/\s+/g, '');
  return v.startsWith('RS') ? v : `RS${v}`;
}

function generateUBLXml(invoice: Invoice, company: Company, items: InvoiceItem[]): string {
  const issueDate = formatDate(invoice.issue_date);
  const dueDate = invoice.payment_deadline ? formatDate(invoice.payment_deadline) : issueDate;
  const deliveryDate = formatDate(invoice.service_date ?? invoice.issue_date);
  
  // Calculate totals
  const taxableAmount = invoice.total_amount;
  const taxAmount = 0; // Paušalci nisu u sistemu PDV-a
  const payableAmount = invoice.total_amount;

  // Generate invoice lines
  const invoiceLines = items.map((item, index) => `
    <cac:InvoiceLine>
      <cbc:ID>${index + 1}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="H87">${item.quantity}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="RSD">${item.total_amount.toFixed(2)}</cbc:LineExtensionAmount>
      <cac:Item>
        <cbc:Name>${escapeXml(item.description)}</cbc:Name>
        <cac:ClassifiedTaxCategory>
          <cbc:ID>SS</cbc:ID>
          <cbc:Percent>0</cbc:Percent>
          <cac:TaxScheme>
            <cbc:ID>VAT</cbc:ID>
          </cac:TaxScheme>
        </cac:ClassifiedTaxCategory>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="RSD">${item.unit_price.toFixed(2)}</cbc:PriceAmount>
      </cac:Price>
    </cac:InvoiceLine>`).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:efaktura.mfin.gov.rs:sr-ubl-1.0</cbc:CustomizationID>
  <cbc:ID>${escapeXml(invoice.invoice_number)}</cbc:ID>
  <cbc:IssueDate>${issueDate}</cbc:IssueDate>
  <cbc:DueDate>${dueDate}</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:Note>${escapeXml(invoice.note || 'Obveznik nije u sistemu PDV-a u skladu sa članom 33. Zakona o PDV-u.')}</cbc:Note>
  <cbc:DocumentCurrencyCode>RSD</cbc:DocumentCurrencyCode>
  
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cbc:EndpointID schemeID="9948">${company.pib}</cbc:EndpointID>
      <cac:PartyName>
        <cbc:Name>${escapeXml(company.name)}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${escapeXml(company.address)}</cbc:StreetName>
        <cac:Country>
          <cbc:IdentificationCode>RS</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${formatVatId(company.pib)}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escapeXml(company.name)}</cbc:RegistrationName>
        <cbc:CompanyID>${company.maticni_broj}</cbc:CompanyID>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  
  <cac:AccountingCustomerParty>
    <cac:Party>
      ${invoice.client_pib ? `<cbc:EndpointID schemeID="9948">${invoice.client_pib}</cbc:EndpointID>` : ''}
      <cac:PartyName>
        <cbc:Name>${escapeXml(invoice.client_name)}</cbc:Name>
      </cac:PartyName>
      ${invoice.client_address ? `
      <cac:PostalAddress>
        <cbc:StreetName>${escapeXml(invoice.client_address)}</cbc:StreetName>
        <cac:Country>
          <cbc:IdentificationCode>${invoice.client_type === 'domestic' ? 'RS' : 'XX'}</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>` : ''}
      ${invoice.client_pib ? `
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${invoice.client_type === 'domestic' ? formatVatId(invoice.client_pib!) : invoice.client_pib}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>` : ''}
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escapeXml(invoice.client_name)}</cbc:RegistrationName>
        ${invoice.client_maticni_broj ? `<cbc:CompanyID>${invoice.client_maticni_broj}</cbc:CompanyID>` : ''}
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>

  <cac:Delivery>
    <cbc:ActualDeliveryDate>${deliveryDate}</cbc:ActualDeliveryDate>
  </cac:Delivery>
  
  ${company.bank_account ? `
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>
    <cac:PayeeFinancialAccount>
      <cbc:ID>${company.bank_account.replace(/-/g, '')}</cbc:ID>
    </cac:PayeeFinancialAccount>
  </cac:PaymentMeans>` : ''}
  
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="RSD">${taxAmount.toFixed(2)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="RSD">${taxableAmount.toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="RSD">${taxAmount.toFixed(2)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>SS</cbc:ID>
        <cbc:Percent>0</cbc:Percent>
        <cbc:TaxExemptionReasonCode>VRBL:RS:PDV-RS-33</cbc:TaxExemptionReasonCode>
        <cbc:TaxExemptionReason>Mali poreski obveznik</cbc:TaxExemptionReason>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="RSD">${taxableAmount.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="RSD">${taxableAmount.toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="RSD">${payableAmount.toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="RSD">${payableAmount.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  ${invoiceLines}
</Invoice>`;

  return xml;
}

function escapeXml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { invoiceId, companyId, action = 'send', originalSefId }: InvoiceData = await req.json();

    console.log(`Processing SEF ${action} for invoice: ${invoiceId}`);

    // Get company data with API key
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single();

    if (companyError || !company) {
      throw new Error('Firma nije pronađena');
    }

    if (!company.sef_api_key) {
      throw new Error('SEF API ključ nije podešen. Molimo unesite API ključ u podešavanjima firme.');
    }

    // Get invoice data
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      throw new Error('Faktura nije pronađena');
    }

    if (invoice.is_proforma) {
      throw new Error('Predračuni se ne mogu slati na SEF. Pretvorite predračun u fakturu.');
    }

    // Handle storno action
    if (action === 'storno') {
      if (!originalSefId) {
        throw new Error('SEF ID originalne fakture je obavezan za storniranje');
      }

      console.log(`Cancelling invoice on SEF: ${originalSefId}`);

      // Call SEF cancel API
      const cancelResponse = await fetch(`${SEF_API_BASE}/sales-invoice/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ApiKey': company.sef_api_key,
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          InvoiceId: originalSefId,
          CancelComment: `Storno fakture - ${invoice.description}`,
        }),
      });

      const cancelResult = await cancelResponse.json();
      console.log('SEF Cancel Response:', JSON.stringify(cancelResult));

      if (cancelResponse.ok) {
        // Now send the storno invoice to SEF
        const { data: items } = await supabase
          .from('invoice_items')
          .select('*')
          .eq('invoice_id', invoiceId);

        const invoiceItems: InvoiceItem[] = items && items.length > 0
          ? items.map(item => ({
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              total_amount: item.total_amount,
              item_type: item.item_type,
            }))
          : [{
              description: invoice.description,
              quantity: invoice.quantity,
              unit_price: invoice.unit_price,
              total_amount: invoice.total_amount,
              item_type: invoice.item_type,
            }];

        // Generate credit note UBL XML (InvoiceTypeCode 381)
        const ublXml = generateStornoUBLXml(invoice as Invoice, company as Company, invoiceItems, originalSefId);

        const sefResponse = await fetch(`${SEF_API_BASE}/sales-invoice/ubl`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/xml',
            'ApiKey': company.sef_api_key,
            'Accept': 'application/json',
          },
          body: ublXml,
        });

        const sefResult = await sefResponse.json();
        console.log('SEF Storno Response:', JSON.stringify(sefResult));

        if (sefResponse.ok && sefResult.InvoiceId) {
          await supabase
            .from('invoices')
            .update({
              sef_invoice_id: sefResult.InvoiceId,
              sef_status: 'sent',
              sef_sent_at: new Date().toISOString(),
              sef_error: null,
            })
            .eq('id', invoiceId);

          return new Response(JSON.stringify({
            success: true,
            sefInvoiceId: sefResult.InvoiceId,
            message: 'Storno faktura je uspešno poslata na SEF',
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } else {
          const errorMessage = sefResult.Message || sefResult.message || 'Greška pri slanju storno fakture na SEF';
          await supabase
            .from('invoices')
            .update({ sef_status: 'error', sef_error: errorMessage })
            .eq('id', invoiceId);
          throw new Error(errorMessage);
        }
      } else {
        const errorMessage = cancelResult.Message || cancelResult.message || 'Greška pri storniranju na SEF-u';
        throw new Error(errorMessage);
      }
    }

    // Normal send action
    if (invoice.sef_status === 'sent' || invoice.sef_status === 'approved') {
      throw new Error('Faktura je već poslata na SEF');
    }

    // Get invoice items
    const { data: items, error: itemsError } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoiceId);

    // Use invoice items or fallback to main invoice data
    const invoiceItems: InvoiceItem[] = items && items.length > 0
      ? items.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_amount: item.total_amount,
          item_type: item.item_type,
        }))
      : [{
          description: invoice.description,
          quantity: invoice.quantity,
          unit_price: invoice.unit_price,
          total_amount: invoice.total_amount,
          item_type: invoice.item_type,
        }];

    // Generate UBL XML
    const ublXml = generateUBLXml(invoice as Invoice, company as Company, invoiceItems);

    // Debug: confirm EndpointID/@schemeID is set as expected
    const endpointTag = ublXml.match(/<cbc:EndpointID[^>]*>[^<]*<\/cbc:EndpointID>/)?.[0];
    const endpointScheme = ublXml.match(/<cbc:EndpointID[^>]*schemeID="([^"]+)"/)?.[1];
    console.log('UBL EndpointID tag:', endpointTag);
    console.log('UBL EndpointID schemeID:', endpointScheme);

    console.log('Generated UBL XML, sending to SEF...');

    // Update status to pending
    await supabase
      .from('invoices')
      .update({ sef_status: 'pending' })
      .eq('id', invoiceId);

    // Send to SEF
    const sefResponse = await fetch(`${SEF_API_BASE}/sales-invoice/ubl`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml',
        'ApiKey': company.sef_api_key,
        'Accept': 'application/json',
      },
      body: ublXml,
    });

    const sefResult = await sefResponse.json();

    console.log('SEF Response:', JSON.stringify(sefResult));

    if (sefResponse.ok && sefResult.InvoiceId) {
      // Success - update invoice with SEF ID
      await supabase
        .from('invoices')
        .update({
          sef_invoice_id: sefResult.InvoiceId,
          sef_status: 'sent',
          sef_sent_at: new Date().toISOString(),
          sef_error: null,
        })
        .eq('id', invoiceId);

      return new Response(JSON.stringify({
        success: true,
        sefInvoiceId: sefResult.InvoiceId,
        message: 'Faktura je uspešno poslata na SEF',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      // Error from SEF
      const errorMessage = sefResult.Message || sefResult.message || 'Nepoznata greška sa SEF-a';
      
      await supabase
        .from('invoices')
        .update({
          sef_status: 'error',
          sef_error: errorMessage,
        })
        .eq('id', invoiceId);

      throw new Error(errorMessage);
    }
  } catch (error: unknown) {
    console.error('SEF submission error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Greška pri slanju na SEF';
    
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function generateStornoUBLXml(invoice: Invoice, company: Company, items: InvoiceItem[], originalSefId: string): string {
  const issueDate = formatDate(invoice.issue_date);
  const deliveryDate = formatDate(invoice.service_date ?? invoice.issue_date);
  
  // Use absolute values for amounts (they're already negative in the invoice)
  const taxableAmount = Math.abs(invoice.total_amount);
  const taxAmount = 0;
  const payableAmount = Math.abs(invoice.total_amount);

  const invoiceLines = items.map((item, index) => `
    <cac:CreditNoteLine>
      <cbc:ID>${index + 1}</cbc:ID>
      <cbc:CreditedQuantity unitCode="H87">${item.quantity}</cbc:CreditedQuantity>
      <cbc:LineExtensionAmount currencyID="RSD">${Math.abs(item.total_amount).toFixed(2)}</cbc:LineExtensionAmount>
      <cac:Item>
        <cbc:Name>${escapeXml(item.description)}</cbc:Name>
        <cac:ClassifiedTaxCategory>
          <cbc:ID>SS</cbc:ID>
          <cbc:Percent>0</cbc:Percent>
          <cac:TaxScheme>
            <cbc:ID>VAT</cbc:ID>
          </cac:TaxScheme>
        </cac:ClassifiedTaxCategory>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="RSD">${Math.abs(item.unit_price).toFixed(2)}</cbc:PriceAmount>
      </cac:Price>
    </cac:CreditNoteLine>`).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<CreditNote xmlns="urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:efaktura.mfin.gov.rs:sr-ubl-1.0</cbc:CustomizationID>
  <cbc:ID>${escapeXml(invoice.invoice_number)}</cbc:ID>
  <cbc:IssueDate>${issueDate}</cbc:IssueDate>
  <cbc:CreditNoteTypeCode>381</cbc:CreditNoteTypeCode>
  <cbc:Note>${escapeXml(invoice.note || 'Storno faktura')}</cbc:Note>
  <cbc:DocumentCurrencyCode>RSD</cbc:DocumentCurrencyCode>

  <cac:BillingReference>
    <cac:InvoiceDocumentReference>
      <cbc:ID>${originalSefId}</cbc:ID>
    </cac:InvoiceDocumentReference>
  </cac:BillingReference>
  
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cbc:EndpointID schemeID="9948">${company.pib}</cbc:EndpointID>
      <cac:PartyName>
        <cbc:Name>${escapeXml(company.name)}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${escapeXml(company.address)}</cbc:StreetName>
        <cac:Country>
          <cbc:IdentificationCode>RS</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${formatVatId(company.pib)}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escapeXml(company.name)}</cbc:RegistrationName>
        <cbc:CompanyID>${company.maticni_broj}</cbc:CompanyID>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  
  <cac:AccountingCustomerParty>
    <cac:Party>
      ${invoice.client_pib ? `<cbc:EndpointID schemeID="9948">${invoice.client_pib}</cbc:EndpointID>` : ''}
      <cac:PartyName>
        <cbc:Name>${escapeXml(invoice.client_name)}</cbc:Name>
      </cac:PartyName>
      ${invoice.client_address ? `
      <cac:PostalAddress>
        <cbc:StreetName>${escapeXml(invoice.client_address)}</cbc:StreetName>
        <cac:Country>
          <cbc:IdentificationCode>${invoice.client_type === 'domestic' ? 'RS' : 'XX'}</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>` : ''}
      ${invoice.client_pib ? `
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${invoice.client_type === 'domestic' ? formatVatId(invoice.client_pib!) : invoice.client_pib}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>` : ''}
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escapeXml(invoice.client_name)}</cbc:RegistrationName>
        ${invoice.client_maticni_broj ? `<cbc:CompanyID>${invoice.client_maticni_broj}</cbc:CompanyID>` : ''}
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>

  <cac:Delivery>
    <cbc:ActualDeliveryDate>${deliveryDate}</cbc:ActualDeliveryDate>
  </cac:Delivery>
   
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="RSD">${taxAmount.toFixed(2)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="RSD">${taxableAmount.toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="RSD">${taxAmount.toFixed(2)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>SS</cbc:ID>
        <cbc:Percent>0</cbc:Percent>
        <cbc:TaxExemptionReasonCode>VRBL:RS:PDV-RS-33</cbc:TaxExemptionReasonCode>
        <cbc:TaxExemptionReason>Mali poreski obveznik</cbc:TaxExemptionReason>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="RSD">${taxableAmount.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="RSD">${taxableAmount.toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="RSD">${payableAmount.toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="RSD">${payableAmount.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  ${invoiceLines}
</CreditNote>`;

  return xml;
}
