import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/error-handler.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";

function validatePib(pib: string): boolean { return /^\d{9}$/.test(pib); }
function escapeXml(s: string): string { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;"); }

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });

    const body = await req.json();
    const { tenant_id, dispatch_note_id } = body;
    if (!dispatch_note_id || !tenant_id) return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: membership } = await supabase.from("tenant_members").select("id").eq("user_id", user.id).eq("tenant_id", tenant_id).eq("status", "active").maybeSingle();
    if (!membership) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });

    const { data: note } = await supabase.from("dispatch_notes").select("*, legal_entities(name, pib)").eq("id", dispatch_note_id).single();
    if (!note) return new Response(JSON.stringify({ error: "Dispatch note not found" }), { status: 404, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });

    if (!note.legal_entities?.pib || !validatePib(note.legal_entities.pib)) {
      return new Response(JSON.stringify({ error: "PIB pravnog lica nije validan" }), { status: 400, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });
    }

    const { data: items } = await supabase.from("dispatch_note_lines").select("*, products(name, sku)").eq("dispatch_note_id", dispatch_note_id);
    if (!items?.length) return new Response(JSON.stringify({ error: "No items found on dispatch note" }), { status: 400, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });

    const xmlDate = new Date().toISOString().slice(0, 10);
    const xmlTime = new Date().toISOString().slice(11, 19);

    let itemsXml = "";
    for (const item of items) {
      itemsXml += `
      <Stavka>
        <RbStavke>${item.sort_order}</RbStavke>
        <NazivRobeIliUsluge>${escapeXml(item.products?.name || "")}</NazivRobeIliUsluge>
        <Kolicina>${Number(item.quantity).toFixed(2)}</Kolicina>
        <JedinicaMere>kom</JedinicaMere>
      </Stavka>`;
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <eOtpremnica
      xmlns="http://www.efaktura.gov.rs"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:schemaLocation="http://www.efaktura.gov.rs
      eOtpremnicaSchema.xsd">
      <Zaglavlje>
        <TipDokumenta>Otpremnica</TipDokumenta>
        <Datum>${xmlDate}</Datum>
        <Vreme>${xmlTime}</Vreme>
        <BrojOtpremnice>${note.note_number}</BrojOtpremnice>
        <PoreskiIdentifikacioniBroj>${note.legal_entities.pib}</PoreskiIdentifikacioniBroj>
        <NazivKupca>${escapeXml(note.partner_name || "")}</NazivKupca>
      </Zaglavlje>
      <Stavke>${itemsXml}
      </Stavke>
    </eOtpremnica>`;

    return new Response(xml, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="eotpremnica-${dispatch_note_id}.xml"`,
      },
    });
  } catch (err) {
    return createErrorResponse(err, req, { logPrefix: "eotpremnica-submit" });
  }
});
