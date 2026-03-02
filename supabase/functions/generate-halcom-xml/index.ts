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
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });
    }
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });

    const { payment_order_ids, tenant_id } = await req.json();
    if (!payment_order_ids?.length || !tenant_id) throw new Error("payment_order_ids and tenant_id required");

    const { data: memberChk } = await supabase.from("tenant_members").select("id").eq("user_id", user.id).eq("tenant_id", tenant_id).eq("status", "active").maybeSingle();
    const { data: saChk } = await supabase.from("user_roles").select("id").eq("user_id", user.id).eq("role", "super_admin").maybeSingle();
    if (!memberChk && !saChk) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });

    const { data: orders } = await supabase.from("payment_orders").select("*").in("id", payment_order_ids).eq("tenant_id", tenant_id);
    if (!orders?.length) throw new Error("No payment orders found");

    const { data: tenant } = await supabase.from("tenants").select("name, tax_id").eq("id", tenant_id).single();
    const today = new Date().toISOString().split("T")[0];

    // Build Halcom-compatible domestic payment XML
    let itemsXml = "";
    for (const o of orders) {
      itemsXml += `
    <NalogZaPlacanje>
      <RacunPlatioca>${escXml(o.sender_account)}</RacunPlatioca>
      <RacunPrimaoca>${escXml(o.recipient_account)}</RacunPrimaoca>
      <NazivPrimaoca>${escXml(o.recipient_name || "")}</NazivPrimaoca>
      <SifrePlacanja>${escXml(o.payment_code || "289")}</SifrePlacanja>
      <Iznos>${Number(o.amount).toFixed(2)}</Iznos>
      <Valuta>${o.currency}</Valuta>
      <Model>${escXml(o.model || "")}</Model>
      <PozivNaBroj>${escXml(o.reference_number || "")}</PozivNaBroj>
      <SvrhaDoznake>${escXml(o.description || "")}</SvrhaDoznake>
      <DatumPlacanja>${o.payment_date}</DatumPlacanja>
      <Hitno>false</Hitno>
    </NalogZaPlacanje>`;
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<HalcomExport>
  <Zaglavlje>
    <Podnosilac>${escXml(tenant?.name || "")}</Podnosilac>
    <PIB>${tenant?.tax_id || ""}</PIB>
    <DatumKreiranja>${today}</DatumKreiranja>
    <BrojNaloga>${orders.length}</BrojNaloga>
    <UkupanIznos>${orders.reduce((s: number, o: any) => s + Number(o.amount), 0).toFixed(2)}</UkupanIznos>
  </Zaglavlje>
  <Nalozi>${itemsXml}
  </Nalozi>
</HalcomExport>`;

    return new Response(xml, {
      headers: withSecurityHeaders({
        ...corsHeaders,
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="halcom-export-${today}.xml"`,
      }),
    });
  } catch (e) {
    return createErrorResponse(e, req, { logPrefix: "generate-halcom-xml" });
  }
});

function escXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
