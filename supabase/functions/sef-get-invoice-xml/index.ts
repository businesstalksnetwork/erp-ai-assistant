import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/error-handler.ts";

const SEF_API_BASE = 'https://efaktura.mfin.gov.rs/api/publicApi';

serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;
  const corsHeaders = getCorsHeaders(req);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { companyId, sefInvoiceId, invoiceType } = await req.json();

    if (!companyId || !sefInvoiceId || !invoiceType) {
      throw new Error('Nedostaju obavezni parametri');
    }

    console.log(`Fetching UBL XML for ${invoiceType} invoice: ${sefInvoiceId}`);

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

    // Check if we already have XML stored locally
    const { data: storedInvoice } = await supabase
      .from('sef_invoices')
      .select('ubl_xml')
      .eq('company_id', companyId)
      .eq('sef_invoice_id', sefInvoiceId)
      .eq('invoice_type', invoiceType)
      .single();

    if (storedInvoice?.ubl_xml) {
      console.log('Returning cached UBL XML');
      return new Response(JSON.stringify({
        success: true,
        xml: storedInvoice.ubl_xml,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch XML from SEF API
    const endpoint = invoiceType === 'purchase' 
      ? `${SEF_API_BASE}/purchase-invoice/xml?invoiceId=${sefInvoiceId}`
      : `${SEF_API_BASE}/sales-invoice/xml?invoiceId=${sefInvoiceId}`;

    const xmlResponse = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'ApiKey': company.sef_api_key,
        'Accept': 'application/xml',
      },
    });

    if (!xmlResponse.ok) {
      const errorText = await xmlResponse.text();
      console.error('SEF XML API error:', errorText);
      throw new Error(`SEF API greška: ${xmlResponse.status}`);
    }

    const xml = await xmlResponse.text();
    console.log('Successfully fetched UBL XML');

    // Store XML for future use
    if (xml) {
      const { error: updateError } = await supabase
        .from('sef_invoices')
        .update({ ubl_xml: xml })
        .eq('company_id', companyId)
        .eq('sef_invoice_id', sefInvoiceId)
        .eq('invoice_type', invoiceType);

      if (updateError) {
        console.error('Error storing XML:', updateError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      xml,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return createErrorResponse(error, req, { logPrefix: "SEF XML fetch error" });
  }
});
