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

/** Serbian municipality code from JMBG (digits 7-8: region) */
function municipalityFromJmbg(jmbg: string): string {
  if (jmbg.length < 9) return "00";
  return jmbg.substring(7, 9);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── P1-01: Authentication ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authErr || !authUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { payroll_run_id, tenant_id } = await req.json();
    if (!payroll_run_id) throw new Error("payroll_run_id required");

    // ── P1-01: Tenant membership verification ──
    const effectiveTenantId = tenant_id;
    if (effectiveTenantId) {
      const { data: memberChk } = await supabase
        .from("tenant_members").select("id")
        .eq("user_id", authUser.id).eq("tenant_id", effectiveTenantId).eq("status", "active").maybeSingle();
      const { data: saChk } = await supabase
        .from("user_roles").select("id")
        .eq("user_id", authUser.id).eq("role", "super_admin").maybeSingle();
      if (!memberChk && !saChk) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

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
      .select("*, employees(full_name, jmbg, first_name, last_name, residence_municipality_code)")
      .eq("payroll_run_id", payroll_run_id)
      .order("created_at");
    if (itemsErr) throw new Error(itemsErr.message);

    // Fetch tenant / legal entity
    const { data: legalEntity } = await supabase
      .from("legal_entities")
      .select("pib, company_name, mb, address, municipality_code, email")
      .eq("tenant_id", run.tenant_id)
      .eq("is_primary", true)
      .maybeSingle();

    const periodLabel = `${run.period_year}-${String(run.period_month).padStart(2, "0")}`;
    const now = new Date().toISOString().split("T")[0];
    const paymentDate = run.payment_date || now;
    const employerPib = legalEntity?.pib || "000000000";
    const employerName = legalEntity?.company_name || "N/A";
    const employerMb = legalEntity?.mb || "00000000";
    const employerMunicipality = legalEntity?.municipality_code || "000";

    // Validate all JMBGs
    const warnings: string[] = [];
    for (const item of items || []) {
      const jmbg = item.employees?.jmbg;
      if (!jmbg) {
        warnings.push(`${item.employees?.full_name}: nedostaje JMBG`);
      } else if (!validateJmbg(jmbg)) {
        warnings.push(`${item.employees?.full_name}: nevažeći JMBG ${jmbg}`);
      }
    }

    // Build ePorezi XSD-compliant PPP-PD XML
    let xmlItems = "";
    let rBr = 1;

    // Fetch payroll parameters for the period to get nontaxable amount
    const periodDate = `${run.period_year}-${String(run.period_month).padStart(2, "0")}-01`;
    const { data: ppRow } = await supabase
      .from("payroll_parameters")
      .select("nontaxable_amount, min_contribution_base, max_contribution_base")
      .eq("tenant_id", run.tenant_id)
      .lte("effective_from", periodDate)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle();
    const payrollNontaxable = ppRow?.nontaxable_amount ?? 25000;
    const minBase = ppRow?.min_contribution_base ?? 0;
    const maxBase = ppRow?.max_contribution_base ?? 0;

    // Running totals for Ukupno section
    let sumGross = 0, sumTaxBase = 0, sumTax = 0;
    let sumPioEmp = 0, sumPioEr = 0, sumHealthEmp = 0, sumHealthEr = 0;
    let sumUnempEmp = 0, sumUnempEr = 0, sumNet = 0;
    let sumSubsidyTax = 0, sumSubsidyPio = 0, sumSubsidyHealth = 0, sumSubsidyUnemp = 0;

    for (const item of items || []) {
      const emp = item.employees;
      const jmbg = emp?.jmbg || "0000000000000";
      const ovp = item.ovp_code || "101";
      const ola = item.ola_code || "00";
      const ben = item.ben_code || "0";

      const gross = Number(item.gross_salary || 0);
      const pioEmp = Number(item.pio_employee || item.pension_contribution || 0);
      const healthEmp = Number(item.health_employee || item.health_contribution || 0);
      const unempEmp = Number(item.unemployment_employee || item.unemployment_contribution || 0);
      const totalEmpContrib = pioEmp + healthEmp + unempEmp;

      const nonTaxable = Number(item.non_taxable_amount || payrollNontaxable);
      const taxBase = Math.max(0, gross - totalEmpContrib - nonTaxable);
      const tax = Number(item.tax_amount || item.income_tax || 0);

      const pioEr = Number(item.pio_employer || 0);
      const healthEr = Number(item.health_employer || 0);
      const unempEr = Number(item.unemployment_employer || 0);
      const net = Number(item.net_salary || 0);
      const municipal = Number(item.municipal_tax || 0);

      // Subsidies (K30-K32 have tax subsidies)
      const subsidyTax = Number(item.subsidy_tax || 0);
      const subsidyPio = Number(item.subsidy_pio || 0);
      const subsidyHealth = Number(item.subsidy_health || 0);
      const subsidyUnemp = Number(item.subsidy_unemployment || 0);

      const empMunicipality = emp?.residence_municipality_code || municipalityFromJmbg(jmbg);

      sumGross += gross; sumTaxBase += taxBase; sumTax += tax;
      sumPioEmp += pioEmp; sumPioEr += pioEr;
      sumHealthEmp += healthEmp; sumHealthEr += healthEr;
      sumUnempEmp += unempEmp; sumUnempEr += unempEr;
      sumNet += net;
      sumSubsidyTax += subsidyTax; sumSubsidyPio += subsidyPio;
      sumSubsidyHealth += subsidyHealth; sumSubsidyUnemp += subsidyUnemp;

      xmlItems += `
        <PodaciOPrimaocuPrihoda>
          <RedniBroj>${rBr++}</RedniBroj>
          <PodaciOPrimaocu>
            <VrstaPrimaoca>1</VrstaPrimaoca>
            <JMBG>${jmbg}</JMBG>
            <Prezime>${emp?.last_name || ""}</Prezime>
            <Ime>${emp?.first_name || ""}</Ime>
            <SifraOpstime>${empMunicipality}</SifraOpstime>
          </PodaciOPrimaocu>
          <PodaciOPrihodu>
            <OznakaVrstePrihoda>${ovp}</OznakaVrstePrihoda>
            <OznakaLicnogAdanja>${ola}</OznakaLicnogAdanja>
            <BeneficiraniRadniStaz>${ben}</BeneficiraniRadniStaz>
            <BrojDana>0</BrojDana>
            <BrojSati>${Number(item.working_hours || 176)}</BrojSati>
            <FondSati>${Number(item.fund_hours || 176)}</FondSati>
          </PodaciOPrihodu>
          <PodaciOObracunatimDoprinosima>
            <BrutoZarada>${fmtAmt(gross)}</BrutoZarada>
            <OsnovicaZaPorez>${fmtAmt(taxBase)}</OsnovicaZaPorez>
            <Porez>${fmtAmt(tax)}</Porez>
            <PIORadnik>${fmtAmt(pioEmp)}</PIORadnik>
            <ZdravstvenoRadnik>${fmtAmt(healthEmp)}</ZdravstvenoRadnik>
            <NezaposlenostRadnik>${fmtAmt(unempEmp)}</NezaposlenostRadnik>
            <PIOPoslodavac>${fmtAmt(pioEr)}</PIOPoslodavac>
            <ZdravstvenoPoslodavac>${fmtAmt(healthEr)}</ZdravstvenoPoslodavac>
            <NezaposlenostPoslodavac>${fmtAmt(unempEr)}</NezaposlenostPoslodavac>
            <NetoZarada>${fmtAmt(net)}</NetoZarada>
            <OpstinskiPrirez>${fmtAmt(municipal)}</OpstinskiPrirez>
          </PodaciOObracunatimDoprinosima>
          ${(subsidyTax + subsidyPio + subsidyHealth + subsidyUnemp) > 0 ? `
          <PodaciOOlaksicama>
            <SubvencijaPorez>${fmtAmt(subsidyTax)}</SubvencijaPorez>
            <SubvencijaPIO>${fmtAmt(subsidyPio)}</SubvencijaPIO>
            <SubvencijaZdravstveno>${fmtAmt(subsidyHealth)}</SubvencijaZdravstveno>
            <SubvencijaNezaposlenost>${fmtAmt(subsidyUnemp)}</SubvencijaNezaposlenost>
          </PodaciOOlaksicama>` : ""}
        </PodaciOPrimaocuPrihoda>`;
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<PPP-PD xmlns="urn:poreskauprava.gov.rs:ppppd:v3"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        VerzijaPrijave="3"
        DatumObracuna="${now}"
        DatumIsplate="${paymentDate}"
        ObracunskiPeriod="${periodLabel}"
        VrstaObracuna="1">
  <PodaciOIsplatiocu>
    <TipIsplatioca>1</TipIsplatioca>
    <PIB>${employerPib}</PIB>
    <MaticniBroj>${employerMb}</MaticniBroj>
    <NazivIsplatioca>${employerName}</NazivIsplatioca>
    <SifraOpstime>${employerMunicipality}</SifraOpstime>
    <Email>${legalEntity?.email || ""}</Email>
  </PodaciOIsplatiocu>
  <ListaPrimaocu>${xmlItems}
  </ListaPrimaocu>
  <Ukupno>
    <UkupnoBrutoZarada>${fmtAmt(sumGross)}</UkupnoBrutoZarada>
    <UkupnoOsnovicaZaPorez>${fmtAmt(sumTaxBase)}</UkupnoOsnovicaZaPorez>
    <UkupnoPorez>${fmtAmt(sumTax)}</UkupnoPorez>
    <UkupnoPIORadnik>${fmtAmt(sumPioEmp)}</UkupnoPIORadnik>
    <UkupnoZdravstvenoRadnik>${fmtAmt(sumHealthEmp)}</UkupnoZdravstvenoRadnik>
    <UkupnoNezaposlenostRadnik>${fmtAmt(sumUnempEmp)}</UkupnoNezaposlenostRadnik>
    <UkupnoPIOPoslodavac>${fmtAmt(sumPioEr)}</UkupnoPIOPoslodavac>
    <UkupnoZdravstvenoPoslodavac>${fmtAmt(sumHealthEr)}</UkupnoZdravstvenoPoslodavac>
    <UkupnoNezaposlenostPoslodavac>${fmtAmt(sumUnempEr)}</UkupnoNezaposlenostPoslodavac>
    <UkupnoNeto>${fmtAmt(sumNet)}</UkupnoNeto>
    <BrojZaposlenih>${(items || []).length}</BrojZaposlenih>
  </Ukupno>
  ${warnings.length > 0 ? `<!-- UPOZORENJA:\n${warnings.map(w => `    - ${w}`).join("\n")}\n  -->` : ""}
</PPP-PD>`;

    // P2-06: Return proper XML content type for valid XML download
    return new Response(xml, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="PPP-PD-${periodLabel}.xml"`,
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
