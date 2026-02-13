import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const requestId = crypto.randomUUID();

    // Build Ministry XML payload (placeholder structure)
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
      lines: ((note as any).eotpremnica_lines || []).map((l: any) => ({
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
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
