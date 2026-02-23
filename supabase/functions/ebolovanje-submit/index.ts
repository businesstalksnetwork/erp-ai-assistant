import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function validateJmbg(jmbg: string): boolean {
  return /^\d{13}$/.test(jmbg);
}

function validatePib(pib: string): boolean {
  return /^\d{9}$/.test(pib);
}

function validateIcd10(code: string): boolean {
  return /^[A-Z]\d{2}(\.\d{1,2})?$/i.test(code);
}

function validateIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
}

const VALID_CLAIM_TYPES = ["sick_leave", "maternity", "work_injury"];

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

    // --- PAYLOAD VALIDATION ---
    const errors: string[] = [];

    const employeeJmbg = (claim.employees as any)?.jmbg;
    if (!employeeJmbg || !validateJmbg(employeeJmbg)) {
      errors.push("Employee must have a valid 13-digit JMBG.");
    }

    const employerPib = (claim.legal_entities as any)?.pib;
    if (!employerPib || !validatePib(employerPib)) {
      errors.push("Legal entity must have a valid 9-digit PIB.");
    }

    if (!claim.claim_type || !VALID_CLAIM_TYPES.includes(claim.claim_type)) {
      errors.push(`Claim type must be one of: ${VALID_CLAIM_TYPES.join(", ")}.`);
    }

    if (!claim.start_date || !validateIsoDate(claim.start_date)) {
      errors.push("Start date is required and must be a valid date (YYYY-MM-DD).");
    }

    if (claim.end_date) {
      if (!validateIsoDate(claim.end_date)) {
        errors.push("End date must be a valid date (YYYY-MM-DD).");
      } else if (claim.start_date && claim.end_date < claim.start_date) {
        errors.push("End date must be on or after start date.");
      }
    }

    if (["sick_leave", "work_injury"].includes(claim.claim_type)) {
      if (!claim.diagnosis_code) {
        errors.push("Diagnosis code (ICD-10) is required for sick leave and work injury claims.");
      } else if (!validateIcd10(claim.diagnosis_code)) {
        errors.push("Diagnosis code must be valid ICD-10 format (e.g. J06, J06.9).");
      }
    }

    if (!claim.doctor_name || claim.doctor_name.trim() === "") {
      errors.push("Doctor name is required.");
    }

    if (!claim.medical_facility || claim.medical_facility.trim() === "") {
      errors.push("Medical facility is required.");
    }

    if (errors.length > 0) {
      return new Response(JSON.stringify({ error: "Validation failed", details: errors }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Build RFZO-compatible payload
    const rfzoPayload = {
      employeeName: (claim.employees as any)?.full_name,
      employeeJmbg,
      employerPib,
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
      const fakeClaimNumber = `RFZO-${Date.now()}`;
      await supabase.from("ebolovanje_claims").update({
        status: "submitted",
        submitted_at: new Date().toISOString(),
        rfzo_claim_number: fakeClaimNumber,
      }).eq("id", claim_id);

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
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
