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

// Parse UBL XML to extract basic invoice data as fallback
function parseUblXml(xml: string): {
  invoiceNumber: string | null;
  issueDate: string | null;
  totalAmount: number;
  currency: string | null;
  buyerName: string | null;
  buyerPib: string | null;
} {
  const result = {
    invoiceNumber: null as string | null,
    issueDate: null as string | null,
    totalAmount: 0,
    currency: null as string | null,
    buyerName: null as string | null,
    buyerPib: null as string | null,
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

    const buyerPartyMatch = xml.match(/<cac:AccountingCustomerParty>([\s\S]*?)<\/cac:AccountingCustomerParty>/);
    if (buyerPartyMatch) {
      const buyerBlock = buyerPartyMatch[1];
      const nameMatch = buyerBlock.match(/<cbc:Name>([^<]+)<\/cbc:Name>/);
      if (nameMatch) result.buyerName = nameMatch[1];
      
      const pibMatch = buyerBlock.match(/<cbc:CompanyID[^>]*>([^<]+)<\/cbc:CompanyID>/);
      if (pibMatch) result.buyerPib = pibMatch[1];
    }
  } catch (e) {
    console.error('Error parsing UBL XML:', e);
  }

  return result;
}

interface SEFSalesInvoice {
  sefInvoiceId: string;
  invoiceNumber: string | null;
  issueDate: string | null;
  deliveryDate?: string | null;
  dueDate?: string | null;
  buyerName: string | null;
  buyerPib?: string | null;
  buyerMaticniBroj?: string | null;
  buyerAddress?: string | null;
  totalAmount: number;
  vatAmount?: number;
  currency: string;
  status: string;
}

// Fetch invoice IDs for a specific status with retry logic for rate limiting
async function fetchInvoiceIdsByStatus(
  apiKey: string,
  dateFrom: string,
  dateTo: string,
  status: string,
  maxRetries: number = 3
): Promise<string[]> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const requestBody = {
        dateFrom,
        dateTo,
        status: [status]
      };

      const response = await fetch(`${SEF_API_BASE}/sales-invoice/ids`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ApiKey': apiKey,
          'Accept': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.status === 429) {
        const waitTime = (attempt + 1) * 1500;
        console.log(`Rate limited on status ${status}, waiting ${waitTime}ms before retry (attempt ${attempt + 1}/${maxRetries})...`);
        await delay(waitTime);
        continue;
      }

      if (!response.ok) {
        console.log(`Status ${status} fetch returned ${response.status}`);
        return [];
      }

      const data = await response.json();
      // Handle different response formats
      const ids = data?.SalesInvoiceIds || data?.salesInvoiceIds || data?.ids || [];
      if (Array.isArray(data)) return data;
      return ids;
    } catch (e) {
      console.error(`Error fetching IDs for status ${status}:`, e);
      if (attempt < maxRetries - 1) {
        await delay((attempt + 1) * 1000);
        continue;
      }
      return [];
    }
  }
  return [];
}

// Status priority - higher number = more "final" status that shouldn't be overwritten
// Storno and Cancelled are final states that should not be overwritten by Approved
const STATUS_PRIORITY: Record<string, number> = {
  'Unknown': 0,
  'Draft': 1,
  'Sending': 2,
  'Sent': 3,
  'Seen': 4,
  'Approved': 5,
  'Rejected': 6,
  'Cancelled': 7,
  'Storno': 8,
  'Mistake': 9,
};

