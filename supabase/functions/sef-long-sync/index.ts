import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

// Declare EdgeRuntime for Supabase edge functions
declare const EdgeRuntime: {
  waitUntil: (promise: Promise<any>) => void;
};

const SEF_API_BASE = 'https://efaktura.mfin.gov.rs/api/publicApi';
const MONTHS_PER_CHUNK = 12; // Process 12 months per function call to avoid timeouts

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

// Parse UBL XML to extract basic invoice data
function parseUblXml(xml: string, invoiceType: 'purchase' | 'sales' = 'purchase'): {
  invoiceNumber: string | null;
  issueDate: string | null;
  totalAmount: number;
  currency: string | null;
  counterpartyName: string | null;
  counterpartyPib: string | null;
} {
  const result = {
    invoiceNumber: null as string | null,
    issueDate: null as string | null,
    totalAmount: 0,
    currency: null as string | null,
    counterpartyName: null as string | null,
    counterpartyPib: null as string | null,
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

    // For purchase invoices, counterparty is supplier; for sales, it's customer
    const partyTag = invoiceType === 'sales' ? 'AccountingCustomerParty' : 'AccountingSupplierParty';
    const partyRegex = new RegExp(`<cac:${partyTag}>([\\s\\S]*?)<\\/cac:${partyTag}>`);
    const partyMatch = xml.match(partyRegex);
    
    if (partyMatch) {
      const partyBlock = partyMatch[1];
      const nameMatch = partyBlock.match(/<cbc:Name>([^<]+)<\/cbc:Name>/);
      if (nameMatch) result.counterpartyName = nameMatch[1];
      
      const pibMatch = partyBlock.match(/<cbc:CompanyID[^>]*>([^<]+)<\/cbc:CompanyID>/);
      if (pibMatch) result.counterpartyPib = pibMatch[1];
    }
  } catch (e) {
    console.error('Error parsing UBL XML:', e);
  }

  return result;
}

// Status priority mapping
const STATUS_PRIORITY: Record<string, number> = {
  'Unknown': 0,
  'New': 1,
  'Seen': 2,
  'Cancelled': 3,
  'Rejected': 4,
  'Approved': 5,
};

