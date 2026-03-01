import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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

    const { data: memberChk } = await supabase.from("tenant_members").select("id").eq("user_id", user.id).eq("tenant_id", tenant_id).eq("status", "active").maybeSingle();
    const { data: saChk } = await supabase.from("user_roles").select("id").eq("user_id", user.id).eq("role", "super_admin").maybeSingle();
    if (!memberChk && !saChk) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: emp } = await supabase.from("employees").select("*").eq("id", employee_id).eq("tenant_id", tenant_id).single();
    if (!emp) throw new Error("Employee not found");
    const { data: tenant } = await supabase.from("tenants").select("name, tax_id").eq("id", tenant_id).single();

    const terminationDate = emp.early_termination_date || emp.termination_date;
    if (!terminationDate) throw new Error("No termination date set");

    // Build OD-1 XML (Odjava zaposlenog sa obaveznog socijalnog osiguranja)
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<OD1 xmlns="http://croso.gov.rs/od1">
  <Podnosilac>
    <PIB>${tenant?.tax_id || ""}</PIB>
    <Naziv>${escXml(tenant?.name || "")}</Naziv>
  </Podnosilac>
  <Odjava>
    <JMBG>${emp.jmbg || ""}</JMBG>
    <Ime>${escXml(emp.first_name)}</Ime>
    <Prezime>${escXml(emp.last_name)}</Prezime>
    <DatumPrestankaRada>${terminationDate}</DatumPrestankaRada>
    <RazlogPrestanka>1</RazlogPrestanka>
  </Odjava>
</OD1>`;

    return new Response(xml, {
      headers: { ...corsHeaders, "Content-Type": "application/xml; charset=utf-8", "Content-Disposition": `attachment; filename="OD-1-${emp.jmbg || employee_id}.xml"` },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

function escXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
