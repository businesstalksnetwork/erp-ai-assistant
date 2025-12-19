import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { currency, date } = await req.json();
    
    if (!currency || !date) {
      return new Response(
        JSON.stringify({ error: 'Currency and date are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate currency (ISO 4217: 3 uppercase letters)
    if (typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) {
      return new Response(
        JSON.stringify({ error: 'Invalid currency format. Use 3-letter ISO code (e.g., EUR, USD)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate date format (YYYY-MM-DD)
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return new Response(
        JSON.stringify({ error: 'Invalid date format. Use YYYY-MM-DD' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching NBS rate for ${currency} on ${date}`);

    // Format date for NBS API (DD.MM.YYYY)
    const [year, month, day] = date.split('-');

    // Try kurs.resenje.org API first (simpler JSON API)
    const apiUrl = `https://kurs.resenje.org/api/v1/currencies/${currency}/rates/${year}/${month}/${day}`;
    
    console.log(`Calling API: ${apiUrl}`);
    
    const response = await fetch(apiUrl);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`API response:`, data);
      
      // The API returns middle rate (srednji kurs)
      if (data && data.exchange_middle) {
        return new Response(
          JSON.stringify({ 
            rate: data.exchange_middle,
            currency: currency,
            date: date,
            source: 'NBS'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Fallback: try another endpoint format
    const fallbackUrl = `https://kurs.resenje.org/api/v1/rates/${year}-${month}-${day}`;
    console.log(`Trying fallback API: ${fallbackUrl}`);
    
    const fallbackResponse = await fetch(fallbackUrl);
    
    if (fallbackResponse.ok) {
      const responseData = await fallbackResponse.json();
      console.log(`Fallback response structure:`, Object.keys(responseData));
      
      // The API returns { rates: [...] } object
      const rates = responseData.rates || responseData;
      
      if (Array.isArray(rates)) {
        const currencyRate = rates.find((r: { code: string; exchange_middle?: number }) => r.code === currency);
        if (currencyRate && currencyRate.exchange_middle) {
          return new Response(
            JSON.stringify({ 
              rate: currencyRate.exchange_middle,
              currency: currency,
              date: date,
              source: 'NBS'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // If date is in the future or weekend, try latest available
    const latestUrl = `https://kurs.resenje.org/api/v1/currencies/${currency}/rates/latest`;
    console.log(`Trying latest rate: ${latestUrl}`);
    
    const latestResponse = await fetch(latestUrl);
    
    if (latestResponse.ok) {
      const latestData = await latestResponse.json();
      console.log(`Latest response:`, latestData);
      
      if (latestData && latestData.exchange_middle) {
        return new Response(
          JSON.stringify({ 
            rate: latestData.exchange_middle,
            currency: currency,
            date: latestData.date || date,
            source: 'NBS (latest)',
            note: 'Kurs za traženi datum nije dostupan, korišćen je poslednji dostupan kurs'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: 'Could not fetch exchange rate', currency, date }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Error fetching exchange rate:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