// Fetch invoice IDs for a specific status
async function fetchInvoiceIdsByStatus(
  apiKey: string,
  dateFrom: string,
  dateTo: string,
  status: string,
  invoiceType: 'purchase' | 'sales',
  maxRetries: number = 3
): Promise<string[]> {
  const endpoint = invoiceType === 'sales' ? 'sales-invoice' : 'purchase-invoice';
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const params = new URLSearchParams({
        status: status,
        dateFrom: dateFrom,
        dateTo: dateTo,
      });

      const response = await fetch(`${SEF_API_BASE}/${endpoint}/ids?${params.toString()}`, {
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

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      // Use correct field based on invoice type
      if (invoiceType === 'sales') {
        return data?.SalesInvoiceIds || data?.salesInvoiceIds || [];
      }
      return data?.PurchaseInvoiceIds || data?.purchaseInvoiceIds || [];
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

// Build status map for a single month
async function buildStatusMap(
  apiKey: string,
  dateFrom: string,
  dateTo: string,
  invoiceType: 'purchase' | 'sales'
): Promise<Map<string, string>> {
  const statusMap = new Map<string, string>();
  const statuses = ['New', 'Seen', 'Approved', 'Rejected', 'Cancelled'];

  for (let i = 0; i < statuses.length; i++) {
    if (i > 0) await delay(400);
    
    const status = statuses[i];
    const ids = await fetchInvoiceIdsByStatus(apiKey, dateFrom, dateTo, status, invoiceType);
    
    for (const id of ids) {
      const existingPriority = STATUS_PRIORITY[statusMap.get(id) || ''] || 0;
      const newPriority = STATUS_PRIORITY[status] || 0;
      
      if (newPriority > existingPriority) {
        statusMap.set(id, status);
      }
    }
  }

  return statusMap;
}

// Process a single month
async function processMonth(
  supabase: any,
  jobId: string,
  companyId: string,
  apiKey: string,
  year: number,
  month: number,
  invoiceType: 'purchase' | 'sales'
): Promise<{ found: number; saved: number }> {
  const dateFrom = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const dateTo = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

  console.log(`Processing ${invoiceType} invoices for ${dateFrom} to ${dateTo}`);

  // Build status map
  const statusMap = await buildStatusMap(apiKey, dateFrom, dateTo, invoiceType);
  
  if (statusMap.size === 0) {
    console.log(`No invoices found for ${dateFrom} to ${dateTo}`);
    return { found: 0, saved: 0 };
  }

  console.log(`Found ${statusMap.size} invoice IDs for month ${year}-${month}`);

  // Fetch and store each invoice
  let savedCount = 0;
  const invoiceIds = Array.from(statusMap.keys());

  for (let i = 0; i < invoiceIds.length; i++) {
    const invoiceId = invoiceIds[i];
    if (i > 0) await delay(600);

    const status = statusMap.get(invoiceId) || 'Unknown';
    
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
    let xmlData: string | null = null;

    try {
      const endpoint = invoiceType === 'purchase' ? 'purchase-invoice' : 'sales-invoice';
      const invoiceResponse = await fetch(
        `${SEF_API_BASE}/${endpoint}?invoiceId=${invoiceId}`,
        {
          method: 'GET',
          headers: {
            'ApiKey': apiKey,
            'Accept': 'application/json',
          },
        }
      );

      if (invoiceResponse.ok) {
        const data = await invoiceResponse.json();
        
        invoiceNumber = pickString(data, ['invoiceNumber', 'InvoiceNumber', 'Number', 'ID']);
        issueDate = pickString(data, ['issueDate', 'IssueDate', 'InvoiceIssueDate']);
        deliveryDate = pickString(data, ['deliveryDate', 'DeliveryDate']);
        dueDate = pickString(data, ['dueDate', 'DueDate', 'PaymentDueDate']);
        
        // Counterparty: for purchase invoices it's supplier, for sales it's buyer
        if (invoiceType === 'sales') {
          supplierName = pickString(data, ['buyerName', 'BuyerName', 'Buyer', 'ReceiverName', 'CustomerName']);
          supplierPib = pickString(data, ['buyerPib', 'BuyerPib', 'BuyerTaxId', 'CustomerTaxId']);
          supplierMaticniBroj = pickString(data, ['buyerMaticniBroj', 'BuyerMaticniBroj', 'BuyerRegistrationNumber']);
          supplierAddress = pickString(data, ['buyerAddress', 'BuyerAddress', 'CustomerAddress']);
        } else {
          supplierName = pickString(data, ['supplierName', 'SupplierName', 'Supplier', 'SenderName']);
          supplierPib = pickString(data, ['supplierPib', 'SupplierPib', 'SupplierTaxId']);
          supplierMaticniBroj = pickString(data, ['supplierMaticniBroj', 'SupplierMaticniBroj']);
          supplierAddress = pickString(data, ['supplierAddress', 'SupplierAddress']);
        }
        
        totalAmount = pickNumber(data, ['totalAmount', 'TotalAmount', 'payableAmount', 'PayableAmount']);
        vatAmount = pickNumber(data, ['vatAmount', 'VatAmount', 'taxAmount']);
        currency = pickString(data, ['documentCurrencyCode', 'currency', 'Currency'], 'RSD') || 'RSD';
      }
    } catch (e) {
      console.error(`Error fetching invoice ${invoiceId}:`, e);
    }

    // Try XML fallback if key fields are missing
    if (!invoiceNumber || !issueDate || totalAmount === 0 || !supplierName) {
      try {
        await delay(400);
        const endpoint = invoiceType === 'purchase' ? 'purchase-invoice' : 'sales-invoice';
        const xmlResponse = await fetch(
          `${SEF_API_BASE}/${endpoint}/xml?invoiceId=${invoiceId}`,
          {
            method: 'GET',
            headers: {
              'ApiKey': apiKey,
              'Accept': 'application/xml',
            },
          }
        );

        if (xmlResponse.ok) {
          xmlData = await xmlResponse.text();
          const parsed = parseUblXml(xmlData, invoiceType);
          
          if (!invoiceNumber && parsed.invoiceNumber) invoiceNumber = parsed.invoiceNumber;
          if (!issueDate && parsed.issueDate) issueDate = parsed.issueDate;
          if (totalAmount === 0 && parsed.totalAmount) totalAmount = parsed.totalAmount;
          if (!supplierName && parsed.counterpartyName) supplierName = parsed.counterpartyName;
          if (!supplierPib && parsed.counterpartyPib) supplierPib = parsed.counterpartyPib;
          if (!currency && parsed.currency) currency = parsed.currency || 'RSD';
        }
      } catch (e) {
        console.error(`Error fetching XML for ${invoiceId}:`, e);
      }
    }

    // Skip empty invoices - don't save if no meaningful data was retrieved
    if (!invoiceNumber && !issueDate && totalAmount === 0 && !supplierName) {
      console.log(`Skipping invoice ${invoiceId} - no data available from API`);
      continue;
    }

    // Upsert invoice
    const { error } = await supabase
      .from('sef_invoices')
      .upsert({
        company_id: companyId,
        sef_invoice_id: invoiceId,
        invoice_type: invoiceType,
        invoice_number: invoiceNumber,
        issue_date: toNullableDate(issueDate),
        delivery_date: toNullableDate(deliveryDate),
        due_date: toNullableDate(dueDate),
        counterparty_name: supplierName,
        counterparty_pib: supplierPib,
        counterparty_maticni_broj: supplierMaticniBroj,
        counterparty_address: supplierAddress,
        total_amount: totalAmount || 0,
        vat_amount: vatAmount || null,
        currency: currency || 'RSD',
        sef_status: status,
        local_status: 'pending',
        ubl_xml: xmlData,
        fetched_at: new Date().toISOString(),
      }, {
        onConflict: 'company_id,sef_invoice_id,invoice_type'
      });

    if (!error) savedCount++;
  }

  return { found: invoiceIds.length, saved: savedCount };
}

// Calculate month offset from a date label like "2024-06"
function calculateMonthOffset(monthLabel: string): number {
  const [year, month] = monthLabel.split('-').map(Number);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
  return (currentYear - year) * 12 + (currentMonth - month);
}

// Main background processing function with chunking
async function processLongSync(
  supabase: any,
  jobId: string,
  companyId: string,
  apiKey: string,
  yearsBack: number,
  invoiceType: 'purchase' | 'sales',
  resumeFromMonth: string | null = null
) {
  try {
    const totalMonths = yearsBack * 12;
    
    // Calculate starting point
    let startOffset: number;
    let processedMonthsBase: number;
    let totalFound: number;
    let totalSaved: number;
    
    if (resumeFromMonth) {
      // Resume: calculate offset from the last processed month
      startOffset = calculateMonthOffset(resumeFromMonth) - 1;
      
      // Get current progress from job
      const { data: jobData } = await supabase
        .from('sef_sync_jobs')
        .select('processed_months, invoices_found, invoices_saved')
        .eq('id', jobId)
        .single();
      
      processedMonthsBase = jobData?.processed_months || 0;
      totalFound = jobData?.invoices_found || 0;
      totalSaved = jobData?.invoices_saved || 0;
      
      console.log(`Resuming from month ${resumeFromMonth}, offset ${startOffset}, already processed ${processedMonthsBase}`);
    } else {
      // Fresh start
      startOffset = totalMonths - 1;
      processedMonthsBase = 0;
      totalFound = 0;
      totalSaved = 0;
    }
    
    // Update job status to running
    await supabase
      .from('sef_sync_jobs')
      .update({ 
        status: 'running',
        started_at: resumeFromMonth ? undefined : new Date().toISOString()
      })
      .eq('id', jobId);

    const now = new Date();
    let processedInChunk = 0;

    // Process months, starting from the calculated offset
    for (let monthsAgo = startOffset; monthsAgo >= 0; monthsAgo--) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
      const year = targetDate.getFullYear();
      const month = targetDate.getMonth() + 1;
      const currentMonthLabel = `${year}-${String(month).padStart(2, '0')}`;

      // Process month
      const { found, saved } = await processMonth(
        supabase,
        jobId,
        companyId,
        apiKey,
        year,
        month,
        invoiceType
      );

      totalFound += found;
      totalSaved += saved;
      processedInChunk++;
      
      const totalProcessedMonths = processedMonthsBase + processedInChunk;

      // Update progress (triggers updated_at via database trigger)
      await supabase
        .from('sef_sync_jobs')
        .update({
          current_month: currentMonthLabel,
          last_processed_month: currentMonthLabel,
          processed_months: totalProcessedMonths,
          invoices_found: totalFound,
          invoices_saved: totalSaved
        })
        .eq('id', jobId);

      console.log(`Completed month ${currentMonthLabel}: ${found} found, ${saved} saved. Total: ${totalProcessedMonths}/${totalMonths}`);

      // Check if we've completed a chunk and there's more to do
      if (processedInChunk >= MONTHS_PER_CHUNK && monthsAgo > 0) {
        console.log(`Chunk complete (${processedInChunk} months). Marking as partial for cron to continue.`);
        
        await supabase
          .from('sef_sync_jobs')
          .update({
            status: 'partial'
            // Don't set completed_at - cron will continue
          })
          .eq('id', jobId);
        
        return; // Exit - cron will pick up and continue
      }

      // Add delay between months to avoid overloading
      if (monthsAgo > 0) {
        await delay(2000);
      }
    }

    // All months completed - mark as done
    await supabase
      .from('sef_sync_jobs')
      .update({
        status: 'completed',
        processed_months: totalMonths,
        invoices_found: totalFound,
        invoices_saved: totalSaved,
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);

    console.log(`Long sync completed: ${totalFound} invoices found, ${totalSaved} saved`);

  } catch (error) {
    console.error('Long sync error:', error);
    
    await supabase
      .from('sef_sync_jobs')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { companyId, yearsBack = 3, invoiceType = 'purchase', continueJobId } = await req.json();

    // If continuing an existing partial job (called by cron runner)
    if (continueJobId) {
      // Validate internal cron token for continuation requests
      const cronToken = req.headers.get('x-cron-token');
      const expectedToken = Deno.env.get('CHECKPOINT_API_TOKEN');
      
      if (!cronToken || cronToken !== expectedToken) {
        console.error('Unauthorized cron call - invalid or missing x-cron-token');
        return new Response(
          JSON.stringify({ success: false, error: 'Unauthorized' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401
          }
        );
      }
      
      console.log(`Continuing partial job ${continueJobId} (authorized via cron token)`);
      
      const { data: existingJob, error: jobError } = await supabase
        .from('sef_sync_jobs')
        .select('*, companies!inner(sef_api_key)')
        .eq('id', continueJobId)
        .eq('status', 'partial')
        .single();
      
      if (jobError || !existingJob) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Partial job not found or not in partial status'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 404
          }
        );
      }
      
      const apiKey = (existingJob.companies as any).sef_api_key;
      
      if (!apiKey) {
        return new Response(
          JSON.stringify({ success: false, error: 'SEF API key not found' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          }
        );
      }
      
      // Continue processing in background
      EdgeRuntime.waitUntil(
        processLongSync(
          supabase,
          existingJob.id,
          existingJob.company_id,
          apiKey,
          existingJob.total_months / 12,
          existingJob.invoice_type as 'purchase' | 'sales',
          existingJob.last_processed_month
        )
      );
      
      return new Response(
        JSON.stringify({
          success: true,
          jobId: existingJob.id,
          message: 'Continuing sync in background'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For new sync requests: validate user JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized - missing auth header' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401
        }
      );
    }

    // Create user-scoped client to validate JWT and check company access
    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await userSupabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims?.sub) {
      console.error('Invalid user JWT:', claimsError);
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized - invalid token' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401
        }
      );
    }

    const userId = claimsData.claims.sub;
    console.log(`User ${userId} starting long sync for company ${companyId}`);

    // Verify user owns this company (RLS will handle this via user-scoped client)
    const { data: userCompany, error: userCompanyError } = await userSupabase
      .from('companies')
      .select('id')
      .eq('id', companyId)
      .maybeSingle();

    if (userCompanyError || !userCompany) {
      console.error('User does not have access to company:', companyId);
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized - no access to company' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403
        }
      );
    }

    // Starting a new sync
    console.log(`Starting long sync for company ${companyId}, ${yearsBack} years back, type: ${invoiceType}`);

    if (!companyId) {
      return new Response(
        JSON.stringify({ success: false, error: 'companyId is required' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }

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

    // Check for existing running/partial job
    const { data: existingJob } = await supabase
      .from('sef_sync_jobs')
      .select('id, status, updated_at')
      .eq('company_id', companyId)
      .eq('invoice_type', invoiceType)
      .in('status', ['pending', 'running', 'partial'])
      .maybeSingle();

    if (existingJob) {
      // Check if job is stale (no activity for 10+ minutes) - auto-reset it
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const jobUpdatedAt = new Date(existingJob.updated_at);
      
      if (jobUpdatedAt < tenMinutesAgo) {
        console.log(`Existing job ${existingJob.id} is stale (${existingJob.status}, last updated ${existingJob.updated_at}). Auto-resetting.`);
        
        await supabase
          .from('sef_sync_jobs')
          .update({
            status: 'failed',
            error_message: 'Automatski resetovan - nema aktivnosti 10+ minuta',
            completed_at: new Date().toISOString()
          })
          .eq('id', existingJob.id);
        
        // Continue to create a new job
      } else {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Sinhronizacija je već u toku',
            jobId: existingJob.id
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 409
          }
        );
      }
    }

    // Create new job
    const totalMonths = yearsBack * 12;
    const { data: job, error: jobError } = await supabase
      .from('sef_sync_jobs')
      .insert({
        company_id: companyId,
        invoice_type: invoiceType,
        total_months: totalMonths,
        status: 'pending'
      })
      .select()
      .single();

    if (jobError || !job) {
      throw new Error('Greška pri kreiranju job-a: ' + (jobError?.message || 'Unknown'));
    }

    // Start background processing
    EdgeRuntime.waitUntil(
      processLongSync(
        supabase,
        job.id,
        companyId,
        company.sef_api_key,
        yearsBack,
        invoiceType
      )
    );

    // Return immediately with job ID
    return new Response(
      JSON.stringify({
        success: true,
        jobId: job.id,
        message: `Sinhronizacija pokrenuta za ${totalMonths} meseci`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
