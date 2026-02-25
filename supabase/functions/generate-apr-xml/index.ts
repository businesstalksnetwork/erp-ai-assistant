import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Generate APR-format XML for Bilans Stanja and Bilans Uspeha
 * Per APR Pravilnik o sadržini i formi obrazaca finansijskih izveštaja
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { tenant_id, report_type, fiscal_year, legal_entity_id } = await req.json();
    
    if (!tenant_id || !report_type || !fiscal_year) {
      return new Response(JSON.stringify({ error: "Missing required fields: tenant_id, report_type, fiscal_year" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify tenant membership
    const { data: membership } = await supabase
      .from("tenant_users")
      .select("id")
      .eq("tenant_id", tenant_id)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get legal entity
    const leQuery = supabase.from("legal_entities").select("*").eq("tenant_id", tenant_id);
    if (legal_entity_id) leQuery.eq("id", legal_entity_id);
    const { data: legalEntity } = await leQuery.limit(1).single();

    const pib = legalEntity?.pib || "";
    const mb = legalEntity?.mb || "";
    const companyName = legalEntity?.name || "";

    const dateFrom = `${fiscal_year}-01-01`;
    const dateTo = `${fiscal_year}-12-31`;
    const prevDateFrom = `${fiscal_year - 1}-01-01`;
    const prevDateTo = `${fiscal_year - 1}-12-31`;

    let xml = "";
    let filename = "";

    if (report_type === "bilans_stanja") {
      // Get balance sheet data via RPC
      const { data: currentData } = await supabase.rpc("get_bilans_stanja" as any, {
        p_tenant_id: tenant_id,
        p_as_of_date: dateTo,
        p_legal_entity_id: legal_entity_id || null,
      });

      const { data: prevData } = await supabase.rpc("get_bilans_stanja" as any, {
        p_tenant_id: tenant_id,
        p_as_of_date: prevDateTo,
        p_legal_entity_id: legal_entity_id || null,
      });

      xml = generateBilansStanjaXml(
        pib, mb, companyName, fiscal_year,
        (currentData || []) as any[],
        (prevData || []) as any[]
      );
      filename = `Bilans_Stanja_${fiscal_year}_${pib}.xml`;

    } else if (report_type === "bilans_uspeha") {
      const { data: currentData } = await supabase.rpc("get_bilans_uspeha" as any, {
        p_tenant_id: tenant_id,
        p_date_from: dateFrom,
        p_date_to: dateTo,
        p_legal_entity_id: legal_entity_id || null,
      });

      const { data: prevData } = await supabase.rpc("get_bilans_uspeha" as any, {
        p_tenant_id: tenant_id,
        p_date_from: prevDateFrom,
        p_date_to: prevDateTo,
        p_legal_entity_id: legal_entity_id || null,
      });

      xml = generateBilansUspehaXml(
        pib, mb, companyName, fiscal_year,
        (currentData || []) as any[],
        (prevData || []) as any[]
      );
      filename = `Bilans_Uspeha_${fiscal_year}_${pib}.xml`;
    } else {
      return new Response(JSON.stringify({ error: "Invalid report_type. Use 'bilans_stanja' or 'bilans_uspeha'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ xml, filename }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function escapeXml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function fmt(n: number): string {
  return Math.round(n).toString();
}

// Map account classes to APR AOP positions for Bilans Stanja
const BILANS_STANJA_AOP: Record<string, number> = {
  "0": 1,  // Stalna imovina
  "01": 2, // Nematerijalna imovina  
  "02": 3, // Nekretnine, postrojenja i oprema
  "03": 4, // Biološka sredstva
  "04": 5, // Dugoročni finansijski plasmani
  "1": 6,  // Obrtna imovina
  "10": 7, // Zalihe
  "12": 8, // Stalna sredstva namenjena prodaji
  "13": 9, // Kratkoročna potraživanja
  "14": 10, // Kratkoročni finansijski plasmani
  "15": 11, // Gotovinski ekvivalenti
  "18": 12, // PDV i AVR
  "2": 13, // Kratkoročne obaveze
  "20": 14, // Kratkoročne finansijske obaveze
  "21": 15, // Obaveze iz poslovanja
  "22": 16, // Ostale kratkoročne obaveze
  "27": 17, // PDV i PVR
  "28": 18, // Obaveze po osnovu PDV-a
  "29": 19, // PVR
  "3": 20, // Kapital
  "30": 21, // Osnovni kapital
  "31": 22, // Neuplaćeni upisani kapital
  "32": 23, // Rezerve
  "33": 24, // Revalorizacione rezerve
  "34": 25, // Neraspoređena dobit
  "35": 26, // Gubitak
  "4": 27, // Dugoročna rezervisanja i obaveze
  "40": 28, // Dugoročna rezervisanja
  "41": 29, // Dugoročne obaveze
  "43": 30, // Dugoročni krediti
  "45": 31, // Ostale dugoročne obaveze
};

function generateBilansStanjaXml(
  pib: string, mb: string, name: string, year: number,
  currentLines: any[], prevLines: any[]
): string {
  const currentMap = buildAccountMap(currentLines);
  const prevMap = buildAccountMap(prevLines);

  let positions = "";
  for (const [code, aop] of Object.entries(BILANS_STANJA_AOP)) {
    const current = currentMap[code] || 0;
    const prev = prevMap[code] || 0;
    positions += `
    <Pozicija>
      <AOP>${aop}</AOP>
      <TekucaGodina>${fmt(current)}</TekucaGodina>
      <PrethodnaGodina>${fmt(prev)}</PrethodnaGodina>
    </Pozicija>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<FinansijskiIzvestaj xmlns="http://www.apr.gov.rs/fi" vrsta="BS">
  <Zaglavlje>
    <PIB>${escapeXml(pib)}</PIB>
    <MaticniBroj>${escapeXml(mb)}</MaticniBroj>
    <NazivPravnogLica>${escapeXml(name)}</NazivPravnogLica>
    <GodinaIzvestaja>${year}</GodinaIzvestaja>
    <VrstaIzvestaja>Bilans stanja</VrstaIzvestaja>
    <DatumSastavljanja>${new Date().toISOString().split("T")[0]}</DatumSastavljanja>
  </Zaglavlje>
  <BilansStanja>${positions}
  </BilansStanja>
</FinansijskiIzvestaj>`;
}

function generateBilansUspehaXml(
  pib: string, mb: string, name: string, year: number,
  currentLines: any[], prevLines: any[]
): string {
  const currentMap = buildAccountMap(currentLines);
  const prevMap = buildAccountMap(prevLines);

  // AOP positions for Bilans Uspeha
  const BU_AOP: Record<string, number> = {
    "60": 201, // Prihodi od prodaje
    "61": 202, // Prihodi od aktiviranja učinaka
    "62": 203, // Povećanje vrednosti zaliha
    "63": 204, // Smanjenje vrednosti zaliha
    "64": 205, // Ostali poslovni prihodi
    "50": 206, // Nabavna vrednost prodate robe
    "51": 207, // Troškovi materijala
    "52": 208, // Troškovi zarada
    "53": 209, // Troškovi amortizacije
    "54": 210, // Ostali poslovni rashodi
    "55": 211, // Troškovi proizvodnih usluga
    "56": 212, // Nematerijalni troškovi
    "66": 213, // Finansijski prihodi
    "67": 214, // Ostali prihodi
    "57": 215, // Finansijski rashodi
    "58": 216, // Ostali rashodi
    "72": 217, // Porez na dobit
  };

  let positions = "";
  for (const [code, aop] of Object.entries(BU_AOP)) {
    const current = currentMap[code] || 0;
    const prev = prevMap[code] || 0;
    positions += `
    <Pozicija>
      <AOP>${aop}</AOP>
      <TekucaGodina>${fmt(current)}</TekucaGodina>
      <PrethodnaGodina>${fmt(prev)}</PrethodnaGodina>
    </Pozicija>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<FinansijskiIzvestaj xmlns="http://www.apr.gov.rs/fi" vrsta="BU">
  <Zaglavlje>
    <PIB>${escapeXml(pib)}</PIB>
    <MaticniBroj>${escapeXml(mb)}</MaticniBroj>
    <NazivPravnogLica>${escapeXml(name)}</NazivPravnogLica>
    <GodinaIzvestaja>${year}</GodinaIzvestaja>
    <VrstaIzvestaja>Bilans uspeha</VrstaIzvestaja>
    <DatumSastavljanja>${new Date().toISOString().split("T")[0]}</DatumSastavljanja>
  </Zaglavlje>
  <BilansUspeha>${positions}
  </BilansUspeha>
</FinansijskiIzvestaj>`;
}

function buildAccountMap(lines: any[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const line of lines) {
    const code = line.code || line.account_code || "";
    const amount = Number(line.balance || line.amount || 0);
    // Group by first 2 digits and first 1 digit
    if (code.length >= 2) {
      const prefix2 = code.substring(0, 2);
      map[prefix2] = (map[prefix2] || 0) + amount;
    }
    if (code.length >= 1) {
      const prefix1 = code.substring(0, 1);
      map[prefix1] = (map[prefix1] || 0) + amount;
    }
  }
  return map;
}
