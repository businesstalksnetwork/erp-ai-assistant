import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Create HTTP client that doesn't verify SSL certificates
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

    let companyData = null;

    // Try NBS Company Account API first
    try {
      console.log('Trying NBS API...');
      
      // NBS uses a search endpoint
      const nbsSearchUrl = `https://webappcenter.nbs.rs/PnWebApp/CompanyAccount/CompanyAccountResident/Search`;
      
      const nbsResponse = await fetch(nbsSearchUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'X-Requested-With': 'XMLHttpRequest',
          'Origin': 'https://webappcenter.nbs.rs',
          'Referer': 'https://webappcenter.nbs.rs/PnWebApp/CompanyAccount/CompanyAccountResident/Index',
        },
        body: `pib=${pib}&maticniBroj=&naziv=`,
        client: httpClient,
      });

      console.log('NBS response status:', nbsResponse.status);

      if (nbsResponse.ok) {
        const text = await nbsResponse.text();
        console.log('NBS raw response:', text.substring(0, 500));
        
        // Try to parse as JSON
        try {
          const data = JSON.parse(text);
          console.log('NBS parsed data:', JSON.stringify(data));
          
          if (data && Array.isArray(data) && data.length > 0) {
            const company = data[0];
            companyData = {
              name: company.naziv || company.Naziv || company.name || '',
              address: company.sediste || company.Sediste || company.adresa || company.Adresa || '',
              maticni_broj: company.maticniBroj || company.MaticniBroj || company.mb || '',
            };
          } else if (data && data.Data && Array.isArray(data.Data) && data.Data.length > 0) {
            const company = data.Data[0];
            companyData = {
              name: company.naziv || company.Naziv || company.name || '',
              address: company.sediste || company.Sediste || company.adresa || company.Adresa || '',
              maticni_broj: company.maticniBroj || company.MaticniBroj || company.mb || '',
            };
          }
        } catch (parseError) {
          console.log('NBS response is not JSON, trying HTML parsing...');
          
          // Try to extract data from HTML table if it's HTML response
          const nameMatch = text.match(/<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>/);
          if (nameMatch) {
            console.log('Found HTML table data');
          }
        }
      }
    } catch (e) {
      console.log('NBS API failed:', e);
    }

    // Try APR API as fallback
    if (!companyData) {
      try {
        console.log('Trying APR MBS API...');
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
        console.log('APR MBS endpoint failed:', e);
      }
    }

    // Try secondary APR endpoint
    if (!companyData) {
      try {
        console.log('Trying APR ObscKom API...');
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
        console.log('APR ObscKom endpoint failed:', e);
      }
    }

    if (!companyData || !companyData.name) {
      return new Response(
        JSON.stringify({ error: 'Firma nije pronađena', found: false }),
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
