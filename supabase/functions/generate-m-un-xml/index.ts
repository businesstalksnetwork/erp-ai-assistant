import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

function validateJmbg(jmbg: string): boolean {
  if (!/^\d{13}$/.test(jmbg)) return false;
  const d = jmbg.split("").map(Number);
  const sum = 7*(d[0]+d[6]) + 6*(d[1]+d[7]) + 5*(d[2]+d[8]) + 4*(d[3]+d[9]) + 3*(d[4]+d[10]) + 2*(d[5]+d[11]);
  let ctrl = 11 - (sum % 11);
  if (ctrl > 9) ctrl = 0;
  return ctrl === d[12];
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { employee_id, tenant_id } = await req.json();
    if (!employee_id || !tenant_id) throw new Error("employee_id and tenant_id required");

    // Tenant membership check
    const { data: memberChk } = await supabase.from("tenant_members").select("id").eq("user_id", user.id).eq("tenant_id", tenant_id).eq("status", "active").maybeSingle();
    const { data: saChk } = await supabase.from("user_roles").select("id").eq("user_id", user.id).eq("role", "super_admin").maybeSingle();
    if (!memberChk && !saChk) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Fetch employee + contract
    const { data: emp } = await supabase.from("employees").select("*, departments(name)").eq("id", employee_id).eq("tenant_id", tenant_id).single();
    if (!emp) throw new Error("Employee not found");
    const { data: contract } = await supabase.from("employee_contracts").select("*").eq("employee_id", employee_id).eq("tenant_id", tenant_id).eq("is_active", true).order("start_date", { ascending: false }).limit(1).maybeSingle();
    const { data: tenant } = await supabase.from("tenants").select("name, tax_id").eq("id", tenant_id).single();

    if (!emp.jmbg || !validateJmbg(emp.jmbg)) throw new Error("Invalid or missing JMBG");

    // Build M-UN XML (Prijava zaposlenog na obavezno socijalno osiguranje)
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<MUN xmlns="http://croso.gov.rs/mun">
  <Podnosilac>
    <PIB>${tenant?.tax_id || ""}</PIB>
    <Naziv>${escXml(tenant?.name || "")}</Naziv>
  </Podnosilac>
  <Prijava>
    <JMBG>${emp.jmbg}</JMBG>
    <Ime>${escXml(emp.first_name)}</Ime>
    <Prezime>${escXml(emp.last_name)}</Prezime>
    <DatumPocetkaRada>${emp.hire_date || emp.start_date}</DatumPocetkaRada>
    <VrstaRadnogOdnosa>${contract?.contract_type === "indefinite" ? "1" : "2"}</VrstaRadnogOdnosa>
    <RadnoVreme>${contract?.working_hours_per_week || 40}</RadnoVreme>
    <StepenStrucneSpreme>7</StepenStrucneSpreme>
    <Zanimanje>${escXml(emp.position || "")}</Zanimanje>
    <OrganizacionaJedinica>${escXml((emp as any).departments?.name || "")}</OrganizacionaJedinica>
  </Prijava>
</MUN>`;

    return new Response(xml, {
      headers: { ...corsHeaders, "Content-Type": "application/xml; charset=utf-8", "Content-Disposition": `attachment; filename="M-UN-${emp.jmbg}.xml"` },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

function escXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
