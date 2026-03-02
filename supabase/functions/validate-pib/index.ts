import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";
import { checkRateLimit } from "../_shared/rate-limiter.ts";
import { createErrorResponse } from "../_shared/error-handler.ts";

Deno.serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;
  const corsHeaders = getCorsHeaders(req);

  try {
    // Rate limit: 30 requests per minute per IP
    const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
    const rl = await checkRateLimit(`validate-pib:${clientIp}`, "sef");
    if (!rl.allowed) {
      return createErrorResponse("Rate limit exceeded", req, { status: 429, logPrefix: "validate-pib rate-limit" });
    }

    const { pib } = await req.json();

    // Validate PIB format
    if (!pib || !/^\d{9}$/.test(pib)) {
      return new Response(
        JSON.stringify({ valid: false, error: 'PIB mora imati tačno 9 cifara' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Validating PIB: ${pib}`);

    const checkpointToken = Deno.env.get('CHECKPOINT_API_TOKEN');

    if (!checkpointToken) {
      console.error('CHECKPOINT_API_TOKEN not configured - allowing registration');
      // If token not configured, allow registration (don't block users)
      return new Response(
        JSON.stringify({ valid: true, companyName: null, warning: 'Validacija nije dostupna' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Try Checkpoint.rs API
    try {
      console.log('Calling Checkpoint.rs API...');
      const checkpointUrl = `https://api.checkpoint.rs/api/VratiSubjekt?PIB=${pib}&MBR=&naziv=&token=${checkpointToken}`;
      
      const checkpointResponse = await fetch(checkpointUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0',
        },
      });

      console.log('Checkpoint.rs response status:', checkpointResponse.status);

      if (!checkpointResponse.ok) {
        const errorText = await checkpointResponse.text();
        console.error('Checkpoint.rs error:', errorText);
        // API error - allow registration to not block users
        return new Response(
          JSON.stringify({ valid: true, companyName: null, warning: 'Greška API-ja' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const responseText = await checkpointResponse.text();
      console.log('Checkpoint.rs raw response:', responseText);
      
      const data = JSON.parse(responseText);
      
      // Check if we got valid company data
      if (data && (!Array.isArray(data) || data.length > 0)) {
        const company = Array.isArray(data) ? data[0] : data;
        
        // Check if company has a name (indicates it exists and is active)
        if (company.Naziv || company.Naziv_skraceni || company.naziv) {
          const companyName = company.Naziv || company.Naziv_skraceni || company.naziv || '';
          console.log(`PIB ${pib} is valid. Company: ${companyName}`);
          
          return new Response(
            JSON.stringify({ valid: true, companyName }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
      
      // Empty response - PIB not found in Checkpoint registry
      console.log(`PIB ${pib} not found in Checkpoint.rs registry`);
      return new Response(
        JSON.stringify({ valid: false, error: 'PIB nije pronađen u registru aktivnih firmi' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
      
    } catch (apiError) {
      console.error('Checkpoint.rs API error:', apiError);
      // On API error, allow registration to not block users
      return new Response(
        JSON.stringify({ valid: true, companyName: null, warning: 'API greška' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Error in validate-pib function:', error);
    // On any error, allow registration
    return new Response(
      JSON.stringify({ valid: true, companyName: null, warning: 'Validacija nedostupna' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
