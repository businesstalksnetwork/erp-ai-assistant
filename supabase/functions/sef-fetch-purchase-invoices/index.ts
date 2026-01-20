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
  return val;
};

interface SEFPurchaseInvoice {
  sefInvoiceId: string;
  invoiceNumber: string;
  issueDate: string;
  deliveryDate?: string;
  dueDate?: string;
  supplierName: string;
  supplierPib?: string;
  supplierMaticniBroj?: string;
  supplierAddress?: string;
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

    // Check which invoices are already stored locally
    const { data: existingInvoices } = await supabase
      .from('sef_invoices')
      .select('sef_invoice_id')
      .eq('company_id', companyId)
      .eq('invoice_type', 'purchase');

    const existingSefIds = new Set(
      (existingInvoices || []).map(inv => inv.sef_invoice_id)
    );

    // Fetch details for each invoice
    const invoices: SEFPurchaseInvoice[] = [];
    const newInvoicesForStorage: any[] = [];

    for (const invoiceId of invoiceIds) {
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
          
          const invoice: SEFPurchaseInvoice = {
            sefInvoiceId: data.purchaseInvoiceId || invoiceId,
            invoiceNumber: data.invoiceNumber || '',
            issueDate: data.issueDate || '',
            deliveryDate: data.deliveryDate,
            dueDate: data.dueDate,
            supplierName: data.supplierName || data.supplier?.name || 'Nepoznat',
            supplierPib: data.supplierPib || data.supplier?.pib,
            supplierMaticniBroj: data.supplierMaticniBroj || data.supplier?.maticniBroj,
            supplierAddress: data.supplierAddress || data.supplier?.address,
            totalAmount: data.totalAmount || data.payableAmount || 0,
            vatAmount: data.vatAmount || 0,
            currency: data.documentCurrencyCode || 'RSD',
            status: data.status || 'Unknown',
          };

          invoices.push(invoice);

          // Store in database if not already exists
          if (!existingSefIds.has(invoiceId)) {
            newInvoicesForStorage.push({
              company_id: companyId,
              sef_invoice_id: invoice.sefInvoiceId,
              invoice_type: 'purchase',
              invoice_number: invoice.invoiceNumber || null,
              issue_date: toNullableDate(invoice.issueDate),
              delivery_date: toNullableDate(invoice.deliveryDate),
              due_date: toNullableDate(invoice.dueDate),
              counterparty_name: invoice.supplierName,
              counterparty_pib: invoice.supplierPib || null,
              counterparty_maticni_broj: invoice.supplierMaticniBroj || null,
              counterparty_address: invoice.supplierAddress || null,
              total_amount: invoice.totalAmount || 0,
              vat_amount: invoice.vatAmount || null,
              currency: invoice.currency || 'RSD',
              sef_status: invoice.status || 'Unknown',
              local_status: 'pending',
            });
          }
        } else {
          console.warn(`Failed to fetch invoice ${invoiceId}: ${invoiceResponse.status}`);
        }
      } catch (err) {
        console.error(`Error fetching invoice ${invoiceId}:`, err);
      }
    }

    // Store new invoices
    if (newInvoicesForStorage.length > 0) {
      const { error: insertError } = await supabase
        .from('sef_invoices')
        .upsert(newInvoicesForStorage, {
          onConflict: 'company_id,sef_invoice_id,invoice_type',
          ignoreDuplicates: true
        });

      if (insertError) {
        console.error('Error storing invoices:', insertError);
      } else {
        console.log(`Stored ${newInvoicesForStorage.length} new purchase invoices`);
      }
    }

    console.log(`Successfully fetched ${invoices.length} purchase invoice details`);

    return new Response(JSON.stringify({
      success: true,
      invoices,
      totalFound: invoiceIds.length,
      newlyStored: newInvoicesForStorage.length,
      alreadyStored: existingSefIds.size,
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
