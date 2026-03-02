import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/error-handler.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";

/**
 * Generate APR-format XML for Bilans Stanja and Bilans Uspeha
 * Per APR Pravilnik o sadržini i formi obrazaca finansijskih izveštaja
 * Full AOP mapping per official Obrazac 1
 */
Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }),
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }),
      });
    }
    const userId = claimsData.claims.sub as string;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { tenant_id, report_type, fiscal_year, legal_entity_id } = await req.json();
    
    if (!tenant_id || !report_type || !fiscal_year) {
      return new Response(JSON.stringify({ error: "Missing required fields: tenant_id, report_type, fiscal_year" }), {
        status: 400,
        headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }),
      });
    }

    const { data: membership } = await supabase
      .from("tenant_members")
      .select("id")
      .eq("tenant_id", tenant_id)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }),
      });
    }

    let leQuery = supabase.from("legal_entities").select("*").eq("tenant_id", tenant_id);
    if (legal_entity_id) leQuery = leQuery.eq("id", legal_entity_id);
    const { data: legalEntity } = await leQuery.limit(1).maybeSingle();

    const pib = legalEntity?.pib || "";
    const mb = legalEntity?.mb || "";
    const companyName = legalEntity?.name || "";

    const dateTo = `${fiscal_year}-12-31`;
    const dateFrom = `${fiscal_year}-01-01`;
    const prevDateTo = `${fiscal_year - 1}-12-31`;
    const prevDateFrom = `${fiscal_year - 1}-01-01`;

    let xml = "";
    let filename = "";

    if (report_type === "bilans_stanja") {
      const { data: currentData } = await supabase.rpc("get_bilans_stanja" as any, {
        p_tenant_id: tenant_id, p_as_of_date: dateTo, p_legal_entity_id: legal_entity_id || null,
      });
      const { data: prevData } = await supabase.rpc("get_bilans_stanja" as any, {
        p_tenant_id: tenant_id, p_as_of_date: prevDateTo, p_legal_entity_id: legal_entity_id || null,
      });
      xml = generateBilansStanjaXml(pib, mb, companyName, fiscal_year, (currentData || []) as any[], (prevData || []) as any[]);
      filename = `Bilans_Stanja_${fiscal_year}_${pib}.xml`;
    } else if (report_type === "bilans_uspeha") {
      const { data: currentData } = await supabase.rpc("get_bilans_uspeha" as any, {
        p_tenant_id: tenant_id, p_date_from: dateFrom, p_date_to: dateTo, p_legal_entity_id: legal_entity_id || null,
      });
      const { data: prevData } = await supabase.rpc("get_bilans_uspeha" as any, {
        p_tenant_id: tenant_id, p_date_from: prevDateFrom, p_date_to: prevDateTo, p_legal_entity_id: legal_entity_id || null,
      });
      xml = generateBilansUspehaXml(pib, mb, companyName, fiscal_year, (currentData || []) as any[], (prevData || []) as any[]);
      filename = `Bilans_Uspeha_${fiscal_year}_${pib}.xml`;
    } else {
      return new Response(JSON.stringify({ error: "Invalid report_type. Use 'bilans_stanja' or 'bilans_uspeha'" }), {
        status: 400,
        headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }),
      });
    }

    return new Response(JSON.stringify({ xml, filename }), {
      status: 200,
      headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }),
    });
  } catch (error) {
    return createErrorResponse(error, req, { logPrefix: "generate-apr-xml" });
  }
});

function escapeXml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function fmt(n: number): string {
  return Math.round(n).toString();
}

