import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Create HTTP client that doesn't verify SSL certificates (APR has certificate issues)
const httpClient = Deno.createHttpClient({
  caCerts: [],
});

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pib } = await req.json();

    if (!pib || !/^\d{9}$/.test(pib)) {
      return new Response(
        JSON.stringify({ error: 'PIB mora imati tačno 9 cifara' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Looking up PIB: ${pib}`);

    // Try primary APR API endpoint
    let companyData = null;
    
    try {
      const aprResponse = await fetch(
        `https://pretraga2.apr.gov.rs/APRMBSWEBServiceApi/api/SubjectByPib/GetByPib?pib=${pib}`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0',
          },
          client: httpClient,
        }
      );

      if (aprResponse.ok) {
        const data = await aprResponse.json();
        console.log('APR MBS response:', JSON.stringify(data));
        
        if (data && (!Array.isArray(data) || data.length > 0)) {
          const company = Array.isArray(data) ? data[0] : data;
          companyData = {
            name: company.naziv || company.name || company.fullName || '',
            address: company.sediste || company.adresa || company.address || '',
            maticni_broj: company.maticniBroj || company.mb || '',
          };
        }
      }
    } catch (e) {
      console.log('Primary APR endpoint failed:', e);
    }

    // Try secondary endpoint if primary failed
    if (!companyData) {
      try {
        const altResponse = await fetch(
          `https://pretraga2.apr.gov.rs/ObsceKomnJednicaApi/api/ObscjeKomunalne/GetAllByPIBObsce?pib=${pib}`,
          {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'Mozilla/5.0',
            },
            client: httpClient,
          }
        );

        if (altResponse.ok) {
          const data = await altResponse.json();
          console.log('APR ObscKom response:', JSON.stringify(data));
          
          if (data && (!Array.isArray(data) || data.length > 0)) {
            const company = Array.isArray(data) ? data[0] : data;
            companyData = {
              name: company.naziv || company.name || '',
              address: company.adresa || company.address || '',
              maticni_broj: company.maticniBroj || company.mb || '',
            };
          }
        }
      } catch (e) {
        console.log('Secondary APR endpoint failed:', e);
      }
    }

    if (!companyData || !companyData.name) {
      return new Response(
        JSON.stringify({ error: 'Firma nije pronađena u APR registru', found: false }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        found: true,
        name: companyData.name,
        address: companyData.address,
        maticni_broj: companyData.maticni_broj,
        pib: pib,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in apr-lookup function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: `Greška pri pretrazi: ${errorMessage}`, found: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
