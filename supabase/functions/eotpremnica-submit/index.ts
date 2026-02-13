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

    const { eotpremnica_id, tenant_id } = await req.json();
    if (!eotpremnica_id || !tenant_id) {
      return new Response(JSON.stringify({ error: "eotpremnica_id and tenant_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

    // Get dispatch note with lines
    const { data: note, error: noteErr } = await supabase
      .from("eotpremnica")
      .select("*, eotpremnica_lines(*), legal_entities(name, pib)")
      .eq("id", eotpremnica_id)
      .eq("tenant_id", tenant_id)
      .single();

    if (noteErr || !note) {
      return new Response(JSON.stringify({ error: "Dispatch note not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // --- PAYLOAD VALIDATION ---
    const errors: string[] = [];
    const lines = (note as any).eotpremnica_lines || [];

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
      if (!line.unit || line.unit.trim() === "") {
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
      receiverName: note.receiver_name,
      receiverPib: note.receiver_pib,
      receiverAddress: note.receiver_address,
      vehiclePlate: note.vehicle_plate,
      driverName: note.driver_name,
      totalWeight: note.total_weight,
      lines: lines.map((l: any) => ({
        description: l.description,
        quantity: l.quantity,
        unit: l.unit,
        weight: l.weight,
      })),
    };

    if (connection.environment === "sandbox") {
      await supabase.from("eotpremnica").update({
        api_status: "accepted",
        api_request_id: requestId,
        api_response: { simulated: true, payload },
      }).eq("id", eotpremnica_id);

      return new Response(JSON.stringify({ success: true, status: "accepted", request_id: requestId, simulated: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Production: placeholder for real Ministry API
    await supabase.from("eotpremnica").update({
      api_status: "submitted",
      api_request_id: requestId,
    }).eq("id", eotpremnica_id);

    await supabase.from("eotpremnica_connections").update({ last_sync_at: new Date().toISOString() }).eq("id", connection.id);

    return new Response(JSON.stringify({
      success: true, status: "submitted", request_id: requestId,
      message: "Dispatch note submitted. Ministry API integration pending specification.",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
