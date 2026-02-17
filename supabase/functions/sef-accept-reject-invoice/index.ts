import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SEF_API_BASE = 'https://efaktura.mfin.gov.rs/api/publicApi';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { companyId, sefInvoiceId, action, comment } = await req.json();

    if (!companyId || !sefInvoiceId || !action) {
      throw new Error('Nedostaju obavezni parametri (companyId, sefInvoiceId, action)');
    }

    if (!['approve', 'reject'].includes(action)) {
      throw new Error('Akcija mora biti "approve" ili "reject"');
    }

    console.log(`Processing SEF ${action} for purchase invoice: ${sefInvoiceId}`);

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

    // Prepare request body for SEF API
    const requestBody = {
      invoiceId: sefInvoiceId,
      accepted: action === 'approve',
      comment: comment || (action === 'approve' ? 'Odobreno' : 'Odbijeno'),
    };

    console.log('Sending accept/reject request to SEF:', JSON.stringify(requestBody));

    // Call SEF API
    const sefResponse = await fetch(`${SEF_API_BASE}/purchase-invoice/acceptRejectPurchaseInvoice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ApiKey': company.sef_api_key,
        'Accept': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await sefResponse.text();
    console.log('SEF response:', responseText);

    let sefResult: any = {};
    try {
      sefResult = JSON.parse(responseText);
    } catch {
      sefResult = { message: responseText };
    }

    if (sefResponse.ok) {
      // Update local status
      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      
      const { error: updateError } = await supabase
        .from('sef_invoices')
        .update({
          local_status: newStatus,
          sef_status: action === 'approve' ? 'Approved' : 'Rejected',
          processed_at: new Date().toISOString(),
        })
        .eq('company_id', companyId)
        .eq('sef_invoice_id', sefInvoiceId)
        .eq('invoice_type', 'purchase');

      if (updateError) {
        console.error('Error updating local status:', updateError);
      }

      return new Response(JSON.stringify({
        success: true,
        message: action === 'approve' ? 'Faktura je uspešno odobrena' : 'Faktura je uspešno odbijena',
        sefResponse: sefResult,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      const errorMessage = sefResult.Message || sefResult.message || 'Greška sa SEF-a';
      throw new Error(errorMessage);
    }

  } catch (error) {
    console.error('SEF accept/reject error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Greška pri obradi fakture',
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
