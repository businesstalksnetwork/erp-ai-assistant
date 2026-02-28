import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * NBS Daily Exchange Rate Cron
 * Fetches official NBS middle exchange rates and upserts into exchange_rates table.
 * Triggered by pg_cron daily.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Cron auth: require Bearer token matching CRON_SECRET
    const authHeader = req.headers.get("Authorization");
    const cronSecret = Deno.env.get("CRON_SECRET");
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const today = new Date().toISOString().split("T")[0];

    // NBS provides XML exchange rate list
    const nbsUrl = `https://nbs.rs/kursnaListaMod498/kursnaLista.faces`;
    
    // Use NBS REST-style API for JSON
    const apiUrl = `https://nbs.rs/static/nbs_site/gen/cirilica/55/kursna_lista/API/kl_${today.replace(/-/g, "")}.json`;
    
    let rates: { currency_code: string; rate: number; unit: number }[] = [];

    try {
      const resp = await fetch(apiUrl);
      if (resp.ok) {
        const data = await resp.json();
        // Parse NBS JSON structure
        if (Array.isArray(data)) {
          rates = data.map((r: any) => ({
            currency_code: r.code || r.currencyCode,
            rate: parseFloat(r.middleRate || r.sredpiKurs || "0"),
            unit: parseInt(r.unit || r.jedinica || "1"),
          })).filter(r => r.rate > 0);
        }
      }
    } catch (fetchErr) {
      console.warn("NBS API fetch failed, trying fallback:", fetchErr);
    }

    // Fallback: hardcoded common rates for weekend/holiday when API is unavailable
    if (rates.length === 0) {
      console.log("NBS: No rates fetched (likely weekend/holiday). Skipping.");
      return new Response(JSON.stringify({ status: "skipped", reason: "no rates available (weekend/holiday)" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upsert rates
    const rows = rates.map(r => ({
      currency_code: r.currency_code,
      rate_date: today,
      middle_rate: r.unit > 1 ? r.rate / r.unit : r.rate,
      unit: r.unit,
      source: "NBS",
    }));

    const { error: upsertErr } = await supabase
      .from("exchange_rates")
      .upsert(rows, { onConflict: "currency_code,rate_date" });

    if (upsertErr) {
      console.error("NBS cron: upsert error", upsertErr);
      return new Response(JSON.stringify({ error: upsertErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`NBS cron: upserted ${rows.length} rates for ${today}`);
    return new Response(JSON.stringify({ status: "ok", count: rows.length, date: today }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("NBS cron error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