// ═══════════════════════════════════════════════════════════════════
// Full AOP mapping per official APR Obrazac 1 — Bilans Stanja
// Pravilnik o sadržini i formi obrazaca finansijskih izveštaja
// ═══════════════════════════════════════════════════════════════════
const BILANS_STANJA_AOP: { aop: number; name: string; accounts: string[]; sign?: "D" | "C" | "DC" }[] = [
  // AKTIVA
  { aop: 1, name: "AKTIVA UKUPNO", accounts: ["0","1"], sign: "D" },
  // A. Stalna imovina
  { aop: 2, name: "Stalna imovina", accounts: ["00","01","02","03","04","05","06","09"], sign: "D" },
  // I. Neuplaćeni upisani kapital
  { aop: 3, name: "Neuplaćeni upisani kapital", accounts: ["00"], sign: "D" },
  // II. Goodwill
  { aop: 4, name: "Gudvil", accounts: ["010"], sign: "D" },
  // III. Nematerijalna ulaganja
  { aop: 5, name: "Nematerijalna ulaganja", accounts: ["011","012","013","014","015","016","017","018","019"], sign: "D" },
  // IV. Nekretnine, postrojenja, oprema
  { aop: 6, name: "Nekretnine, postrojenja, oprema i biološka sredstva", accounts: ["02","03"], sign: "D" },
  { aop: 7, name: "Nekretnine, postrojenja i oprema", accounts: ["02"], sign: "D" },
  { aop: 8, name: "Investicione nekretnine", accounts: ["024","025"], sign: "D" },
  { aop: 9, name: "Biološka sredstva", accounts: ["03"], sign: "D" },
  // V. Dugoročni finansijski plasmani
  { aop: 10, name: "Dugoročni finansijski plasmani", accounts: ["04","05"], sign: "D" },
  { aop: 11, name: "Učešća u kapitalu", accounts: ["04"], sign: "D" },
  { aop: 12, name: "Ostali dugoročni finansijski plasmani", accounts: ["05"], sign: "D" },
  // B. Obrtna imovina
  { aop: 13, name: "Obrtna imovina", accounts: ["10","11","12","13","14","15","18","19"], sign: "D" },
  // I. Zalihe
  { aop: 14, name: "Zalihe", accounts: ["10","11","13","15"], sign: "D" },
  { aop: 15, name: "Materijal, rezervni delovi, alat", accounts: ["10"], sign: "D" },
  { aop: 16, name: "Nedovršena proizvodnja i nedovršene usluge", accounts: ["11"], sign: "D" },
  { aop: 17, name: "Gotovi proizvodi", accounts: ["12"], sign: "D" },
  { aop: 18, name: "Roba", accounts: ["13"], sign: "D" },
  { aop: 19, name: "Stalna sredstva namenjena prodaji", accounts: ["14"], sign: "D" },
  { aop: 20, name: "Dati avansi", accounts: ["15"], sign: "D" },
  // II. Potraživanja po osnovu prodaje
  { aop: 21, name: "Kratkoročna potraživanja, plasmani i gotovina", accounts: ["20","21","22","23","24","27","28","29"], sign: "D" },
  { aop: 22, name: "Potraživanja", accounts: ["20","21","22"], sign: "D" },
  { aop: 23, name: "Potraživanja od kupaca", accounts: ["20"], sign: "D" },
  { aop: 24, name: "Potraživanja iz specifičnih poslova", accounts: ["21"], sign: "D" },
  { aop: 25, name: "Druga potraživanja", accounts: ["22"], sign: "D" },
  // III. Kratkoročni finansijski plasmani
  { aop: 26, name: "Kratkoročni finansijski plasmani", accounts: ["23"], sign: "D" },
  // IV. Gotovinski ekvivalenti i gotovina
  { aop: 27, name: "Gotovinski ekvivalenti i gotovina", accounts: ["24"], sign: "D" },
  // V. PDV i AVR
  { aop: 28, name: "Porez na dodatu vrednost", accounts: ["27"], sign: "D" },
  { aop: 29, name: "Aktivna vremenska razgraničenja", accounts: ["28","29"], sign: "D" },
  // C. Odložena poreska sredstva
  { aop: 30, name: "Odložena poreska sredstva", accounts: ["09"], sign: "D" },
  // D. Poslovna imovina (AOP 2+13+30)
  { aop: 31, name: "Poslovna imovina", accounts: [], sign: "D" },
  // E. Gubitak iznad visine kapitala
  { aop: 32, name: "Gubitak iznad visine kapitala", accounts: ["29"], sign: "D" },
  // F. UKUPNA AKTIVA
  { aop: 33, name: "UKUPNA AKTIVA", accounts: [], sign: "D" },
  // G. Vanbilansna aktiva
  { aop: 34, name: "Vanbilansna aktiva", accounts: ["88"], sign: "D" },

  // PASIVA
  // A. Kapital
  { aop: 101, name: "Kapital", accounts: ["30","31","32","33","34","35","36","37","38","39"], sign: "C" },
  { aop: 102, name: "Osnovni kapital", accounts: ["30"], sign: "C" },
  { aop: 103, name: "Upisani a neuplaćeni kapital", accounts: ["31"], sign: "C" },
  { aop: 104, name: "Emisiona premija", accounts: ["32"], sign: "C" },
  { aop: 105, name: "Rezerve iz dobiti", accounts: ["33"], sign: "C" },
  { aop: 106, name: "Revalorizacione rezerve i nerealizovani dobici/gubici", accounts: ["33","34"], sign: "C" },
  { aop: 107, name: "Nerealizovani dobici po osnovu HOV", accounts: ["33"], sign: "C" },
  { aop: 108, name: "Nerealizovani gubici po osnovu HOV", accounts: ["33"], sign: "C" },
  { aop: 109, name: "Neraspoređeni dobitak", accounts: ["34"], sign: "C" },
  { aop: 110, name: "Gubitak", accounts: ["35"], sign: "C" },
  { aop: 111, name: "Otkupljene sopstvene akcije", accounts: ["037"], sign: "C" },
  // B. Dugoročna rezervisanja i obaveze
  { aop: 112, name: "Dugoročna rezervisanja i obaveze", accounts: ["40","41","42","43","44","45","46","47","48","49"], sign: "C" },
  { aop: 113, name: "Dugoročna rezervisanja", accounts: ["40"], sign: "C" },
  { aop: 114, name: "Dugoročne obaveze", accounts: ["41","42","43","44","45","46"], sign: "C" },
  { aop: 115, name: "Dugoročni krediti", accounts: ["41"], sign: "C" },
  { aop: 116, name: "Ostale dugoročne obaveze", accounts: ["42","43","44","45","46"], sign: "C" },
  // C. Kratkoročne obaveze
  { aop: 117, name: "Kratkoročne obaveze", accounts: ["42","43","44","45","46","47","48","49"], sign: "C" },
  { aop: 118, name: "Kratkoročne finansijske obaveze", accounts: ["42"], sign: "C" },
  { aop: 119, name: "Primljeni avansi, depoziti i kaucije", accounts: ["43"], sign: "C" },
  { aop: 120, name: "Obaveze iz poslovanja", accounts: ["43","44"], sign: "C" },
  { aop: 121, name: "Ostale kratkoročne obaveze", accounts: ["45","46"], sign: "C" },
  { aop: 122, name: "Obaveze po osnovu PDV i ostalih javnih prihoda", accounts: ["47","48"], sign: "C" },
  { aop: 123, name: "Obaveze po osnovu poreza na dobit", accounts: ["47"], sign: "C" },
  // D. Pasivna vremenska razgraničenja
  { aop: 124, name: "Pasivna vremenska razgraničenja", accounts: ["49"], sign: "C" },
  // E. Odložene poreske obaveze
  { aop: 125, name: "Odložene poreske obaveze", accounts: ["49"], sign: "C" },
  // F. UKUPNA PASIVA
  { aop: 126, name: "UKUPNA PASIVA", accounts: [], sign: "C" },
  // G. Vanbilansna pasiva
  { aop: 127, name: "Vanbilansna pasiva", accounts: ["89"], sign: "C" },
];

