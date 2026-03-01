import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

function validateJmbg(jmbg: string): boolean {
  if (!/^\d{13}$/.test(jmbg)) return false;
  const d = jmbg.split("").map(Number);
  const sum = 7*(d[0]+d[6]) + 6*(d[1]+d[7]) + 5*(d[2]+d[8])
            + 4*(d[3]+d[9]) + 3*(d[4]+d[10]) + 2*(d[5]+d[11]);
  let ctrl = 11 - (sum % 11);
  if (ctrl > 9) ctrl = 0;
  return ctrl === d[12];
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
const EMPLOYER_DAYS = 30; // First 30 days paid by employer

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function diffDays(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  return Math.max(0, Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1);
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: authErr } = await userClient.auth.getClaims(token);
    if (authErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const user = { id: claimsData.claims.sub as string };

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
      .select("*, employees(full_name, jmbg, id), legal_entities(name, pib)")
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

    // Build RFZO payload
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

    // ── Bridge: auto-create leave_request ──
    const employeeId = (claim.employees as any)?.id;
    if (employeeId) {
      const leaveTypeMap: Record<string, string> = {
        sick_leave: "sick_leave",
        maternity: "maternity_leave",
        work_injury: "sick_leave",
      };
      const leaveType = leaveTypeMap[claim.claim_type] || "sick_leave";
      const totalDays = claim.end_date ? diffDays(claim.start_date, claim.end_date) : EMPLOYER_DAYS;
      const employerDays = Math.min(totalDays, EMPLOYER_DAYS);
      const rfzoDays = Math.max(0, totalDays - EMPLOYER_DAYS);

      // Check if leave request already exists for this claim
      const { data: existingLeave } = await supabase
        .from("leave_requests")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("employee_id", employeeId)
        .eq("start_date", claim.start_date)
        .eq("leave_type", leaveType)
        .maybeSingle();

      if (!existingLeave) {
        await supabase.from("leave_requests").insert({
          tenant_id,
          employee_id: employeeId,
          leave_type: leaveType,
          start_date: claim.start_date,
          end_date: claim.end_date || claim.start_date,
          days: totalDays,
          status: "approved",
          notes: `Auto-created from eBolovanje claim. Employer: ${employerDays}d, RFZO: ${rfzoDays}d. Diagnosis: ${claim.diagnosis_code || "N/A"}`,
        });
      }
    }

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

      return new Response(JSON.stringify({
        success: true,
        status: "submitted",
        rfzo_claim_number: fakeClaimNumber,
        simulated: true,
        leave_request_created: !!(employeeId),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Production: Generate RFZO XML for eUprava submission
    const totalDays = claim.end_date ? diffDays(claim.start_date, claim.end_date) : EMPLOYER_DAYS;
    const employerDaysCalc = Math.min(totalDays, EMPLOYER_DAYS);
    const rfzoDaysCalc = Math.max(0, totalDays - EMPLOYER_DAYS);

    const rfzoXml = `<?xml version="1.0" encoding="UTF-8"?>
<eBolovanje xmlns="urn:rfzo.gov.rs:ebolovanje:v1">
  <Poslodavac>
    <Naziv>${escapeXml((claim.legal_entities as any)?.name || "")}</Naziv>
    <PIB>${employerPib}</PIB>
  </Poslodavac>
  <Zaposleni>
    <ImePrezime>${escapeXml((claim.employees as any)?.full_name || "")}</ImePrezime>
    <JMBG>${employeeJmbg}</JMBG>
  </Zaposleni>
  <Bolovanje>
    <VrstaBolovanja>${claim.claim_type}</VrstaBolovanja>
    <DatumOd>${claim.start_date}</DatumOd>
    <DatumDo>${claim.end_date || ""}</DatumDo>
    <UkupnoDana>${totalDays}</UkupnoDana>
    <DanaPoslodavac>${employerDaysCalc}</DanaPoslodavac>
    <DanaRFZO>${rfzoDaysCalc}</DanaRFZO>
    <DijagnozaKod>${escapeXml(claim.diagnosis_code || "")}</DijagnozaKod>
    <ImeDoktora>${escapeXml(claim.doctor_name || "")}</ImeDoktora>
    <ZdravstvenaUstanova>${escapeXml(claim.medical_facility || "")}</ZdravstvenaUstanova>
    ${claim.amount ? `<Iznos>${claim.amount}</Iznos>` : ""}
  </Bolovanje>
</eBolovanje>`;

    // Try real eUprava API if credentials configured
    let apiResult: any = null;
    const encryptionKey = Deno.env.get("SEF_ENCRYPTION_KEY");
    if (connection.euprava_username && (connection.euprava_password_encrypted || connection.api_key_encrypted)) {
      try {
        // Decrypt password if encryption key available
        let password = connection.euprava_password_encrypted || "";
        if (encryptionKey && connection.api_key_encrypted) {
          const { data: decPwd } = await supabase.rpc("decrypt_value", { encrypted_data: connection.api_key_encrypted, passphrase: encryptionKey });
          if (decPwd) password = decPwd;
        }

        // Decrypt custom URL if present
        let eUpravaUrl = connection.environment === "production"
          ? "https://euprava.gov.rs/api/ebolovanje/submit"
          : "https://test.euprava.gov.rs/api/ebolovanje/submit";
        if (encryptionKey && connection.api_url_encrypted) {
          const { data: decUrl } = await supabase.rpc("decrypt_value", { encrypted_data: connection.api_url_encrypted, passphrase: encryptionKey });
          if (decUrl) eUpravaUrl = decUrl;
        }

        const apiResp = await fetch(eUpravaUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/xml",
            "Authorization": `Basic ${btoa(`${connection.euprava_username}:${password}`)}`,
          },
          body: rfzoXml,
        });
        apiResult = { status: apiResp.status, body: await apiResp.text() };
      } catch (apiErr) {
        apiResult = { error: (apiErr as Error).message };
      }
    }

    const rfzoClaimNumber = apiResult?.status === 200 ? `RFZO-${Date.now()}` : undefined;

    await supabase.from("ebolovanje_claims").update({
      status: "submitted",
      submitted_at: new Date().toISOString(),
      ...(rfzoClaimNumber ? { rfzo_claim_number: rfzoClaimNumber } : {}),
    }).eq("id", claim_id);

    await supabase.from("ebolovanje_connections").update({
      last_sync_at: new Date().toISOString(),
    }).eq("id", connection.id);

    return new Response(JSON.stringify({
      success: true,
      status: "submitted",
      leave_request_created: !!(employeeId),
      xml_generated: true,
      api_called: !!apiResult,
      rfzo_claim_number: rfzoClaimNumber || null,
      xml: rfzoXml,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
