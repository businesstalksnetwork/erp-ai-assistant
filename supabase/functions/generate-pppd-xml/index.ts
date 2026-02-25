import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function validateJmbg(jmbg: string): boolean {
  if (!/^\d{13}$/.test(jmbg)) return false;
  const d = jmbg.split("").map(Number);
  const sum = 7*(d[0]+d[6]) + 6*(d[1]+d[7]) + 5*(d[2]+d[8]) + 4*(d[3]+d[9]) + 3*(d[4]+d[10]) + 2*(d[5]+d[11]);
  let ctrl = 11 - (sum % 11);
  if (ctrl > 9) ctrl = 0;
  return ctrl === d[12];
}

function fmtAmt(n: number): string {
  return n.toFixed(2);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { payroll_run_id } = await req.json();
    if (!payroll_run_id) throw new Error("payroll_run_id required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch payroll run
    const { data: run, error: runErr } = await supabase
      .from("payroll_runs")
      .select("*")
      .eq("id", payroll_run_id)
      .single();
    if (runErr || !run) throw new Error("Payroll run not found");

    // Fetch payroll items with employee data
    const { data: items, error: itemsErr } = await supabase
      .from("payroll_items")
      .select("*, employees(full_name, jmbg, first_name, last_name)")
      .eq("payroll_run_id", payroll_run_id)
      .order("created_at");
    if (itemsErr) throw new Error(itemsErr.message);

    // Fetch tenant (employer) data
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name")
      .eq("id", run.tenant_id)
      .single();

    // Fetch legal entity for PIB
    const { data: legalEntity } = await supabase
      .from("legal_entities")
      .select("pib, company_name, mb")
      .eq("tenant_id", run.tenant_id)
      .eq("is_primary", true)
      .maybeSingle();

    const periodLabel = `${run.period_year}-${String(run.period_month).padStart(2, "0")}`;
    const now = new Date().toISOString().split("T")[0];

    // Validate all employees have JMBG
    const warnings: string[] = [];
    for (const item of items || []) {
      const jmbg = item.employees?.jmbg;
      if (!jmbg) {
        warnings.push(`${item.employees?.full_name}: nedostaje JMBG`);
      } else if (!validateJmbg(jmbg)) {
        warnings.push(`${item.employees?.full_name}: nevažeći JMBG ${jmbg}`);
      }
    }

    // Generate XML
    const employerPib = legalEntity?.pib || "000000000";
    const employerName = legalEntity?.company_name || tenant?.name || "N/A";
    const employerMb = legalEntity?.mb || "00000000";

    let xmlItems = "";
    let rBr = 1;
    for (const item of items || []) {
      const jmbg = item.employees?.jmbg || "0000000000000";
      const ovp = item.ovp_code || "101";
      const ola = item.ola_code || "00";
      const ben = item.ben_code || "0";
      const gross = Number(item.gross_salary);
      const tax = Number(item.income_tax);
      const pio = Number(item.pension_contribution);
      const health = Number(item.health_contribution);
      const unemp = Number(item.unemployment_contribution);
      const pioEmployer = Number(item.pension_employer || 0);
      const healthEmployer = Number(item.health_employer || 0);
      const subsidy = Number(item.subsidy_amount || 0);
      const municipal = Number(item.municipal_tax || 0);
      const net = Number(item.net_salary);

      xmlItems += `
      <PodaciOPrimaocuPrihoda>
        <RedniBroj>${rBr++}</RedniBroj>
        <JMBG>${jmbg}</JMBG>
        <ImePrezime>${item.employees?.full_name || ""}</ImePrezime>
        <OznakaVrstePrihoda>${ovp}</OznakaVrstePrihoda>
        <OznakaLicnogAdanja>${ola}</OznakaLicnogAdanja>
        <BeneficiraniRadniStaz>${ben}</BeneficiraniRadniStaz>
        <BrutoZarada>${fmtAmt(gross)}</BrutoZarada>
        <OsnovicaZaPorez>${fmtAmt(gross - Number(item.pension_contribution || 0) - Number(item.health_contribution || 0) - Number(item.unemployment_contribution || 0))}</OsnovicaZaPorez>
        <Porez>${fmtAmt(tax)}</Porez>
        <PIORadnik>${fmtAmt(pio)}</PIORadnik>
        <ZdravstvenoRadnik>${fmtAmt(health)}</ZdravstvenoRadnik>
        <NezaposlenostRadnik>${fmtAmt(unemp)}</NezaposlenostRadnik>
        <PIOPoslodavac>${fmtAmt(pioEmployer)}</PIOPoslodavac>
        <ZdravstvenoPoslodavac>${fmtAmt(healthEmployer)}</ZdravstvenoPoslodavac>
        <NetoZarada>${fmtAmt(net)}</NetoZarada>
        <SubvencijaPorez>${fmtAmt(subsidy > 0 ? subsidy * (tax / (tax + pio + health + unemp + pioEmployer + healthEmployer || 1)) : 0)}</SubvencijaPorez>
        <OpstinskiPrirez>${fmtAmt(municipal)}</OpstinskiPrirez>
      </PodaciOPrimaocuPrihoda>`;
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<PPP-PD xmlns="http://pid.poreskauprava.gov.rs/tax-declaration"
        DatumObracuna="${now}"
        DatumIsplate="${now}"
        ObracunskiPeriod="${periodLabel}">
  <PodaciOIsplatiocu>
    <PIB>${employerPib}</PIB>
    <MaticniBroj>${employerMb}</MaticniBroj>
    <NazivIsplatioca>${employerName}</NazivIsplatioca>
  </PodaciOIsplatiocu>
  <PodaciOPrimaocu>${xmlItems}
  </PodaciOPrimaocu>
  <Ukupno>
    <UkupnoBrutoZarada>${fmtAmt(Number(run.total_gross))}</UkupnoBrutoZarada>
    <UkupnoPorez>${fmtAmt(Number(run.total_taxes))}</UkupnoPorez>
    <UkupnoDoprinosi>${fmtAmt(Number(run.total_contributions))}</UkupnoDoprinosi>
    <UkupnoNeto>${fmtAmt(Number(run.total_net))}</UkupnoNeto>
  </Ukupno>
  ${warnings.length > 0 ? `<!-- UPOZORENJA:\n${warnings.map(w => `    - ${w}`).join("\n")}\n  -->` : ""}
</PPP-PD>`;

    return new Response(xml, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="PPP-PD_${periodLabel}.xml"`,
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
