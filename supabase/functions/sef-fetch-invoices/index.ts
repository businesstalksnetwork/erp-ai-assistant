import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

const SEF_API_BASE = 'https://efaktura.mfin.gov.rs/api/publicApi';

interface SEFInvoiceIdsRequest {
  dateFrom: string;
  dateTo: string;
  status?: string[];
}

interface SEFInvoice {
  invoiceId: string;
  invoiceNumber: string;
  issueDate: string;
  buyerName: string;
  buyerPib?: string;
  totalAmount: number;
  status: string;
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

    const { companyId, dateFrom, dateTo } = await req.json();

    console.log(`Fetching SEF invoices for company: ${companyId}, from: ${dateFrom}, to: ${dateTo}`);

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

    // Get already imported invoice SEF IDs
    const { data: existingInvoices, error: existingError } = await supabase
      .from('invoices')
      .select('sef_invoice_id')
      .eq('company_id', companyId)
      .not('sef_invoice_id', 'is', null);

    if (existingError) {
      console.error('Error fetching existing invoices:', existingError);
    }

    const importedSefIds = new Set(
      (existingInvoices || []).map(inv => inv.sef_invoice_id).filter(Boolean)
    );

    console.log(`Already imported SEF IDs: ${importedSefIds.size}`);

    // Fetch invoice IDs from SEF
    const idsRequestBody: SEFInvoiceIdsRequest = {
      dateFrom,
      dateTo,
      status: ['Sent', 'Approved', 'Seen', 'Rejected', 'Storno', 'Cancelled']
    };

    console.log('Requesting SEF invoice IDs with body:', JSON.stringify(idsRequestBody));

    const idsResponse = await fetch(`${SEF_API_BASE}/sales-invoice/ids`, {
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
    
    // Handle different response formats - API might return array directly or wrapped in object
    let invoiceIds: string[] = [];
    if (Array.isArray(idsResponseData)) {
      invoiceIds = idsResponseData;
    } else if (idsResponseData?.salesInvoiceIds) {
      invoiceIds = idsResponseData.salesInvoiceIds;
    } else if (idsResponseData?.ids) {
      invoiceIds = idsResponseData.ids;
    } else if (idsResponseData?.invoiceIds) {
      invoiceIds = idsResponseData.invoiceIds;
    } else if (typeof idsResponseData === 'object' && idsResponseData !== null) {
      // Try to find any array property
      const arrayProp = Object.values(idsResponseData).find(v => Array.isArray(v));
      if (arrayProp) {
        invoiceIds = arrayProp as string[];
      }
    }
    
    console.log(`Found ${invoiceIds.length} invoice IDs from SEF`);

    // Filter out already imported invoices
    const newInvoiceIds = invoiceIds.filter(id => !importedSefIds.has(id));
    console.log(`New invoices (not imported): ${newInvoiceIds.length}`);

    // Fetch details for each new invoice
    const invoices: SEFInvoice[] = [];
    
    for (const invoiceId of newInvoiceIds) {
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
          const invoiceData = await invoiceResponse.json();
          
          invoices.push({
            invoiceId: invoiceData.salesInvoiceId || invoiceId,
            invoiceNumber: invoiceData.invoiceNumber || '',
            issueDate: invoiceData.issueDate || '',
            buyerName: invoiceData.buyerName || invoiceData.buyer?.name || 'Nepoznat',
            buyerPib: invoiceData.buyerPib || invoiceData.buyer?.pib || '',
            totalAmount: invoiceData.totalAmount || invoiceData.payableAmount || 0,
            status: invoiceData.status || 'Unknown',
          });
        } else {
          console.warn(`Failed to fetch invoice ${invoiceId}: ${invoiceResponse.status}`);
        }
      } catch (err) {
        console.error(`Error fetching invoice ${invoiceId}:`, err);
      }
    }

    console.log(`Successfully fetched ${invoices.length} invoice details`);

    return new Response(JSON.stringify({
      success: true,
      invoices,
      totalFound: invoiceIds.length,
      alreadyImported: importedSefIds.size,
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
