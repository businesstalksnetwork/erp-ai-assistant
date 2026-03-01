import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

const SEF_API_BASE = 'https://efaktura.mfin.gov.rs/api/publicApi';

serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;
  const corsHeaders = getCorsHeaders(req);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ── CR4-01: Use getClaims() instead of getUser() ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: authErr } = await supabase.auth.getClaims(token);
    if (authErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const authUser = { id: claimsData.claims.sub as string };

    const { companyId, sefInvoiceId, action, comment } = await req.json();

    console.log(`SEF cancel/storno request: company=${companyId}, invoice=${sefInvoiceId}, action=${action}`);

    if (!companyId || !sefInvoiceId) {
      return new Response(JSON.stringify({ success: false, error: 'Nedostaju obavezni parametri: companyId i sefInvoiceId' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!action || !['cancel', 'storno'].includes(action)) {
      return new Response(JSON.stringify({ success: false, error: 'Nevažeća akcija. Dozvoljene vrednosti: cancel, storno' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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

    // ── P1-01: Tenant membership verification ──
    const { data: memberChk } = await supabase
      .from("tenant_members").select("id")
      .eq("user_id", authUser.id).eq("tenant_id", company.tenant_id).eq("status", "active").maybeSingle();
    const { data: saChk } = await supabase
      .from("user_roles").select("id")
      .eq("user_id", authUser.id).eq("role", "super_admin").maybeSingle();
    if (!memberChk && !saChk) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
    const msg = error instanceof Error ? error.message : 'Greška pri storniranju fakture';

    // CR3-05: Return appropriate status codes instead of always 500
    let status = 500;
    const lower = msg.toLowerCase();
    if (lower.includes('nedostaju') || lower.includes('nevažeća') || lower.includes('invalid') || lower.includes('missing')) {
      status = 400;
    } else if (lower.includes('nije pronađen') || lower.includes('not found')) {
      status = 404;
    } else if (lower.includes('sef api greška') || lower.includes('sef api')) {
      status = 502;
    }

    return new Response(JSON.stringify({
      success: false,
      error: msg,
    }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
