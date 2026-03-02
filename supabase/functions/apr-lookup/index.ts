import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/error-handler.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized - no valid auth token' }), { status: 401, headers: withSecurityHeaders({ ...corsHeaders, 'Content-Type': 'application/json' }) });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized - invalid token' }), { status: 401, headers: withSecurityHeaders({ ...corsHeaders, 'Content-Type': 'application/json' }) });
    }

    const { pib } = await req.json();
    if (!pib || !/^\d{9}$/.test(pib)) {
      return new Response(JSON.stringify({ error: 'PIB mora imati tačno 9 cifara' }), { status: 400, headers: withSecurityHeaders({ ...corsHeaders, 'Content-Type': 'application/json' }) });
    }

    let companyData = null;
    const checkpointToken = Deno.env.get('CHECKPOINT_API_TOKEN');

    if (checkpointToken) {
      try {
        const checkpointUrl = `https://api.checkpoint.rs/api/VratiSubjekt?PIB=${pib}&MBR=&naziv=&token=${checkpointToken}`;
        const checkpointResponse = await fetch(checkpointUrl, { method: 'GET', headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' } });
        if (checkpointResponse.ok) {
          const responseText = await checkpointResponse.text();
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
            }
          }
        }
      } catch (e) { console.log('Checkpoint.rs request failed:', e); }
    }

    if (!companyData) {
      try {
        const params = new URLSearchParams({ CompanyTaxCode: pib, TypeID: '1', 'Pagging.CurrentPage': '1', 'Pagging.PageSize': '50', isSearchExecuted: 'true' });
        const nbsUrl = `https://webappcenter.nbs.rs/PnWebApp/CompanyAccount/CompanyAccountResident?${params.toString()}`;
        const nbsResponse = await fetch(nbsUrl, { method: 'GET', headers: { 'Accept': 'text/html,application/xhtml+xml', 'User-Agent': 'Mozilla/5.0' } });
        if (nbsResponse.ok) {
          const html = await nbsResponse.text();
          const rowMatch = html.match(/<tr[^>]*>\s*<td data-title="Назив корисника рачуна">[\s\S]*?<b>\s*([^<]+?)\s*<\/b>[\s\S]*?<td data-title="Матични број">[\s\S]*?<a [^>]*>\s*(\d+)\s*<\/a>[\s\S]*?<td data-title="Порески број">\s*(\d{9})[\s\S]*?<td data-title="Адреса">\s*([^<]+?)\s*<\/td>\s*<td data-title="Место">\s*([^<]+?)\s*<\/td>/);
          if (rowMatch) {
            const [, name, maticniBroj, , address, city] = rowMatch;
            companyData = { name: name.trim(), address: `${address.trim()}, ${city.trim()}`, city: city.trim(), maticni_broj: maticniBroj.trim() };
          }
        }
      } catch (e) { console.log('NBS request failed:', e); }
    }

    if (!companyData) {
      try {
        const aprResponse = await fetch(`https://pretraga2.apr.gov.rs/APRMBSWEBServiceApi/api/SubjectByPib/GetByPib?pib=${pib}`, { headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' } });
        if (aprResponse.ok) {
          const data = await aprResponse.json();
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
      } catch (e) { console.log('APR MBS endpoint failed:', e); }
    }

    if (!companyData) {
      try {
        const altResponse = await fetch(`https://pretraga2.apr.gov.rs/ObsceKomnJednicaApi/api/ObscjeKomunalne/GetAllByPIBObsce?pib=${pib}`, { headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' } });
        if (altResponse.ok) {
          const data = await altResponse.json();
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
      } catch (e) { console.log('APR ObscKom endpoint failed:', e); }
    }

    if (!companyData || !companyData.name) {
      return new Response(JSON.stringify({ error: 'Firma nije pronađena', found: false }), { status: 404, headers: withSecurityHeaders({ ...corsHeaders, 'Content-Type': 'application/json' }) });
    }

    return new Response(
      JSON.stringify({ found: true, name: companyData.name, address: companyData.address, city: companyData.city || '', maticni_broj: companyData.maticni_broj, pib: pib }),
      { headers: withSecurityHeaders({ ...corsHeaders, 'Content-Type': 'application/json' }) }
    );
  } catch (err) {
    return createErrorResponse(err, req, { logPrefix: "apr-lookup" });
  }
});
