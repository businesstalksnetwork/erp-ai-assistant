import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SEF_API_BASE = 'https://efaktura.mfin.gov.rs/api/publicApi';

// Helper to convert empty strings to null for date fields
const toNullableDate = (val: string | undefined | null): string | null => {
  if (!val || val.trim() === '') return null;
  // Validate it's a parseable date
  const parsed = new Date(val);
  if (isNaN(parsed.getTime())) return null;
  return val;
};

// Helper for delay between API calls to avoid rate limiting
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Robust field picker - tries multiple possible field names
function pickString(data: any, keys: string[], fallback: string | null = null): string | null {
  if (!data || typeof data !== 'object') return fallback;
  for (const key of keys) {
    // Direct key access
    if (data[key] !== undefined && data[key] !== null && data[key] !== '') {
      return String(data[key]);
    }
  }
  // Try nested paths (e.g., "supplier.name")
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

// Parse UBL XML to extract basic invoice data as fallback
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
    // Extract invoice number (ID tag)
    const idMatch = xml.match(/<cbc:ID>([^<]+)<\/cbc:ID>/);
    if (idMatch) result.invoiceNumber = idMatch[1];

    // Extract issue date
    const dateMatch = xml.match(/<cbc:IssueDate>([^<]+)<\/cbc:IssueDate>/);
    if (dateMatch) result.issueDate = dateMatch[1];

    // Extract payable amount
    const amountMatch = xml.match(/<cbc:PayableAmount[^>]*>([^<]+)<\/cbc:PayableAmount>/);
    if (amountMatch) result.totalAmount = parseFloat(amountMatch[1]) || 0;

    // Extract currency
    const currencyMatch = xml.match(/<cbc:DocumentCurrencyCode>([^<]+)<\/cbc:DocumentCurrencyCode>/);
    if (currencyMatch) result.currency = currencyMatch[1];

    // Extract supplier name from AccountingSupplierParty
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

interface SEFPurchaseInvoice {
  sefInvoiceId: string;
  invoiceNumber: string | null;
  issueDate: string | null;
  deliveryDate?: string | null;
  dueDate?: string | null;
  supplierName: string | null;
  supplierPib?: string | null;
  supplierMaticniBroj?: string | null;
  supplierAddress?: string | null;
  totalAmount: number;
  vatAmount?: number;
  currency: string;
  status: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { companyId, dateFrom, dateTo } = await req.json();

    console.log(`Fetching SEF purchase invoices for company: ${companyId}, from: ${dateFrom}, to: ${dateTo}`);

    // Get company with SEF API key
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single();

    if (companyError || !company) {
      throw new Error('Kompanija nije pronađena');
    }

    if (!company.sef_api_key) {
      throw new Error('SEF API ključ nije podešen za ovu kompaniju');
    }

    // Fetch purchase invoice IDs from SEF
    const idsRequestBody = {
      dateFrom,
      dateTo,
      status: ['New', 'Seen', 'Approved', 'Rejected', 'Cancelled']
    };

    console.log('Requesting SEF purchase invoice IDs...');

    const idsResponse = await fetch(`${SEF_API_BASE}/purchase-invoice/ids`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ApiKey': company.sef_api_key,
        'Accept': 'application/json',
      },
      body: JSON.stringify(idsRequestBody),
    });

    if (!idsResponse.ok) {
      const errorText = await idsResponse.text();
      console.error('SEF IDs API error:', errorText);
      throw new Error(`SEF API greška: ${idsResponse.status} - ${errorText}`);
    }

    const idsResponseData = await idsResponse.json();
    console.log('SEF IDs API response:', JSON.stringify(idsResponseData));

    // Handle different response formats (SEF API uses PurchaseInvoiceIds with capital P)
    let invoiceIds: string[] = [];
    if (Array.isArray(idsResponseData)) {
      invoiceIds = idsResponseData;
    } else if (idsResponseData?.PurchaseInvoiceIds) {
      invoiceIds = idsResponseData.PurchaseInvoiceIds;
    } else if (idsResponseData?.purchaseInvoiceIds) {
      invoiceIds = idsResponseData.purchaseInvoiceIds;
    } else if (idsResponseData?.ids) {
      invoiceIds = idsResponseData.ids;
    } else if (typeof idsResponseData === 'object' && idsResponseData !== null) {
      const arrayProp = Object.values(idsResponseData).find(v => Array.isArray(v));
      if (arrayProp) {
        invoiceIds = arrayProp as string[];
      }
    }

    console.log(`Found ${invoiceIds.length} purchase invoice IDs from SEF`);

    // Fetch details for each invoice
    const invoices: SEFPurchaseInvoice[] = [];
    const invoicesForStorage: any[] = [];
    let successCount = 0;
    let rateLimitCount = 0;

    for (let i = 0; i < invoiceIds.length; i++) {
      const invoiceId = invoiceIds[i];
      
      // Add delay between requests to avoid rate limiting (429)
      if (i > 0) {
        await delay(500);
      }

      let invoiceNumber: string | null = null;
      let issueDate: string | null = null;
      let deliveryDate: string | null = null;
      let dueDate: string | null = null;
      let supplierName: string | null = null;
      let supplierPib: string | null = null;
      let supplierMaticniBroj: string | null = null;
      let supplierAddress: string | null = null;
      let totalAmount: number = 0;
      let vatAmount: number = 0;
      let currency: string = 'RSD';
      let status: string = 'Unknown';
      let xmlData: string | null = null;
      
      try {
        const invoiceResponse = await fetch(
          `${SEF_API_BASE}/purchase-invoice?invoiceId=${invoiceId}`,
          {
            method: 'GET',
            headers: {
              'ApiKey': company.sef_api_key,
              'Accept': 'application/json',
            },
          }
        );

        if (invoiceResponse.ok) {
          const data = await invoiceResponse.json();
          
          // Log first invoice structure for debugging
          if (i === 0) {
            console.log('Sample invoice JSON keys:', Object.keys(data || {}));
            console.log('Sample invoice data snippet:', JSON.stringify(data).substring(0, 500));
          }
          
          // Use robust field extraction with multiple possible field names
          invoiceNumber = pickString(data, [
            'invoiceNumber', 'InvoiceNumber', 'Number', 'number', 'ID', 'Id', 'id',
            'DocumentNumber', 'documentNumber'
          ]);
          issueDate = pickString(data, [
            'issueDate', 'IssueDate', 'InvoiceIssueDate', 'invoiceIssueDate',
            'Date', 'date', 'DocumentDate', 'documentDate'
          ]);
          deliveryDate = pickString(data, [
            'deliveryDate', 'DeliveryDate', 'ActualDeliveryDate', 'actualDeliveryDate'
          ]);
          dueDate = pickString(data, [
            'dueDate', 'DueDate', 'PaymentDueDate', 'paymentDueDate'
          ]);
          supplierName = pickString(data, [
            'supplierName', 'SupplierName', 'Supplier', 'supplier',
            'SupplierPartyName', 'supplierPartyName', 'SenderName', 'senderName',
            'supplier.name', 'Supplier.Name', 'SellerName', 'sellerName'
          ]);
          supplierPib = pickString(data, [
            'supplierPib', 'SupplierPib', 'SupplierTaxId', 'supplierTaxId',
            'SupplierCompanyId', 'supplierCompanyId', 'SenderPib', 'senderPib',
            'supplier.pib', 'Supplier.Pib', 'SellerPib', 'sellerPib'
          ]);
          supplierMaticniBroj = pickString(data, [
            'supplierMaticniBroj', 'SupplierMaticniBroj', 'supplier.maticniBroj'
          ]);
          supplierAddress = pickString(data, [
            'supplierAddress', 'SupplierAddress', 'supplier.address'
          ]);
          totalAmount = pickNumber(data, [
            'totalAmount', 'TotalAmount', 'payableAmount', 'PayableAmount',
            'InvoiceTotalAmount', 'invoiceTotalAmount', 'Amount', 'amount',
            'GrandTotal', 'grandTotal'
          ], 0);
          vatAmount = pickNumber(data, [
            'vatAmount', 'VatAmount', 'taxAmount', 'TaxAmount'
          ], 0);
          currency = pickString(data, [
            'documentCurrencyCode', 'DocumentCurrencyCode', 'currency', 'Currency',
            'CurrencyCode', 'currencyCode'
          ], 'RSD') || 'RSD';
          status = pickString(data, [
            'status', 'Status', 'InvoiceStatus', 'invoiceStatus',
            'DocumentStatus', 'documentStatus'
          ], 'Unknown') || 'Unknown';
          
          successCount++;
        } else if (invoiceResponse.status === 429) {
          console.warn(`Rate limited for invoice ${invoiceId}`);
          rateLimitCount++;
          status = 'Pending';
        } else {
          console.warn(`Failed to fetch invoice ${invoiceId}: ${invoiceResponse.status}`);
        }
      } catch (err) {
        console.error(`Error fetching invoice ${invoiceId}:`, err);
      }

      // If key fields are missing, try XML fallback
      if (!invoiceNumber || !issueDate || totalAmount === 0 || !supplierName) {
        console.log(`Invoice ${invoiceId} missing key fields, trying XML fallback...`);
        
        try {
          await delay(400); // Additional delay before XML request
          
          const xmlResponse = await fetch(
            `${SEF_API_BASE}/purchase-invoice/xml?invoiceId=${invoiceId}`,
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
            
            console.log(`XML fallback for ${invoiceId}: found number=${parsed.invoiceNumber}, date=${parsed.issueDate}, amount=${parsed.totalAmount}, supplier=${parsed.supplierName}`);
            
            // Fill in missing fields from XML
            if (!invoiceNumber && parsed.invoiceNumber) invoiceNumber = parsed.invoiceNumber;
            if (!issueDate && parsed.issueDate) issueDate = parsed.issueDate;
            if (totalAmount === 0 && parsed.totalAmount) totalAmount = parsed.totalAmount;
            if (!supplierName && parsed.supplierName) supplierName = parsed.supplierName;
            if (!supplierPib && parsed.supplierPib) supplierPib = parsed.supplierPib;
            if (!currency && parsed.currency) currency = parsed.currency || 'RSD';
          } else if (xmlResponse.status === 429) {
            console.log(`Rate limited on XML for invoice ${invoiceId}`);
            rateLimitCount++;
          }
        } catch (e) {
          console.error(`Error fetching XML for ${invoiceId}:`, e);
        }
      }

      const invoice: SEFPurchaseInvoice = {
        sefInvoiceId: invoiceId,
        invoiceNumber,
        issueDate,
        deliveryDate,
        dueDate,
        supplierName,
        supplierPib,
        supplierMaticniBroj,
        supplierAddress,
        totalAmount,
        vatAmount,
        currency,
        status,
      };

      invoices.push(invoice);

      // Prepare for storage - ALWAYS add for upsert (will update existing placeholders)
      invoicesForStorage.push({
        company_id: companyId,
        sef_invoice_id: invoiceId,
        invoice_type: 'purchase',
        invoice_number: invoiceNumber,
        issue_date: toNullableDate(issueDate),
        delivery_date: toNullableDate(deliveryDate),
        due_date: toNullableDate(dueDate),
        counterparty_name: supplierName,
        counterparty_pib: supplierPib || null,
        counterparty_maticni_broj: supplierMaticniBroj || null,
        counterparty_address: supplierAddress || null,
        total_amount: totalAmount || 0,
        vat_amount: vatAmount || null,
        currency: currency || 'RSD',
        sef_status: status || 'Unknown',
        local_status: 'pending',
        ubl_xml: xmlData, // Store XML if we fetched it
        fetched_at: new Date().toISOString(),
      });
    }

    console.log(`Processed ${invoicesForStorage.length} invoices, ${successCount} with full JSON data, ${rateLimitCount} rate limited`);

    // Upsert all invoices - UPDATE existing records (NO ignoreDuplicates)
    if (invoicesForStorage.length > 0) {
      const { error: upsertError } = await supabase
        .from('sef_invoices')
        .upsert(invoicesForStorage, {
          onConflict: 'company_id,sef_invoice_id,invoice_type'
          // Removed ignoreDuplicates: true - this will UPDATE existing placeholder records
        });

      if (upsertError) {
        console.error('Error storing invoices:', upsertError);
      } else {
        console.log(`Upserted ${invoicesForStorage.length} purchase invoices`);
      }
    }

    console.log(`Successfully processed ${invoices.length} purchase invoices`);

    return new Response(JSON.stringify({
      success: true,
      invoices,
      totalFound: invoiceIds.length,
      storedCount: invoicesForStorage.length,
      completeData: successCount,
      rateLimited: rateLimitCount,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('SEF fetch error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Greška pri preuzimanju faktura sa SEF-a',
      invoices: [],
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
