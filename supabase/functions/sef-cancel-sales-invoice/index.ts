import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SEF_API_BASE = 'https://efaktura.mfin.gov.rs/api/publicApi';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { companyId, sefInvoiceId, action, comment } = await req.json();

    console.log(`SEF cancel/storno request: company=${companyId}, invoice=${sefInvoiceId}, action=${action}`);

    if (!companyId || !sefInvoiceId) {
      throw new Error('Nedostaju obavezni parametri: companyId i sefInvoiceId');
    }

    if (!action || !['cancel', 'storno'].includes(action)) {
      throw new Error('Nevažeća akcija. Dozvoljene vrednosti: cancel, storno');
    }

    // Get company with SEF API key
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single();

    if (companyError || !company) {
      console.error('Company error:', companyError);
      throw new Error('Kompanija nije pronađena');
    }

    if (!company.sef_api_key) {
      throw new Error('SEF API ključ nije podešen za ovu kompaniju');
    }

    let endpoint: string;
    let method: string = 'POST';
    let body: any = null;

    if (action === 'cancel') {
      // Cancel is for invoices in Draft/New status - uses query param
      endpoint = `${SEF_API_BASE}/sales-invoice/cancel?invoiceId=${sefInvoiceId}`;
      console.log(`Cancelling invoice via: ${endpoint}`);
    } else {
      // Storno is for sent/approved invoices - uses body with comment
      endpoint = `${SEF_API_BASE}/sales-invoice/storno`;
      body = {
        InvoiceId: parseInt(sefInvoiceId),
        StornoComment: comment || 'Storniranje fakture'
      };
      console.log(`Storno invoice via: ${endpoint}`, body);
    }

    const response = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'ApiKey': company.sef_api_key,
        'Accept': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const responseText = await response.text();
    console.log(`SEF response status: ${response.status}`);
    console.log(`SEF response body: ${responseText}`);

    if (!response.ok) {
      // Try to parse error message from response
      let errorMessage = `SEF API greška: ${response.status}`;
      try {
        const errorData = JSON.parse(responseText);
        if (errorData.message) {
          errorMessage = errorData.message;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        } else if (errorData.Message) {
          errorMessage = errorData.Message;
        }
      } catch {
        if (responseText) {
          errorMessage = responseText.slice(0, 200);
        }
      }
      throw new Error(errorMessage);
    }

    // Parse successful response
    let responseData: any = {};
    try {
      responseData = JSON.parse(responseText);
    } catch {
      // Response might be empty for cancel
    }

    // Update local status in sef_invoices
    const newStatus = action === 'cancel' ? 'Cancelled' : 'Storno';
    const { error: updateError } = await supabase
      .from('sef_invoices')
      .update({
        sef_status: newStatus,
        local_status: action === 'cancel' ? 'cancelled' : 'storno',
        processed_at: new Date().toISOString(),
      })
      .eq('company_id', companyId)
      .eq('sef_invoice_id', sefInvoiceId)
      .eq('invoice_type', 'sales');

    if (updateError) {
      console.error('Error updating local invoice status:', updateError);
      // Don't throw - the SEF operation succeeded
    }

    // Also update the main invoices table if linked
    const { error: invoiceUpdateError } = await supabase
      .from('invoices')
      .update({
        sef_status: action === 'cancel' ? 'cancelled' : 'storno',
      })
      .eq('sef_invoice_id', sefInvoiceId)
      .eq('company_id', companyId);

    if (invoiceUpdateError) {
      console.log('Note: Could not update linked invoice (may not exist):', invoiceUpdateError.message);
    }

    const successMessage = action === 'cancel' 
      ? 'Faktura je uspešno otkazana na SEF-u' 
      : 'Faktura je uspešno stornirana na SEF-u';

    return new Response(JSON.stringify({
      success: true,
      message: successMessage,
      action,
      sefInvoiceId,
      newStatus,
      sefResponse: responseData,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('SEF cancel/storno error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Greška pri storniranju fakture',
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
