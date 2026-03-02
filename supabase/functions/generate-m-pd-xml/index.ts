import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/error-handler.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";

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

    const { employee_id, tenant_id, change_type, change_description } = await req.json();
    if (!employee_id || !tenant_id) throw new Error("employee_id and tenant_id required");

    const { data: memberChk } = await supabase.from("tenant_members").select("id").eq("user_id", user.id).eq("tenant_id", tenant_id).eq("status", "active").maybeSingle();
    const { data: saChk } = await supabase.from("user_roles").select("id").eq("user_id", user.id).eq("role", "super_admin").maybeSingle();
    if (!memberChk && !saChk) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: emp } = await supabase.from("employees").select("*, departments(name)").eq("id", employee_id).eq("tenant_id", tenant_id).single();
    if (!emp) throw new Error("Employee not found");
    const { data: tenant } = await supabase.from("tenants").select("name, tax_id").eq("id", tenant_id).single();
    const { data: contract } = await supabase.from("employee_contracts").select("*").eq("employee_id", employee_id).eq("tenant_id", tenant_id).eq("is_active", true).order("start_date", { ascending: false }).limit(1).maybeSingle();

    // Build M-PD XML (Promena podataka o osiguraniku)
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<MPD xmlns="http://croso.gov.rs/mpd">
  <Podnosilac>
    <PIB>${tenant?.tax_id || ""}</PIB>
    <Naziv>${escXml(tenant?.name || "")}</Naziv>
  </Podnosilac>
  <Promena>
    <JMBG>${emp.jmbg || ""}</JMBG>
    <Ime>${escXml(emp.first_name)}</Ime>
    <Prezime>${escXml(emp.last_name)}</Prezime>
    <VrstaPromene>${change_type || "1"}</VrstaPromene>
    <OpisPromene>${escXml(change_description || "Promena podataka")}</OpisPromene>
    <DatumPromene>${new Date().toISOString().split("T")[0]}</DatumPromene>
    <RadnoVreme>${contract?.working_hours_per_week || 40}</RadnoVreme>
    <Zanimanje>${escXml(emp.position || "")}</Zanimanje>
    <OrganizacionaJedinica>${escXml((emp as any).departments?.name || "")}</OrganizacionaJedinica>
  </Promena>
</MPD>`;

    return new Response(xml, {
      headers: { ...corsHeaders, "Content-Type": "application/xml; charset=utf-8", "Content-Disposition": `attachment; filename="M-PD-${emp.jmbg || employee_id}.xml"` },
    });
  } catch (e: any) {
    return createErrorResponse(e, req, { logPrefix: "generate-m-pd-xml error", status: 400 });
  }
});

function escXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
