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

    const { claim_id, tenant_id } = await req.json();
    if (!claim_id || !tenant_id) {
      return new Response(JSON.stringify({ error: "claim_id and tenant_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Get connection
    const { data: connection } = await supabase
      .from("ebolovanje_connections")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("is_active", true)
      .maybeSingle();

    if (!connection) {
      return new Response(JSON.stringify({ error: "eBolovanje connection not configured or inactive" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get claim with employee data
    const { data: claim, error: claimErr } = await supabase
      .from("ebolovanje_claims")
      .select("*, employees(full_name, jmbg), legal_entities(name, pib)")
      .eq("id", claim_id)
      .eq("tenant_id", tenant_id)
      .single();

    if (claimErr || !claim) {
      return new Response(JSON.stringify({ error: "Claim not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Build RFZO-compatible payload (placeholder structure)
    const rfzoPayload = {
      employeeName: (claim.employees as any)?.full_name,
      employeeJmbg: (claim.employees as any)?.jmbg,
      employerPib: (claim.legal_entities as any)?.pib,
      employerName: (claim.legal_entities as any)?.name,
      claimType: claim.claim_type,
      startDate: claim.start_date,
      endDate: claim.end_date,
      diagnosisCode: claim.diagnosis_code,
      doctorName: claim.doctor_name,
      medicalFacility: claim.medical_facility,
      amount: claim.amount,
    };

    if (connection.environment === "sandbox") {
      // Sandbox simulation
      const fakeClaimNumber = `RFZO-${Date.now()}`;
      await supabase.from("ebolovanje_claims").update({
        status: "submitted",
        submitted_at: new Date().toISOString(),
        rfzo_claim_number: fakeClaimNumber,
      }).eq("id", claim_id);

      // Create simulated doznaka
      await supabase.from("ebolovanje_doznake").insert({
        tenant_id,
        claim_id,
        doznaka_number: `DOZ-${Date.now()}`,
        issued_date: new Date().toISOString().split("T")[0],
        valid_from: claim.start_date,
        valid_to: claim.end_date,
        rfzo_status: "confirmed",
        response_payload: { simulated: true, payload: rfzoPayload },
      });

      return new Response(JSON.stringify({ success: true, status: "submitted", rfzo_claim_number: fakeClaimNumber, simulated: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Production: placeholder for real eUprava API
    await supabase.from("ebolovanje_claims").update({
      status: "submitted",
      submitted_at: new Date().toISOString(),
    }).eq("id", claim_id);

    await supabase.from("ebolovanje_connections").update({ last_sync_at: new Date().toISOString() }).eq("id", connection.id);

    return new Response(JSON.stringify({
      success: true, status: "submitted",
      message: "Claim submitted. eUprava API integration pending Ministry specification.",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
