import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function fmtAmt(n: number): string {
  return n.toFixed(2);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { report_id, tenant_id } = await req.json();
    if (!report_id) throw new Error("report_id required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: report, error: rptErr } = await supabase
      .from("od_o_reports")
      .select("*, employees(full_name, jmbg, first_name, last_name)")
      .eq("id", report_id)
      .single();
    if (rptErr || !report) throw new Error("Report not found");

    const { data: legalEntity } = await supabase
      .from("legal_entities")
      .select("pib, company_name, mb, address, municipality_code")
      .eq("tenant_id", report.tenant_id)
      .eq("is_primary", true)
      .maybeSingle();

    const employerPib = legalEntity?.pib || "000000000";
    const employerName = legalEntity?.company_name || "N/A";
    const employerMb = legalEntity?.mb || "00000000";
    const periodLabel = `${report.period_year}-${String(report.period_month).padStart(2, "0")}`;
    const now = new Date().toISOString().split("T")[0];
    const jmbg = report.employees?.jmbg || "0000000000000";
    const fullName = report.employees?.full_name || "N/A";

    // OD-O income type codes per Serbian tax authority
    const incomeTypeCodes: Record<string, string> = {
      royalties: "1",
      rent: "2",
      capital_income: "3",
      capital_gains: "4",
      other_income: "5",
      sports: "6",
      insurance: "7",
    };

    const typeCode = incomeTypeCodes[report.income_type] || "5";

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<OD-O xmlns="http://pid.purs.gov.rs/od-o">
  <Zaglavlje>
    <PodaciOIsplatiocu>
      <PIB>${employerPib}</PIB>
      <MB>${employerMb}</MB>
      <NazivIsplatioca>${escXml(employerName)}</NazivIsplatioca>
    </PodaciOIsplatiocu>
    <DatumObracuna>${now}</DatumObracuna>
    <DatumIsplate>${now}</DatumIsplate>
    <PeriodOd>${periodLabel}-01</PeriodOd>
    <PeriodDo>${periodLabel}-${lastDayOfMonth(report.period_year, report.period_month)}</PeriodDo>
  </Zaglavlje>
  <Primaoci>
    <Primalac>
      <JMBG>${jmbg}</JMBG>
      <ImePrezime>${escXml(fullName)}</ImePrezime>
      <VrstaPrihoda>${typeCode}</VrstaPrihoda>
      <BrutoIznos>${fmtAmt(report.gross_amount)}</BrutoIznos>
      <PoreskaOsnovica>${fmtAmt(report.tax_base)}</PoreskaOsnovica>
      <Porez>${fmtAmt(report.tax_amount)}</Porez>
      <DoprPIO>${fmtAmt(report.pio_amount)}</DoprPIO>
      <DoprZdr>${fmtAmt(report.health_amount)}</DoprZdr>
      <DoprNezap>${fmtAmt(report.unemployment_amount)}</DoprNezap>
      <NetoIznos>${fmtAmt(report.net_amount)}</NetoIznos>
    </Primalac>
  </Primaoci>
</OD-O>`;

    // Save XML to report
    await supabase.from("od_o_reports").update({
      xml_data: xml,
      status: "generated",
    }).eq("id", report_id);

    return new Response(JSON.stringify({ xml, success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function escXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function lastDayOfMonth(year: number, month: number): string {
  const d = new Date(year, month, 0);
  return String(d.getDate()).padStart(2, "0");
}
