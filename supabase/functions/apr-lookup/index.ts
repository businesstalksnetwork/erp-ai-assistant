import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the user using getClaims
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - no valid auth token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`APR lookup request from user: ${user.id}`);

    const { pib } = await req.json();

    if (!pib || !/^\d{9}$/.test(pib)) {
      return new Response(
        JSON.stringify({ error: 'PIB mora imati tačno 9 cifara' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Looking up PIB: ${pib}`);

    let companyData = null;
    const checkpointToken = Deno.env.get('CHECKPOINT_API_TOKEN');

    // Try Checkpoint.rs API as primary source
    if (checkpointToken) {
      try {
        console.log('Trying Checkpoint.rs API...');
        // Use VratiSubjekt endpoint with all required parameters
        const checkpointUrl = `https://api.checkpoint.rs/api/VratiSubjekt?PIB=${pib}&MBR=&naziv=&token=${checkpointToken}`;
        
        const checkpointResponse = await fetch(checkpointUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0',
          },
        });

        console.log('Checkpoint.rs response status:', checkpointResponse.status);

        if (checkpointResponse.ok) {
          const responseText = await checkpointResponse.text();
          console.log('Checkpoint.rs raw response:', responseText);
          
          try {
            const data = JSON.parse(responseText);
            
            if (data && (!Array.isArray(data) || data.length > 0)) {
              const company = Array.isArray(data) ? data[0] : data;
              if (company.Naziv || company.Naziv_skraceni || company.naziv) {
                companyData = {
                  name: company.Naziv || company.Naziv_skraceni || company.naziv || '',
                  address: company.Adresa || company.adresa || '',
                  city: company.Mesto || company.mesto || '',
                  maticni_broj: company.MBR || company.Mbr || company.mbr || '',
                };
                console.log('Checkpoint.rs match:', companyData);
              }
            }
          } catch (parseError) {
            console.log('Checkpoint.rs JSON parse error:', parseError);
          }
        } else {
          const errorText = await checkpointResponse.text();
          console.log('Checkpoint.rs error response:', errorText);
        }
      } catch (e) {
        console.log('Checkpoint.rs request failed:', e);
      }
    } else {
      console.log('CHECKPOINT_API_TOKEN not configured, skipping Checkpoint.rs');
    }

    // Try NBS company account registry as fallback
    if (!companyData) {
      try {
        console.log('Trying NBS registry...');

        const params = new URLSearchParams({
          CompanyTaxCode: pib,
          TypeID: '1',
          'Pagging.CurrentPage': '1',
          'Pagging.PageSize': '50',
          isSearchExecuted: 'true',
        });

        const nbsUrl = `https://webappcenter.nbs.rs/PnWebApp/CompanyAccount/CompanyAccountResident?${params.toString()}`;

        const nbsResponse = await fetch(nbsUrl, {
          method: 'GET',
          headers: {
            'Accept': 'text/html,application/xhtml+xml',
            'User-Agent': 'Mozilla/5.0',
          },
        });

        console.log('NBS response status:', nbsResponse.status);

        if (nbsResponse.ok) {
          const html = await nbsResponse.text();

          // Extract first row from HTML table. (Page lists accounts; company data repeats per account.)
          const rowMatch = html.match(
            /<tr[^>]*>\s*<td data-title="Назив корисника рачуна">[\s\S]*?<b>\s*([^<]+?)\s*<\/b>[\s\S]*?<td data-title="Матични број">[\s\S]*?<a [^>]*>\s*(\d+)\s*<\/a>[\s\S]*?<td data-title="Порески број">\s*(\d{9})[\s\S]*?<td data-title="Адреса">\s*([^<]+?)\s*<\/td>\s*<td data-title="Место">\s*([^<]+?)\s*<\/td>/
          );

          if (rowMatch) {
            const [, name, maticniBroj, , address, city] = rowMatch;
            companyData = {
              name: name.trim(),
              address: `${address.trim()}, ${city.trim()}`,
              city: city.trim(),
              maticni_broj: maticniBroj.trim(),
            };
            console.log('NBS match:', { name: companyData.name, maticni_broj: companyData.maticni_broj });
          } else {
            console.log('NBS: no match found in HTML');
          }
        }
      } catch (e) {
        console.log('NBS request failed:', e);
      }
    }

    // Try APR API as secondary fallback
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
              city: '',
              maticni_broj: company.maticniBroj || company.mb || '',
            };
          }
        }
      } catch (e) {
        console.log('APR MBS endpoint failed:', e);
      }
    }

    // Try tertiary APR endpoint
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
              city: '',
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
        city: companyData.city || '',
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
