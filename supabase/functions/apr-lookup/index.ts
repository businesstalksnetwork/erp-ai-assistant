import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pib } = await req.json();

    if (!pib || pib.length !== 9) {
      return new Response(
        JSON.stringify({ error: 'PIB mora imati 9 cifara' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Looking up PIB: ${pib}`);

    // Try the APR API
    const aprResponse = await fetch(
      `https://pretraga2.apr.gov.rs/ObsceKomnJednicaApi/api/ObscjeKomunalne/GetAllByPIBObsce?pib=${pib}`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!aprResponse.ok) {
      console.log(`APR API returned status: ${aprResponse.status}`);
      
      // Try alternative endpoint for regular companies
      const altResponse = await fetch(
        `https://pretraga2.apr.gov.rs/APRMBSWEBServiceApi/api/SubjectByPib/GetByPib?pib=${pib}`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (!altResponse.ok) {
        return new Response(
          JSON.stringify({ error: 'Firma nije pronađena u APR registru', found: false }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const altData = await altResponse.json();
      console.log('Alternative APR response:', JSON.stringify(altData));

      if (!altData || (Array.isArray(altData) && altData.length === 0)) {
        return new Response(
          JSON.stringify({ error: 'Firma nije pronađena', found: false }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const company = Array.isArray(altData) ? altData[0] : altData;
      
      return new Response(
        JSON.stringify({
          found: true,
          name: company.name || company.naziv || company.fullName || '',
          address: company.address || company.adresa || company.sediste || '',
          maticni_broj: company.maticniBroj || company.mb || company.maticni_broj || '',
          pib: pib,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await aprResponse.json();
    console.log('APR response:', JSON.stringify(data));

    if (!data || (Array.isArray(data) && data.length === 0)) {
      return new Response(
        JSON.stringify({ error: 'Firma nije pronađena', found: false }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const company = Array.isArray(data) ? data[0] : data;
    
    return new Response(
      JSON.stringify({
        found: true,
        name: company.naziv || company.name || company.fullName || '',
        address: company.adresa || company.address || company.sediste || '',
        maticni_broj: company.maticniBroj || company.mb || '',
        pib: pib,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in apr-lookup function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage, found: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
