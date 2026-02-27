import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function validatePib(pib: string): boolean {
  return /^\d{9}$/.test(pib);
}

function validateSerbianPlate(plate: string): boolean {
  return /^[A-Z]{2}\s?-?\s?\d{2,4}\s?-?\s?[A-Z]{2}$/i.test(plate);
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { tenant_id } = body;
    // Support both legacy eotpremnica_id and new dispatch_note_id
    const noteId = body.dispatch_note_id || body.eotpremnica_id;
    const isNewSchema = !!body.dispatch_note_id;

    if (!noteId || !tenant_id) {
      return new Response(JSON.stringify({ error: "dispatch_note_id (or eotpremnica_id) and tenant_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Verify tenant membership
    const { data: membership } = await supabase
      .from("tenant_members").select("id")
      .eq("user_id", user.id).eq("tenant_id", tenant_id).eq("status", "active").maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: "Forbidden: not a member of this tenant" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get connection
    const { data: connection } = await supabase
      .from("eotpremnica_connections")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("is_active", true)
      .maybeSingle();

    if (!connection) {
      return new Response(JSON.stringify({ error: "eOtpremnica connection not configured or inactive" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Determine table and fetch note
    const tableName = isNewSchema ? "dispatch_notes" : "eotpremnica";
    const linesTable = isNewSchema ? "dispatch_note_lines" : "eotpremnica_lines";

    let note: any;
    let lines: any[] = [];

    if (isNewSchema) {
      const { data, error: noteErr } = await supabase
        .from("dispatch_notes")
        .select("*, dispatch_note_lines(*), legal_entities(name, pib)")
        .eq("id", noteId)
        .eq("tenant_id", tenant_id)
        .single();
      if (noteErr || !data) {
        return new Response(JSON.stringify({ error: "Dispatch note not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      note = data;
      lines = (data as any).dispatch_note_lines || [];
    } else {
      const { data, error: noteErr } = await supabase
        .from("eotpremnica")
        .select("*, eotpremnica_lines(*), legal_entities(name, pib)")
        .eq("id", noteId)
        .eq("tenant_id", tenant_id)
        .single();
      if (noteErr || !data) {
        return new Response(JSON.stringify({ error: "Dispatch note not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      note = data;
      lines = (data as any).eotpremnica_lines || [];
    }

    // --- PAYLOAD VALIDATION ---
    const errors: string[] = [];

    if (!note.sender_name || note.sender_name.trim() === "") {
      errors.push("Sender name is required.");
    }

    if (!note.receiver_name || note.receiver_name.trim() === "") {
      errors.push("Receiver name is required.");
    }

    if (note.sender_pib && !validatePib(note.sender_pib)) {
      errors.push("Sender PIB must be a valid 9-digit number.");
    }

    if (note.receiver_pib && !validatePib(note.receiver_pib)) {
      errors.push("Receiver PIB must be a valid 9-digit number.");
    }

    if (note.vehicle_plate) {
      if (!validateSerbianPlate(note.vehicle_plate)) {
        errors.push("Vehicle plate must be a valid Serbian format (e.g. BG-123-AA).");
      }
      if (!note.driver_name || note.driver_name.trim() === "") {
        errors.push("Driver name is required when vehicle plate is specified.");
      }
    }

    if (lines.length === 0) {
      errors.push("At least one dispatch line item is required.");
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      if (!line.description || line.description.trim() === "") {
        errors.push(`Line ${lineNum}: description is required.`);
      }
      if (!line.quantity || Number(line.quantity) <= 0) {
        errors.push(`Line ${lineNum}: quantity must be greater than 0.`);
      }
      if (!isNewSchema && (!line.unit || line.unit.trim() === "")) {
        errors.push(`Line ${lineNum}: unit is required.`);
      }
    }

    if (errors.length > 0) {
      return new Response(JSON.stringify({ error: "Validation failed", details: errors }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const requestId = crypto.randomUUID();

    const payload = {
      requestId,
      documentNumber: note.document_number,
      documentDate: note.document_date,
      senderName: note.sender_name,
      senderPib: note.sender_pib,
      senderAddress: note.sender_address,
      senderCity: note.sender_city || null,
      receiverName: note.receiver_name,
      receiverPib: note.receiver_pib,
      receiverAddress: note.receiver_address,
      receiverCity: note.receiver_city || null,
      vehiclePlate: note.vehicle_plate,
      driverName: note.driver_name,
      totalWeight: note.total_weight || null,
      transportReason: note.transport_reason || null,
      lines: lines.map((l: any) => ({
        description: l.description,
        quantity: l.quantity,
        unit: l.unit,
        weight: l.weight || null,
        lotNumber: l.lot_number || null,
        serialNumber: l.serial_number || null,
      })),
    };

    if (connection.environment === "sandbox") {
      if (isNewSchema) {
        await supabase.from("dispatch_notes").update({
          eotpremnica_status: "accepted",
          eotpremnica_id: requestId,
          eotpremnica_response: { simulated: true, payload },
          eotpremnica_sent_at: new Date().toISOString(),
        }).eq("id", noteId);
      } else {
        await supabase.from("eotpremnica").update({
          api_status: "accepted",
          api_request_id: requestId,
          api_response: { simulated: true, payload },
        }).eq("id", noteId);
      }

      return new Response(JSON.stringify({ success: true, status: "accepted", request_id: requestId, simulated: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Production: Generate eOtpremnica XML for Ministry submission
    const xmlLines = lines.map((l: any, i: number) =>
      `    <StavkaOtpremnice>
      <RedniBroj>${i + 1}</RedniBroj>
      <NazivRobe>${escapeXml(l.description)}</NazivRobe>
      <Kolicina>${l.quantity}</Kolicina>
      <JedinicaMere>${escapeXml(l.unit || "kom")}</JedinicaMere>
      ${l.weight ? `<Tezina>${l.weight}</Tezina>` : ""}
      ${l.lot_number ? `<BrojSerije>${escapeXml(l.lot_number)}</BrojSerije>` : ""}
    </StavkaOtpremnice>`
    ).join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<eOtpremnica xmlns="urn:mfin.gov.rs:eotpremnica:v1">
  <ZaglavljeOtpremnice>
    <BrojDokumenta>${escapeXml(note.document_number)}</BrojDokumenta>
    <DatumDokumenta>${note.document_date}</DatumDokumenta>
    <IdZahteva>${requestId}</IdZahteva>
  </ZaglavljeOtpremnice>
  <Posiljilac>
    <Naziv>${escapeXml(note.sender_name)}</Naziv>
    <PIB>${note.sender_pib || ""}</PIB>
    <Adresa>${escapeXml(note.sender_address || "")}</Adresa>
    <Grad>${escapeXml(note.sender_city || "")}</Grad>
  </Posiljilac>
  <Primalac>
    <Naziv>${escapeXml(note.receiver_name)}</Naziv>
    <PIB>${note.receiver_pib || ""}</PIB>
    <Adresa>${escapeXml(note.receiver_address || "")}</Adresa>
    <Grad>${escapeXml(note.receiver_city || "")}</Grad>
  </Primalac>
  <Transport>
    <RegistracijaVozila>${escapeXml(note.vehicle_plate || "")}</RegistracijaVozila>
    <Vozac>${escapeXml(note.driver_name || "")}</Vozac>
    ${note.total_weight ? `<UkupnaTezina>${note.total_weight}</UkupnaTezina>` : ""}
    ${note.transport_reason ? `<RazlogTransporta>${escapeXml(note.transport_reason)}</RazlogTransporta>` : ""}
  </Transport>
  <StavkeOtpremnice>
${xmlLines}
  </StavkeOtpremnice>
</eOtpremnica>`;

    // Try real API if configured, otherwise store XML for manual export
    let apiResult: any = null;
    if (connection.api_url_encrypted && connection.api_key_encrypted) {
      try {
        const apiResp = await fetch(connection.api_url_encrypted, {
          method: "POST",
          headers: {
            "Content-Type": "application/xml",
            "Authorization": `Bearer ${connection.api_key_encrypted}`,
            "Accept": "application/json",
          },
          body: xml,
        });
        apiResult = { status: apiResp.status, body: await apiResp.text() };
      } catch (apiErr) {
        apiResult = { error: (apiErr as Error).message };
      }
    }

    const finalStatus = apiResult?.status === 200 ? "accepted" : "submitted";

    if (isNewSchema) {
      await supabase.from("dispatch_notes").update({
        eotpremnica_status: finalStatus,
        eotpremnica_id: requestId,
        eotpremnica_sent_at: new Date().toISOString(),
        eotpremnica_response: { xml_generated: true, api_result: apiResult },
      }).eq("id", noteId);
    } else {
      await supabase.from("eotpremnica").update({
        api_status: finalStatus,
        api_request_id: requestId,
        api_response: { xml_generated: true, api_result: apiResult },
      }).eq("id", noteId);
    }

    await supabase.from("eotpremnica_connections").update({ last_sync_at: new Date().toISOString() }).eq("id", connection.id);

    return new Response(JSON.stringify({
      success: true, status: finalStatus, request_id: requestId,
      xml_generated: true,
      api_called: !!apiResult,
      xml, // Return XML for manual download if needed
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
