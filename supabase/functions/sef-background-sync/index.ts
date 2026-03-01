import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

const SEF_API_BASE = 'https://efaktura.mfin.gov.rs/api/publicApi';

// Helper for delay between API calls
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to convert empty strings to null for date fields
const toNullableDate = (val: string | undefined | null): string | null => {
  if (!val || val.trim() === '') return null;
  const parsed = new Date(val);
  if (isNaN(parsed.getTime())) return null;
  return val;
};

// Robust field picker
function pickString(data: any, keys: string[], fallback: string | null = null): string | null {
  if (!data || typeof data !== 'object') return fallback;
  for (const key of keys) {
    if (data[key] !== undefined && data[key] !== null && data[key] !== '') {
      return String(data[key]);
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

// Parse UBL XML as fallback
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

// Fetch invoice IDs for a specific status with retry
async function fetchInvoiceIdsByStatus(
  apiKey: string,
  dateFrom: string,
  dateTo: string,
  status: string,
  maxRetries: number = 3
): Promise<string[]> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // SEF API expects query parameters, not body!
      const params = new URLSearchParams({
        status: status,
        dateFrom: dateFrom,
        dateTo: dateTo,
      });

      const response = await fetch(`${SEF_API_BASE}/purchase-invoice/ids?${params.toString()}`, {
        method: 'POST',
        headers: {
          'ApiKey': apiKey,
          'Accept': 'application/json',
        },
      });

      if (response.status === 429) {
        const waitTime = (attempt + 1) * 1500;
        console.log(`Rate limited on status ${status}, waiting ${waitTime}ms...`);
        await delay(waitTime);
        continue;
      }

      if (!response.ok) return [];

      const data = await response.json();
      return data?.PurchaseInvoiceIds || data?.purchaseInvoiceIds || [];
    } catch (e) {
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
const STATUS_PRIORITY: Record<string, number> = {
  'Unknown': 0,
  'New': 1,
  'Seen': 2,
  'Cancelled': 3,
  'Rejected': 4,
  'Approved': 5,
};

// Build status map sequentially
async function buildStatusMap(apiKey: string, dateFrom: string, dateTo: string): Promise<Map<string, string>> {
  const statusMap = new Map<string, string>();
  const statuses = ['New', 'Seen', 'Approved', 'Rejected', 'Cancelled'];

  for (let i = 0; i < statuses.length; i++) {
    if (i > 0) await delay(400);
    const status = statuses[i];
    const ids = await fetchInvoiceIdsByStatus(apiKey, dateFrom, dateTo, status);
    console.log(`Status '${status}': found ${ids.length} invoices`);
    
    for (const id of ids) {
      const existingStatus = statusMap.get(id);
      const existingPriority = existingStatus ? (STATUS_PRIORITY[existingStatus] || 0) : 0;
      const newPriority = STATUS_PRIORITY[status] || 0;
      
      // Only update if new status has higher priority
      if (newPriority > existingPriority) {
        statusMap.set(id, status);
      }
    }
  }

  console.log(`Built status map with ${statusMap.size} entries`);
  return statusMap;
}

// Sync purchase invoices for a single company
async function syncCompanyPurchaseInvoices(
  supabase: any,
  company: { id: string; sef_api_key: string; name: string }
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    // Last 30 days
    const dateTo = new Date().toISOString().split('T')[0];
    const dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    console.log(`Syncing ${company.name} (${company.id}) from ${dateFrom} to ${dateTo}`);

    // Build status map
    const statusMap = await buildStatusMap(company.sef_api_key, dateFrom, dateTo);
    await delay(400);

    // Fetch all invoice IDs
    let idsResponse: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      idsResponse = await fetch(`${SEF_API_BASE}/purchase-invoice/ids`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ApiKey': company.sef_api_key,
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          dateFrom,
          dateTo,
          status: ['New', 'Seen', 'Approved', 'Rejected', 'Cancelled']
        }),
      });
      
      if (idsResponse.status === 429) {
        await delay((attempt + 1) * 1500);
        continue;
      }
      break;
    }

    if (!idsResponse || !idsResponse.ok) {
      return { success: false, count: 0, error: 'Failed to fetch invoice IDs' };
    }

    const idsData = await idsResponse.json();
    let invoiceIds: string[] = [];
    if (Array.isArray(idsData)) {
      invoiceIds = idsData;
    } else if (idsData?.PurchaseInvoiceIds) {
      invoiceIds = idsData.PurchaseInvoiceIds;
    } else if (idsData?.purchaseInvoiceIds) {
      invoiceIds = idsData.purchaseInvoiceIds;
    }

    console.log(`Found ${invoiceIds.length} invoices for ${company.name}`);

    // Process invoices (limited to avoid timeout)
    const invoicesForStorage: any[] = [];
    const maxToProcess = Math.min(invoiceIds.length, 50); // Limit per sync

    for (let i = 0; i < maxToProcess; i++) {
      const invoiceId = invoiceIds[i];
      if (i > 0) await delay(600);

      const status = statusMap.get(invoiceId) || 'Unknown';
      let invoiceNumber: string | null = null;
      let issueDate: string | null = null;
      let deliveryDate: string | null = null;
      let dueDate: string | null = null;
      let supplierName: string | null = null;
      let supplierPib: string | null = null;
      let totalAmount = 0;
      let vatAmount = 0;
      let currency = 'RSD';

      try {
        const invoiceResponse = await fetch(
          `${SEF_API_BASE}/purchase-invoice?invoiceId=${invoiceId}`,
          {
            method: 'GET',
            headers: { 'ApiKey': company.sef_api_key, 'Accept': 'application/json' },
          }
        );

        if (invoiceResponse.ok) {
          const data = await invoiceResponse.json();
          invoiceNumber = pickString(data, ['invoiceNumber', 'InvoiceNumber', 'Number', 'ID']);
          issueDate = pickString(data, ['issueDate', 'IssueDate', 'Date']);
          deliveryDate = pickString(data, ['deliveryDate', 'DeliveryDate']);
          dueDate = pickString(data, ['dueDate', 'DueDate']);
          supplierName = pickString(data, ['supplierName', 'SupplierName', 'Supplier']);
          supplierPib = pickString(data, ['supplierPib', 'SupplierPib']);
          totalAmount = pickNumber(data, ['totalAmount', 'TotalAmount', 'payableAmount'], 0);
          vatAmount = pickNumber(data, ['vatAmount', 'VatAmount'], 0);
          currency = pickString(data, ['documentCurrencyCode', 'currency'], 'RSD') || 'RSD';
        }
      } catch (err) {
        console.error(`Error fetching invoice ${invoiceId}:`, err);
      }

      // XML fallback if needed
      if (!invoiceNumber || !issueDate || totalAmount === 0) {
        try {
          await delay(400);
          const xmlResponse = await fetch(
            `${SEF_API_BASE}/purchase-invoice/xml?invoiceId=${invoiceId}`,
            { headers: { 'ApiKey': company.sef_api_key, 'Accept': 'application/xml' } }
          );
          if (xmlResponse.ok) {
            const xml = await xmlResponse.text();
            const parsed = parseUblXml(xml);
            if (!invoiceNumber) invoiceNumber = parsed.invoiceNumber;
            if (!issueDate) issueDate = parsed.issueDate;
            if (totalAmount === 0) totalAmount = parsed.totalAmount;
            if (!supplierName) supplierName = parsed.supplierName;
            if (!supplierPib) supplierPib = parsed.supplierPib;
          }
        } catch (e) {}
      }

      // Determine local_status based on sef_status
      const localStatus = (status === 'Approved' || status === 'Rejected' || status === 'Cancelled') 
        ? 'imported' : 'pending';

      invoicesForStorage.push({
        company_id: company.id,
        sef_invoice_id: invoiceId,
        invoice_type: 'purchase',
        invoice_number: invoiceNumber,
        issue_date: toNullableDate(issueDate),
        delivery_date: toNullableDate(deliveryDate),
        due_date: toNullableDate(dueDate),
        counterparty_name: supplierName,
        counterparty_pib: supplierPib,
        total_amount: totalAmount || 0,
        vat_amount: vatAmount || null,
        currency: currency || 'RSD',
        sef_status: status,
        local_status: localStatus,
        fetched_at: new Date().toISOString(),
      });
    }

    // Upsert invoices
    if (invoicesForStorage.length > 0) {
      const { error } = await supabase
        .from('sef_invoices')
        .upsert(invoicesForStorage, { onConflict: 'company_id,sef_invoice_id,invoice_type' });
      
      if (error) {
        console.error(`Error storing invoices for ${company.name}:`, error);
        return { success: false, count: 0, error: error.message };
      }
    }

    return { success: true, count: invoicesForStorage.length };
  } catch (error) {
    console.error(`Error syncing ${company.name}:`, error);
    return { success: false, count: 0, error: String(error) };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting SEF background sync...');

    // Get all companies with SEF enabled
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('id, name, sef_api_key')
      .eq('sef_enabled', true)
      .not('sef_api_key', 'is', null);

    if (companiesError) {
      throw new Error(`Failed to fetch companies: ${companiesError.message}`);
    }

    console.log(`Found ${companies?.length || 0} companies with SEF enabled`);

    const results: { company: string; success: boolean; count: number; error?: string }[] = [];

    // Process companies sequentially to respect rate limits
    for (const company of companies || []) {
      if (!company.sef_api_key) continue;
      
      const result = await syncCompanyPurchaseInvoices(supabase, company);
      results.push({
        company: company.name,
        success: result.success,
        count: result.count,
        error: result.error,
      });

      // Delay between companies
      await delay(2000);
    }

    const totalSynced = results.reduce((sum, r) => sum + r.count, 0);
    const successCount = results.filter(r => r.success).length;

    console.log(`Background sync complete: ${successCount}/${results.length} companies, ${totalSynced} invoices`);

    return new Response(JSON.stringify({
      success: true,
      companiesProcessed: results.length,
      companiesSuccessful: successCount,
      totalInvoicesSynced: totalSynced,
      details: results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Background sync error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Background sync failed',
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
