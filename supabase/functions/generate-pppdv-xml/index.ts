import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PdvEntry {
  popdv_section: string;
  direction: string;
  base_amount: number;
  vat_amount: number;
  tax_rate: number;
}

/**
 * Generate PP-PDV XML for Serbian Tax Administration (ePorezi)
 * Based on official XSD schema for electronic PP-PDV submission
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

    const { tenant_id, pdv_period_id } = await req.json();
    if (!tenant_id || !pdv_period_id) {
      return new Response(JSON.stringify({ error: "Missing tenant_id or pdv_period_id" }), {
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

    // Get PDV period
    const { data: period, error: periodError } = await supabase
      .from("pdv_periods")
      .select("*")
      .eq("id", pdv_period_id)
      .eq("tenant_id", tenant_id)
      .single();

    if (periodError || !period) {
      return new Response(JSON.stringify({ error: "PDV period not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get legal entity info
    const { data: legalEntity } = await supabase
      .from("legal_entities")
      .select("name, pib, mb, address, city, municipality")
      .eq("tenant_id", tenant_id)
      .limit(1)
      .single();

    // Get all PDV entries for this period
    const { data: entries } = await supabase
      .from("pdv_entries")
      .select("popdv_section, direction, base_amount, vat_amount, tax_rate")
      .eq("pdv_period_id", pdv_period_id)
      .eq("tenant_id", tenant_id);

    const pdvEntries: PdvEntry[] = entries || [];

    // Aggregate by POPDV section
    const sectionTotals: Record<string, { base: number; vat: number }> = {};
    for (const entry of pdvEntries) {
      const key = entry.popdv_section || "unknown";
      if (!sectionTotals[key]) sectionTotals[key] = { base: 0, vat: 0 };
      sectionTotals[key].base += Number(entry.base_amount) || 0;
      sectionTotals[key].vat += Number(entry.vat_amount) || 0;
    }

    // Calculate totals
    const outputVat = pdvEntries
      .filter(e => e.direction === "output")
      .reduce((sum, e) => sum + (Number(e.vat_amount) || 0), 0);

    const inputVat = pdvEntries
      .filter(e => e.direction === "input")
      .reduce((sum, e) => sum + (Number(e.vat_amount) || 0), 0);

    const outputBase = pdvEntries
      .filter(e => e.direction === "output")
      .reduce((sum, e) => sum + (Number(e.base_amount) || 0), 0);

    const inputBase = pdvEntries
      .filter(e => e.direction === "input")
      .reduce((sum, e) => sum + (Number(e.base_amount) || 0), 0);

    const netVat = outputVat - inputVat;

    // Extract period info
    const periodYear = new Date(period.start_date).getFullYear();
    const periodMonth = new Date(period.start_date).getMonth() + 1;

    const pib = legalEntity?.pib || "000000000";
    const mb = legalEntity?.mb || "00000000";
    const companyName = legalEntity?.name || "N/A";
    const address = legalEntity?.address || "";
    const city = legalEntity?.city || "";
    const municipality = legalEntity?.municipality || "";

    // Generate PP-PDV XML per Serbian ePorezi XSD
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<PoreskaDeklaracija xmlns="http://pid.poreskauprava.gov.rs/pppdv"
                     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <ZaglavljeDeklaracije>
    <VrstaPrijave>1</VrstaPrijave>
    <PeriodOd>${period.start_date}</PeriodOd>
    <PeriodDo>${period.end_date}</PeriodDo>
    <GodinaPerioda>${periodYear}</GodinaPerioda>
    <MesecPerioda>${String(periodMonth).padStart(2, "0")}</MesecPerioda>
    <DatumPodnosenja>${new Date().toISOString().split("T")[0]}</DatumPodnosenja>
  </ZaglavljeDeklaracije>
  
  <PodaciOObvezniku>
    <PIB>${escapeXml(pib)}</PIB>
    <MB>${escapeXml(mb)}</MB>
    <NazivObveznika>${escapeXml(companyName)}</NazivObveznika>
    <Adresa>${escapeXml(address)}</Adresa>
    <Opstina>${escapeXml(municipality)}</Opstina>
    <Mesto>${escapeXml(city)}</Mesto>
  </PodaciOObvezniku>

  <POPDV>
    <!-- Deo 2: Promet dobara i usluga po opštoj stopi (20%) -->
    <Deo2>
      <Red21>
        <Osnovica>${fmt(sectionTotals["2.1"]?.base || 0)}</Osnovica>
        <PDV>${fmt(sectionTotals["2.1"]?.vat || 0)}</PDV>
      </Red21>
    </Deo2>
    
    <!-- Deo 3: Promet po posebnoj stopi (10%) -->
    <Deo3>
      <Red31>
        <Osnovica>${fmt(sectionTotals["3"]?.base || sectionTotals["3.1"]?.base || 0)}</Osnovica>
        <PDV>${fmt(sectionTotals["3"]?.vat || sectionTotals["3.1"]?.vat || 0)}</PDV>
      </Red31>
    </Deo3>
    
    <!-- Deo 3a: Promet za koji je primalac poreski dužnik -->
    <Deo3a>
      <Red3a1>
        <Osnovica>${fmt(sectionTotals["3a"]?.base || 0)}</Osnovica>
        <PDV>${fmt(sectionTotals["3a"]?.vat || 0)}</PDV>
      </Red3a1>
    </Deo3a>
    
    <!-- Deo 4: Slobodan od PDV-a sa pravom na odbitak -->
    <Deo4>
      <Red41>
        <Osnovica>${fmt(sectionTotals["4"]?.base || 0)}</Osnovica>
      </Red41>
    </Deo4>
    
    <!-- Deo 5: Slobodan od PDV-a bez prava na odbitak -->
    <Deo5>
      <Red51>
        <Osnovica>${fmt(sectionTotals["5"]?.base || 0)}</Osnovica>
      </Red51>
    </Deo5>
    
    <!-- Deo 6: Uvoz dobara -->
    <Deo6>
      <Red61>
        <Osnovica>${fmt(sectionTotals["6"]?.base || 0)}</Osnovica>
        <PDV>${fmt(sectionTotals["6"]?.vat || 0)}</PDV>
      </Red61>
    </Deo6>

    <!-- Deo 8a: Prethodni porez - opšta stopa -->
    <Deo8a>
      <Red8a1>
        <Osnovica>${fmt(sectionTotals["8a"]?.base || 0)}</Osnovica>
        <PDV>${fmt(sectionTotals["8a"]?.vat || 0)}</PDV>
      </Red8a1>
    </Deo8a>
    
    <!-- Deo 8b: Prethodni porez - posebna stopa -->
    <Deo8b>
      <Red8b1>
        <Osnovica>${fmt(sectionTotals["8b"]?.base || 0)}</Osnovica>
        <PDV>${fmt(sectionTotals["8b"]?.vat || 0)}</PDV>
      </Red8b1>
    </Deo8b>
    
    <!-- Deo 8v: Prethodni porez pri uvozu -->
    <Deo8v>
      <Red8v1>
        <Osnovica>${fmt(sectionTotals["8v"]?.base || sectionTotals["8V"]?.base || 0)}</Osnovica>
        <PDV>${fmt(sectionTotals["8v"]?.vat || sectionTotals["8V"]?.vat || 0)}</PDV>
      </Red8v1>
    </Deo8v>
    
    <!-- Deo 9: Ispravke odbitka prethodnog poreza -->
    <Deo9>
      <Red91>
        <PDV>${fmt(sectionTotals["9"]?.vat || 0)}</PDV>
      </Red91>
    </Deo9>
    
    <!-- Deo 10: Refakcija stranom obvezniku -->
    <Deo10>
      <Red101>
        <PDV>${fmt(sectionTotals["10"]?.vat || 0)}</PDV>
      </Red101>
    </Deo10>
    
    <!-- Deo 11: Refundacija PDV-a diplomatskim misijama -->
    <Deo11>
      <Red111>
        <PDV>${fmt(sectionTotals["11"]?.vat || 0)}</PDV>
      </Red111>
    </Deo11>
  </POPDV>
  
  <ObracunPDV>
    <UkupanIzlazniPDV>${fmt(outputVat)}</UkupanIzlazniPDV>
    <UkupanUlazniPDV>${fmt(inputVat)}</UkupanUlazniPDV>
    <OsnovicaIzlazni>${fmt(outputBase)}</OsnovicaIzlazni>
    <OsnovicaUlazni>${fmt(inputBase)}</OsnovicaUlazni>
    <PoresekaObaveza>${netVat >= 0 ? fmt(netVat) : "0.00"}</PoresekaObaveza>
    <PretplataPDV>${netVat < 0 ? fmt(Math.abs(netVat)) : "0.00"}</PretplataPDV>
  </ObracunPDV>
</PoreskaDeklaracija>`;

    return new Response(JSON.stringify({ xml, filename: `PP-PDV_${periodYear}_${String(periodMonth).padStart(2, "0")}.xml` }), {
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
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function fmt(n: number): string {
  return n.toFixed(2);
}
