import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

const SEF_API_BASE = 'https://efaktura.mfin.gov.rs/api/publicApi';

// Helper for delay between API calls
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Robust field picker
function pickString(data: any, keys: string[], fallback: string | null = null): string | null {
  if (!data || typeof data !== 'object') return fallback;
  for (const key of keys) {
    if (data[key] !== undefined && data[key] !== null && data[key] !== '') {
      return String(data[key]);
    }
  }
  for (const key of keys) {
    if (key.includes('.')) {
      const parts = key.split('.');
      let value: any = data;
      for (const part of parts) {
        value = value?.[part];
      }
      if (value !== undefined && value !== null && value !== '') {
        return String(value);
      }
    }
  }
  return fallback;
}

function pickNumber(data: any, keys: string[], fallback: number = 0): number {
  const str = pickString(data, keys);
  if (str === null) return fallback;
  const num = parseFloat(str);
  return isNaN(num) ? fallback : num;
}

// Parse UBL XML to extract basic invoice data
function parseUblXml(xml: string): {
  invoiceNumber: string | null;
  issueDate: string | null;
  totalAmount: number;
  currency: string | null;
  supplierName: string | null;
  supplierPib: string | null;
} {
  const result = {
    invoiceNumber: null as string | null,
    issueDate: null as string | null,
    totalAmount: 0,
    currency: null as string | null,
    supplierName: null as string | null,
    supplierPib: null as string | null,
  };

  try {
    const idMatch = xml.match(/<cbc:ID>([^<]+)<\/cbc:ID>/);
    if (idMatch) result.invoiceNumber = idMatch[1];

    const dateMatch = xml.match(/<cbc:IssueDate>([^<]+)<\/cbc:IssueDate>/);
    if (dateMatch) result.issueDate = dateMatch[1];

    const amountMatch = xml.match(/<cbc:PayableAmount[^>]*>([^<]+)<\/cbc:PayableAmount>/);
    if (amountMatch) result.totalAmount = parseFloat(amountMatch[1]) || 0;

    const currencyMatch = xml.match(/<cbc:DocumentCurrencyCode>([^<]+)<\/cbc:DocumentCurrencyCode>/);
    if (currencyMatch) result.currency = currencyMatch[1];

    const supplierPartyMatch = xml.match(/<cac:AccountingSupplierParty>([\s\S]*?)<\/cac:AccountingSupplierParty>/);
    if (supplierPartyMatch) {
      const supplierBlock = supplierPartyMatch[1];
      const nameMatch = supplierBlock.match(/<cbc:Name>([^<]+)<\/cbc:Name>/);
      if (nameMatch) result.supplierName = nameMatch[1];
      
      const pibMatch = supplierBlock.match(/<cbc:CompanyID[^>]*>([^<]+)<\/cbc:CompanyID>/);
      if (pibMatch) result.supplierPib = pibMatch[1];
    }
  } catch (e) {
    console.error('Error parsing UBL XML:', e);
  }

  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { companyId } = await req.json();

    if (!companyId) {
      throw new Error('Company ID is required');
    }

    console.log(`Enriching incomplete SEF invoices for company: ${companyId}`);

    // Get company with SEF API key
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('sef_api_key, name')
      .eq('id', companyId)
      .single();

    if (companyError || !company?.sef_api_key) {
      throw new Error('SEF API ključ nije podešen za ovu kompaniju');
    }

    // Find invoices with missing data
    const { data: incompleteInvoices, error: fetchError } = await supabase
      .from('sef_invoices')
      .select('id, sef_invoice_id, invoice_type')
      .eq('company_id', companyId)
      .or('invoice_number.is.null,counterparty_name.is.null,total_amount.eq.0');

    if (fetchError) {
      throw new Error(`Database error: ${fetchError.message}`);
    }

    console.log(`Found ${incompleteInvoices?.length || 0} incomplete invoices to enrich`);

    if (!incompleteInvoices || incompleteInvoices.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Sve fakture već imaju kompletne podatke',
        enrichedCount: 0,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let enrichedCount = 0;
    let failedCount = 0;

    for (const invoice of incompleteInvoices) {
      await delay(600); // Rate limit protection

      const invoiceId = invoice.sef_invoice_id;
      const invoiceType = invoice.invoice_type;
      const endpoint = invoiceType === 'sales' ? 'sales-invoice' : 'purchase-invoice';

      let invoiceNumber: string | null = null;
      let issueDate: string | null = null;
      let supplierName: string | null = null;
      let supplierPib: string | null = null;
      let totalAmount: number = 0;
      let currency: string = 'RSD';
      let xmlData: string | null = null;

      // Try JSON first
      try {
        const jsonResponse = await fetch(
          `${SEF_API_BASE}/${endpoint}?invoiceId=${invoiceId}`,
          {
            method: 'GET',
            headers: {
              'ApiKey': company.sef_api_key,
              'Accept': 'application/json',
            },
          }
        );

        if (jsonResponse.ok) {
          const data = await jsonResponse.json();
          
          invoiceNumber = pickString(data, [
            'invoiceNumber', 'InvoiceNumber', 'Number', 'number', 'ID', 'Id'
          ]);
          issueDate = pickString(data, [
            'issueDate', 'IssueDate', 'InvoiceIssueDate', 'Date', 'date'
          ]);
          supplierName = pickString(data, [
            'supplierName', 'SupplierName', 'supplier.name', 'customerName', 'CustomerName'
          ]);
          supplierPib = pickString(data, [
            'supplierPib', 'SupplierPib', 'supplier.pib', 'customerPib', 'CustomerPib'
          ]);
          totalAmount = pickNumber(data, [
            'totalAmount', 'TotalAmount', 'payableAmount', 'PayableAmount'
          ], 0);
          currency = pickString(data, [
            'documentCurrencyCode', 'DocumentCurrencyCode', 'currency', 'Currency'
          ], 'RSD') || 'RSD';
        }
      } catch (e) {
        console.error(`Error fetching JSON for ${invoiceId}:`, e);
      }

      // If still missing key data, try XML
      if (!invoiceNumber || !supplierName || totalAmount === 0) {
        await delay(400);
        
        try {
          const xmlResponse = await fetch(
            `${SEF_API_BASE}/${endpoint}/xml?invoiceId=${invoiceId}`,
            {
              method: 'GET',
              headers: {
                'ApiKey': company.sef_api_key,
                'Accept': 'application/xml',
              },
            }
          );

          if (xmlResponse.ok) {
            xmlData = await xmlResponse.text();
            const parsed = parseUblXml(xmlData);
            
            if (!invoiceNumber && parsed.invoiceNumber) invoiceNumber = parsed.invoiceNumber;
            if (!issueDate && parsed.issueDate) issueDate = parsed.issueDate;
            if (totalAmount === 0 && parsed.totalAmount) totalAmount = parsed.totalAmount;
            if (!supplierName && parsed.supplierName) supplierName = parsed.supplierName;
            if (!supplierPib && parsed.supplierPib) supplierPib = parsed.supplierPib;
            if (!currency && parsed.currency) currency = parsed.currency || 'RSD';
          }
        } catch (e) {
          console.error(`Error fetching XML for ${invoiceId}:`, e);
        }
      }

      // Update if we got any data
      if (invoiceNumber || supplierName || totalAmount > 0) {
        const updateData: any = {
          fetched_at: new Date().toISOString(),
        };
        
        if (invoiceNumber) updateData.invoice_number = invoiceNumber;
        if (issueDate) updateData.issue_date = issueDate;
        if (supplierName) updateData.counterparty_name = supplierName;
        if (supplierPib) updateData.counterparty_pib = supplierPib;
        if (totalAmount > 0) updateData.total_amount = totalAmount;
        if (currency) updateData.currency = currency;
        if (xmlData) updateData.ubl_xml = xmlData;

        const { error: updateError } = await supabase
          .from('sef_invoices')
          .update(updateData)
          .eq('id', invoice.id);

        if (updateError) {
          console.error(`Error updating invoice ${invoiceId}:`, updateError);
          failedCount++;
        } else {
          console.log(`Enriched invoice ${invoiceId}: number=${invoiceNumber}, supplier=${supplierName}, amount=${totalAmount}`);
          enrichedCount++;
        }
      } else {
        console.log(`Could not enrich invoice ${invoiceId} - no data available`);
        failedCount++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Dopunjeno ${enrichedCount} faktura${failedCount > 0 ? `, ${failedCount} neuspešno` : ''}`,
      enrichedCount,
      failedCount,
      totalProcessed: incompleteInvoices.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('SEF enrich error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Greška pri dopuni faktura',
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