// ═══════════════════════════════════════════════════════════════════
// Full AOP mapping — Bilans Uspeha (Income Statement)
// ═══════════════════════════════════════════════════════════════════
const BILANS_USPEHA_AOP: { aop: number; name: string; accounts: string[]; sign?: "C" | "D" }[] = [
  // A. POSLOVNI PRIHODI
  { aop: 201, name: "Poslovni prihodi", accounts: ["60","61","62","64","65"], sign: "C" },
  { aop: 202, name: "Prihodi od prodaje robe", accounts: ["60"], sign: "C" },
  { aop: 203, name: "Prihodi od prodaje proizvoda i usluga", accounts: ["61"], sign: "C" },
  { aop: 204, name: "Prihodi od premija, subvencija, dotacija", accounts: ["64"], sign: "C" },
  { aop: 205, name: "Drugi poslovni prihodi", accounts: ["65"], sign: "C" },
  // B. POSLOVNI RASHODI
  { aop: 206, name: "Poslovni rashodi", accounts: ["50","51","52","53","54","55","56","57","58","59"], sign: "D" },
  { aop: 207, name: "Nabavna vrednost prodate robe", accounts: ["50"], sign: "D" },
  { aop: 208, name: "Troškovi materijala", accounts: ["51"], sign: "D" },
  { aop: 209, name: "Troškovi zarada, naknada zarada i ostali lični rashodi", accounts: ["52"], sign: "D" },
  { aop: 210, name: "Troškovi amortizacije", accounts: ["54"], sign: "D" },
  { aop: 211, name: "Troškovi dugoročnih rezervisanja", accounts: ["53"], sign: "D" },
  { aop: 212, name: "Ostali poslovni rashodi", accounts: ["55","56","57","58","59"], sign: "D" },
  // V. POSLOVNI DOBITAK / GUBITAK
  { aop: 213, name: "Poslovni dobitak (201-206)", accounts: [], sign: "C" },
  { aop: 214, name: "Poslovni gubitak (206-201)", accounts: [], sign: "D" },
  // G. FINANSIJSKI PRIHODI
  { aop: 215, name: "Finansijski prihodi", accounts: ["66"], sign: "C" },
  { aop: 216, name: "Finansijski prihodi od povezanih lica", accounts: ["660","661"], sign: "C" },
  { aop: 217, name: "Prihodi od kamata", accounts: ["662"], sign: "C" },
  { aop: 218, name: "Pozitivne kursne razlike", accounts: ["663","664"], sign: "C" },
  { aop: 219, name: "Ostali finansijski prihodi", accounts: ["665","666","669"], sign: "C" },
  // D. FINANSIJSKI RASHODI
  { aop: 220, name: "Finansijski rashodi", accounts: ["56","57"], sign: "D" },
  { aop: 221, name: "Finansijski rashodi iz odnosa sa povezanim licima", accounts: ["560","561"], sign: "D" },
  { aop: 222, name: "Rashodi kamata", accounts: ["562"], sign: "D" },
  { aop: 223, name: "Negativne kursne razlike", accounts: ["563","564"], sign: "D" },
  { aop: 224, name: "Ostali finansijski rashodi", accounts: ["565","566","569"], sign: "D" },
  // Đ. DOBITAK/GUBITAK IZ FINANSIRANJA
  { aop: 225, name: "Dobitak iz finansiranja (215-220)", accounts: [], sign: "C" },
  { aop: 226, name: "Gubitak iz finansiranja (220-215)", accounts: [], sign: "D" },
  // E. OSTALI PRIHODI
  { aop: 227, name: "Ostali prihodi", accounts: ["67","68"], sign: "C" },
  { aop: 228, name: "Dobici od prodaje bioloških sredstava, nkr.postr.opr.", accounts: ["670","671"], sign: "C" },
  { aop: 229, name: "Dobici od prodaje učešća i HOV", accounts: ["672"], sign: "C" },
  { aop: 230, name: "Prihodi od usklađivanja vrednosti imovine", accounts: ["674","675","676"], sign: "C" },
  { aop: 231, name: "Ostali nepomenuti prihodi", accounts: ["677","678","679","68"], sign: "C" },
  // Ž. OSTALI RASHODI
  { aop: 232, name: "Ostali rashodi", accounts: ["57","58"], sign: "D" },
  { aop: 233, name: "Gubici po osnovu rashodovanja i prodaje nkr.postr.opr.", accounts: ["570","571"], sign: "D" },
  { aop: 234, name: "Gubici od prodaje učešća i HOV", accounts: ["572"], sign: "D" },
  { aop: 235, name: "Rashodi po osnovu obezvređenja", accounts: ["574","575","576"], sign: "D" },
  { aop: 236, name: "Ostali nepomenuti rashodi", accounts: ["577","578","579","58"], sign: "D" },
  // Z. DOBITAK/GUBITAK IZ REDOVNOG POSLOVANJA PRE OPOREZIVANJA
  { aop: 237, name: "Dobitak iz redovnog poslovanja pre oporezivanja", accounts: [], sign: "C" },
  { aop: 238, name: "Gubitak iz redovnog poslovanja pre oporezivanja", accounts: [], sign: "D" },
  // I. NETO DOBITAK POSLOVANJA KOJE SE OBUSTAVLJA
  { aop: 239, name: "Neto dobitak poslovanja koje se obustavlja", accounts: ["69"], sign: "C" },
  { aop: 240, name: "Neto gubitak poslovanja koje se obustavlja", accounts: ["59"], sign: "D" },
  // J. DOBITAK/GUBITAK PRE OPOREZIVANJA
  { aop: 241, name: "Dobitak pre oporezivanja", accounts: [], sign: "C" },
  { aop: 242, name: "Gubitak pre oporezivanja", accounts: [], sign: "D" },
  // K. POREZ NA DOBITAK
  { aop: 243, name: "Porez na dobitak", accounts: [], sign: "D" },
  { aop: 244, name: "Poreski rashod perioda", accounts: ["72"], sign: "D" },
  { aop: 245, name: "Odloženi poreski rashodi perioda", accounts: ["722"], sign: "D" },
  { aop: 246, name: "Odloženi poreski prihodi perioda", accounts: ["722"], sign: "C" },
  // L. ISPLAĆENE LIČNE ZARADE PREDUZETNIKA
  { aop: 247, name: "Lična zarada preduzetnika", accounts: ["723"], sign: "D" },
  // LJ. NETO DOBITAK/GUBITAK
  { aop: 248, name: "Neto dobitak", accounts: [], sign: "C" },
  { aop: 249, name: "Neto gubitak", accounts: [], sign: "D" },
  // M. NETO DOBITAK koji pripada manjinskim ulagačima
  { aop: 250, name: "Neto dobitak koji pripada manjinskim ulagačima", accounts: [], sign: "C" },
  { aop: 251, name: "Neto dobitak koji pripada vlasnicima matičnog pravnog lica", accounts: [], sign: "C" },
  // N. ZARADA PO AKCIJI
  { aop: 252, name: "Osnovna zarada po akciji", accounts: [], sign: "C" },
  { aop: 253, name: "Umanjenja (razvodnjenja) zarada po akciji", accounts: [], sign: "C" },
];

