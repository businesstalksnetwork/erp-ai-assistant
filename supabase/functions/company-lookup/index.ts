import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pib } = await req.json();

    if (!pib || !/^\d{9}$/.test(pib)) {
      return new Response(
        JSON.stringify({ error: 'Invalid PIB format. Must be 9 digits.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = Deno.env.get('CHECKPOINT_API_TOKEN');
    if (!token) {
      return new Response(
        JSON.stringify({ found: false, error: 'PIB lookup service not configured. Please add CHECKPOINT_API_TOKEN secret.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiUrl = `https://api.checkpoint.rs/api/VratiSubjekt?PIB=${pib}&token=${token}`;

    const response = await fetch(apiUrl, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      console.error('Checkpoint API error:', response.status, await response.text());
      return new Response(
        JSON.stringify({ found: false, error: 'PIB lookup service unavailable' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();

    if (!data || !data.Naziv) {
      return new Response(
        JSON.stringify({ found: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('company-lookup error:', error);
    return new Response(
      JSON.stringify({ found: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