// Build a map of invoiceId -> status SEQUENTIALLY to respect rate limits
async function buildStatusMap(
  apiKey: string,
  dateFrom: string,
  dateTo: string
): Promise<Map<string, string>> {
  const statusMap = new Map<string, string>();
  const statuses = ['Sent', 'Seen', 'Approved', 'Rejected', 'Cancelled', 'Storno'];

  console.log('Building status map sequentially to respect rate limits...');
  
  for (let i = 0; i < statuses.length; i++) {
    if (i > 0) {
      await delay(400);
    }
    
    const status = statuses[i];
    const ids = await fetchInvoiceIdsByStatus(apiKey, dateFrom, dateTo, status);
    console.log(`Status '${status}': found ${ids.length} invoices`);
    
    for (const id of ids) {
      const existingStatus = statusMap.get(id);
      const existingPriority = existingStatus ? (STATUS_PRIORITY[existingStatus] || 0) : 0;
      const newPriority = STATUS_PRIORITY[status] || 0;
      
      if (newPriority > existingPriority) {
        statusMap.set(id, status);
      }
    }
  }

  console.log(`Built status map with ${statusMap.size} entries`);
  return statusMap;
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

    console.log(`Fetching SEF sales invoices for company: ${companyId}, from: ${dateFrom}, to: ${dateTo}`);

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

    // STEP 1: Build status map by querying each status separately
    const statusMap = await buildStatusMap(company.sef_api_key, dateFrom, dateTo);

    await delay(400);

    // STEP 2: Fetch all invoice IDs
    const idsRequestBody = {
      dateFrom,
      dateTo,
      status: ['Sent', 'Approved', 'Seen', 'Rejected', 'Storno', 'Cancelled']
    };

    console.log('Requesting all SEF sales invoice IDs...');

    let idsResponse: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      idsResponse = await fetch(`${SEF_API_BASE}/sales-invoice/ids`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ApiKey': company.sef_api_key,
          'Accept': 'application/json',
        },
        body: JSON.stringify(idsRequestBody),
      });
      
      if (idsResponse.status === 429) {
        const waitTime = (attempt + 1) * 1500;
        console.log(`Rate limited on all IDs request, waiting ${waitTime}ms before retry...`);
        await delay(waitTime);
        continue;
      }
      break;
    }
    
    if (!idsResponse) {
      throw new Error('Failed to fetch invoice IDs after retries');
    }

    if (!idsResponse.ok) {
      const errorText = await idsResponse.text();
      console.error('SEF IDs API error:', errorText);
      throw new Error(`SEF API greška: ${idsResponse.status} - ${errorText}`);
    }

    const idsResponseData = await idsResponse.json();
    
    let invoiceIds: string[] = [];
    if (Array.isArray(idsResponseData)) {
      invoiceIds = idsResponseData;
    } else if (idsResponseData?.SalesInvoiceIds) {
      invoiceIds = idsResponseData.SalesInvoiceIds;
    } else if (idsResponseData?.salesInvoiceIds) {
      invoiceIds = idsResponseData.salesInvoiceIds;
    } else if (idsResponseData?.ids) {
      invoiceIds = idsResponseData.ids;
    } else if (typeof idsResponseData === 'object' && idsResponseData !== null) {
      const arrayProp = Object.values(idsResponseData).find(v => Array.isArray(v));
      if (arrayProp) {
        invoiceIds = arrayProp as string[];
      }
    }

    console.log(`Found ${invoiceIds.length} sales invoice IDs from SEF`);

    // STEP 3: Fetch details for each invoice
    const invoices: SEFSalesInvoice[] = [];
    const invoicesForStorage: any[] = [];
    let successCount = 0;
    let rateLimitCount = 0;

    for (let i = 0; i < invoiceIds.length; i++) {
      const invoiceId = invoiceIds[i];
      
      if (i > 0) {
        await delay(600);
      }

      const status = statusMap.get(invoiceId) || 'Unknown';

      let invoiceNumber: string | null = null;
      let issueDate: string | null = null;
      let deliveryDate: string | null = null;
      let dueDate: string | null = null;
      let buyerName: string | null = null;
      let buyerPib: string | null = null;
      let buyerMaticniBroj: string | null = null;
      let buyerAddress: string | null = null;
      let totalAmount: number = 0;
      let vatAmount: number = 0;
      let currency: string = 'RSD';
      let xmlData: string | null = null;
      
      try {
        const invoiceResponse = await fetch(
          `${SEF_API_BASE}/sales-invoice?invoiceId=${invoiceId}`,
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
          
          if (i === 0) {
            console.log('=== SAMPLE SALES INVOICE JSON ===');
            console.log('Top-level keys:', Object.keys(data || {}));
          }
          
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
          buyerName = pickString(data, [
            'buyerName', 'BuyerName', 'Buyer', 'buyer',
            'BuyerPartyName', 'buyerPartyName', 'ReceiverName', 'receiverName',
            'buyer.name', 'Buyer.Name', 'CustomerName', 'customerName'
          ]);
          buyerPib = pickString(data, [
            'buyerPib', 'BuyerPib', 'BuyerTaxId', 'buyerTaxId',
            'BuyerCompanyId', 'buyerCompanyId', 'ReceiverPib', 'receiverPib',
            'buyer.pib', 'Buyer.Pib', 'CustomerPib', 'customerPib'
          ]);
          buyerMaticniBroj = pickString(data, [
            'buyerMaticniBroj', 'BuyerMaticniBroj', 'buyer.maticniBroj'
          ]);
          buyerAddress = pickString(data, [
            'buyerAddress', 'BuyerAddress', 'buyer.address'
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
          
          successCount++;
        } else if (invoiceResponse.status === 429) {
          console.warn(`Rate limited for invoice ${invoiceId}`);
          rateLimitCount++;
        } else {
          console.warn(`Failed to fetch invoice ${invoiceId}: ${invoiceResponse.status}`);
        }
      } catch (err) {
        console.error(`Error fetching invoice ${invoiceId}:`, err);
      }

      // If key fields are missing, try XML fallback
      if (!invoiceNumber || !issueDate || totalAmount === 0 || !buyerName) {
        console.log(`Invoice ${invoiceId} missing key fields, trying XML fallback...`);
        
        try {
          await delay(400);
          
          const xmlResponse = await fetch(
            `${SEF_API_BASE}/sales-invoice/xml?invoiceId=${invoiceId}`,
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
            
            console.log(`XML fallback for ${invoiceId}: number=${parsed.invoiceNumber}, amount=${parsed.totalAmount}`);
            
            if (!invoiceNumber && parsed.invoiceNumber) invoiceNumber = parsed.invoiceNumber;
            if (!issueDate && parsed.issueDate) issueDate = parsed.issueDate;
            if (totalAmount === 0 && parsed.totalAmount) totalAmount = parsed.totalAmount;
            if (!buyerName && parsed.buyerName) buyerName = parsed.buyerName;
            if (!buyerPib && parsed.buyerPib) buyerPib = parsed.buyerPib;
            if (!currency && parsed.currency) currency = parsed.currency || 'RSD';
          } else if (xmlResponse.status === 429) {
            console.log(`Rate limited on XML for invoice ${invoiceId}`);
            rateLimitCount++;
          }
        } catch (e) {
          console.error(`Error fetching XML for ${invoiceId}:`, e);
        }
      }

      const invoice: SEFSalesInvoice = {
        sefInvoiceId: invoiceId,
        invoiceNumber,
        issueDate,
        deliveryDate,
        dueDate,
        buyerName,
        buyerPib,
        buyerMaticniBroj,
        buyerAddress,
        totalAmount,
        vatAmount,
        currency,
        status,
      };

      invoices.push(invoice);

      invoicesForStorage.push({
        company_id: companyId,
        sef_invoice_id: invoiceId,
        invoice_type: 'sales',
        invoice_number: invoiceNumber,
        issue_date: toNullableDate(issueDate),
        delivery_date: toNullableDate(deliveryDate),
        due_date: toNullableDate(dueDate),
        counterparty_name: buyerName,
        counterparty_pib: buyerPib || null,
        counterparty_maticni_broj: buyerMaticniBroj || null,
        counterparty_address: buyerAddress || null,
        total_amount: totalAmount || 0,
        vat_amount: vatAmount || null,
        currency: currency || 'RSD',
        sef_status: status,
        local_status: 'pending',
        ubl_xml: xmlData,
        fetched_at: new Date().toISOString(),
      });
    }

    console.log(`Processed ${invoicesForStorage.length} invoices, ${successCount} with full JSON data, ${rateLimitCount} rate limited`);

    // Upsert all invoices
    if (invoicesForStorage.length > 0) {
      const { error: upsertError } = await supabase
        .from('sef_invoices')
        .upsert(invoicesForStorage, {
          onConflict: 'company_id,sef_invoice_id,invoice_type'
        });

      if (upsertError) {
        console.error('Error storing invoices:', upsertError);
      } else {
        console.log(`Upserted ${invoicesForStorage.length} sales invoices`);
      }
    }

    console.log(`Successfully processed ${invoices.length} sales invoices`);

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
