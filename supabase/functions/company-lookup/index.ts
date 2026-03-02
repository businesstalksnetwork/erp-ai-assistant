import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/error-handler.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";
import { checkRateLimit } from "../_shared/rate-limiter.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: withSecurityHeaders({ ...corsHeaders, 'Content-Type': 'application/json' }) });
    }
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: withSecurityHeaders({ ...corsHeaders, 'Content-Type': 'application/json' }) });
    }

    // Rate limit: 20 requests per minute per user
    const rl = await checkRateLimit(`company-lookup:${user.id}`, "crud");
    if (!rl.allowed) {
      return createErrorResponse("Rate limit exceeded", req, { status: 429, logPrefix: "company-lookup rate-limit" });
    }

    const { pib } = await req.json();
    if (!pib || !/^\d{9}$/.test(pib)) {
      return new Response(JSON.stringify({ error: 'Invalid PIB format. Must be 9 digits.' }), { status: 400, headers: withSecurityHeaders({ ...corsHeaders, 'Content-Type': 'application/json' }) });
    }

    const token = Deno.env.get('CHECKPOINT_API_TOKEN');
    if (!token) {
      return new Response(JSON.stringify({ found: false, error: 'PIB lookup service not configured' }), { status: 200, headers: withSecurityHeaders({ ...corsHeaders, 'Content-Type': 'application/json' }) });
    }

    const apiUrl = `https://api.checkpoint.rs/api/VratiSubjekt?PIB=${pib}&token=${token}`;
    const response = await fetch(apiUrl, { headers: { 'Accept': 'application/json' } });

    if (!response.ok) {
      return new Response(JSON.stringify({ found: false, error: 'PIB lookup service unavailable' }), { status: 200, headers: withSecurityHeaders({ ...corsHeaders, 'Content-Type': 'application/json' }) });
    }

    const data = await response.json();
    if (!data || !data.Naziv) {
      return new Response(JSON.stringify({ found: false }), { status: 200, headers: withSecurityHeaders({ ...corsHeaders, 'Content-Type': 'application/json' }) });
    }

    return new Response(
      JSON.stringify({
        found: true,
        legal_name: data.Naziv || '',
        pib: pib,
        maticni_broj: data.MBR || '',
        address: data.Adresa || '',
        city: data.Mesto || '',
        postal_code: data.Postanski_broj || '',
        country: 'Srbija',
      }),
      { status: 200, headers: withSecurityHeaders({ ...corsHeaders, 'Content-Type': 'application/json' }) }
    );
  } catch (err) {
    return createErrorResponse(err, req, { logPrefix: "company-lookup" });
  }
});
