import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

function fmtAmt(n: number): string {
  return n.toFixed(2);
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
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

    const { report_id, tenant_id, report_year } = await req.json();
    if (!tenant_id || !report_year) throw new Error("tenant_id and report_year required");

    // ── P1-01: Tenant membership verification ──
    const { data: memberChk } = await supabase
      .from("tenant_members").select("id")
      .eq("user_id", authUser.id).eq("tenant_id", tenant_id).eq("status", "active").maybeSingle();
    const { data: saChk } = await supabase
      .from("user_roles").select("id")
      .eq("user_id", authUser.id).eq("role", "super_admin").maybeSingle();
    if (!memberChk && !saChk) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch legal entity
    const { data: legalEntity } = await supabase
      .from("legal_entities")
      .select("pib, company_name, mb, address, municipality_code, registration_number")
      .eq("tenant_id", tenant_id)
      .eq("is_primary", true)
      .maybeSingle();

    const employerPib = legalEntity?.pib || "000000000";
    const employerName = legalEntity?.company_name || "N/A";
    const employerMb = legalEntity?.mb || "00000000";
    const regNumber = legalEntity?.registration_number || employerMb;

    // Fetch all payroll runs for the year
    const { data: runs, error: runsErr } = await supabase
      .from("payroll_runs")
      .select("id, period_month, period_year")
      .eq("tenant_id", tenant_id)
      .eq("period_year", report_year)
      .eq("status", "approved");
    if (runsErr) throw runsErr;

    if (!runs || runs.length === 0) {
      return new Response(JSON.stringify({ error: "No approved payroll runs for this year" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const runIds = runs.map((r: any) => r.id);

    // Fetch all payroll items for those runs
    const { data: items, error: itemsErr } = await supabase
      .from("payroll_items")
      .select("*, employees(full_name, jmbg, first_name, last_name)")
      .in("payroll_run_id", runIds);
    if (itemsErr) throw itemsErr;

    // Aggregate by employee
    const employeeMap = new Map<string, {
      employee: any;
      months: Set<number>;
      totalPioBase: number;
      totalPioEmployee: number;
      totalPioEmployer: number;
    }>();

    for (const item of items || []) {
      const empId = item.employee_id;
      const run = runs.find((r: any) => r.id === item.payroll_run_id);
      if (!employeeMap.has(empId)) {
        employeeMap.set(empId, {
          employee: item.employees,
          months: new Set(),
          totalPioBase: 0,
          totalPioEmployee: 0,
          totalPioEmployer: 0,
        });
      }
      const agg = employeeMap.get(empId)!;
      if (run) agg.months.add(run.period_month);
      agg.totalPioBase += Number(item.taxable_base) || 0;
      agg.totalPioEmployee += Number(item.pension_contribution) || 0;
      agg.totalPioEmployer += Number(item.pension_employer) || 0;
    }

    // Build per-employee data
    const employeeData = Array.from(employeeMap.entries()).map(([empId, agg]) => ({
      employee_id: empId,
      full_name: agg.employee?.full_name || "N/A",
      jmbg: agg.employee?.jmbg || "0000000000000",
      months_worked: agg.months.size,
      pio_base: agg.totalPioBase,
      pio_employee: agg.totalPioEmployee,
      pio_employer: agg.totalPioEmployer,
    }));

    // Build XML
    const employeeXmlParts = employeeData.map(emp => `    <Osiguranik>
      <JMBG>${emp.jmbg}</JMBG>
      <ImePrezime>${escXml(emp.full_name)}</ImePrezime>
      <BrojMeseci>${emp.months_worked}</BrojMeseci>
      <OsnovicaZaDoprinos>${fmtAmt(emp.pio_base)}</OsnovicaZaDoprinos>
      <DoprZaposleni>${fmtAmt(emp.pio_employee)}</DoprZaposleni>
      <DoprPoslodavac>${fmtAmt(emp.pio_employer)}</DoprPoslodavac>
    </Osiguranik>`).join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<M4 xmlns="http://pid.pio.rs/m4">
  <Zaglavlje>
    <PIBPoslodavca>${employerPib}</PIBPoslodavca>
    <MBPoslodavca>${employerMb}</MBPoslodavca>
    <NazivPoslodavca>${escXml(employerName)}</NazivPoslodavca>
    <GodinaObracuna>${report_year}</GodinaObracuna>
    <BrojOsiguranika>${employeeData.length}</BrojOsiguranika>
  </Zaglavlje>
  <Osiguranici>
${employeeXmlParts}
  </Osiguranici>
</M4>`;

    // Save or update M4 report
    if (report_id) {
      await supabase.from("m4_reports").update({
        xml_data: xml,
        generated_data: employeeData,
        status: "generated",
      }).eq("id", report_id);
    } else {
      await supabase.from("m4_reports").insert({
        tenant_id,
        report_year,
        xml_data: xml,
        generated_data: employeeData,
        status: "generated",
      });
    }

    return new Response(JSON.stringify({ xml, employeeData, success: true }), {
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