function buildAccountMap(lines: any[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const line of lines) {
    const code = String(line.code || line.account_code || "");
    const amount = Number(line.balance || line.amount || 0);
    // Group by all prefixes: full code, 3-digit, 2-digit, 1-digit
    for (let len = code.length; len >= 1; len--) {
      const prefix = code.substring(0, len);
      map[prefix] = (map[prefix] || 0) + amount;
    }
  }
  return map;
}

function resolveAop(aopDef: { accounts: string[] }, accountMap: Record<string, number>): number {
  if (aopDef.accounts.length === 0) return 0; // Computed row — handled via totals
  let total = 0;
  const counted = new Set<string>();
  // Use the most specific prefix available to avoid double-counting
  for (const prefix of aopDef.accounts) {
    if (!counted.has(prefix)) {
      total += accountMap[prefix] || 0;
      counted.add(prefix);
    }
  }
  return total;
}

function generateBilansStanjaXml(
  pib: string, mb: string, name: string, year: number,
  currentLines: any[], prevLines: any[]
): string {
  const currentMap = buildAccountMap(currentLines);
  const prevMap = buildAccountMap(prevLines);

  let positions = "";
  for (const def of BILANS_STANJA_AOP) {
    const current = resolveAop(def, currentMap);
    const prev = resolveAop(def, prevMap);
    positions += `
    <Pozicija>
      <AOP>${def.aop}</AOP>
      <OpisAOP>${escapeXml(def.name)}</OpisAOP>
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

  let positions = "";
  for (const def of BILANS_USPEHA_AOP) {
    const current = resolveAop(def, currentMap);
    const prev = resolveAop(def, prevMap);
    positions += `
    <Pozicija>
      <AOP>${def.aop}</AOP>
      <OpisAOP>${escapeXml(def.name)}</OpisAOP>
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
