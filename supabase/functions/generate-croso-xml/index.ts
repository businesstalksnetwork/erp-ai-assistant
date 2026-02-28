import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Generate CROSO M-1 (Prijava) / M-2 (Odjava) XML forms
 * for Serbian Central Registry of Compulsory Social Insurance
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { tenant_id, employee_id, form_type } = await req.json();
    if (!tenant_id || !employee_id || !form_type) {
      return new Response(JSON.stringify({ error: "Missing tenant_id, employee_id, or form_type (M1/M2)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify membership
    const { data: membership } = await supabase
      .from("tenant_members")
      .select("id")
      .eq("tenant_id", tenant_id)
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get employee data
    const { data: emp, error: empErr } = await supabase
      .from("employees")
      .select("full_name, jmbg, start_date, end_date, position")
      .eq("id", employee_id)
      .eq("tenant_id", tenant_id)
      .single();

    if (empErr || !emp) {
      return new Response(JSON.stringify({ error: "Employee not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get legal entity
    const { data: le } = await supabase
      .from("legal_entities")
      .select("name, pib, mb")
      .eq("tenant_id", tenant_id)
      .limit(1)
      .single();

    const pib = le?.pib || "000000000";
    const mb = le?.mb || "00000000";
    const companyName = le?.name || "N/A";
    const today = new Date().toISOString().split("T")[0];

    let xml: string;
    let filename: string;

    if (form_type === "M1") {
      xml = `<?xml version="1.0" encoding="UTF-8"?>
<CROSOPrijava xmlns="urn:croso.gov.rs:m1">
  <Poslodavac>
    <PIB>${escapeXml(pib)}</PIB>
    <MB>${escapeXml(mb)}</MB>
    <Naziv>${escapeXml(companyName)}</Naziv>
  </Poslodavac>
  <Zaposleni>
    <JMBG>${escapeXml(emp.jmbg || "")}</JMBG>
    <ImePrezime>${escapeXml(emp.full_name)}</ImePrezime>
    <RadnoMesto>${escapeXml(emp.position || "")}</RadnoMesto>
    <DatumPocetkaRada>${emp.start_date || today}</DatumPocetkaRada>
  </Zaposleni>
  <DatumPodnosenja>${today}</DatumPodnosenja>
</CROSOPrijava>`;
      filename = `M1_${emp.jmbg || employee_id}_${today}.xml`;
    } else {
      xml = `<?xml version="1.0" encoding="UTF-8"?>
<CROSOOdjava xmlns="urn:croso.gov.rs:m2">
  <Poslodavac>
    <PIB>${escapeXml(pib)}</PIB>
    <MB>${escapeXml(mb)}</MB>
    <Naziv>${escapeXml(companyName)}</Naziv>
  </Poslodavac>
  <Zaposleni>
    <JMBG>${escapeXml(emp.jmbg || "")}</JMBG>
    <ImePrezime>${escapeXml(emp.full_name)}</ImePrezime>
    <DatumPrestankaRada>${emp.end_date || today}</DatumPrestankaRada>
  </Zaposleni>
  <DatumPodnosenja>${today}</DatumPodnosenja>
</CROSOOdjava>`;
      filename = `M2_${emp.jmbg || employee_id}_${today}.xml`;
    }

    return new Response(JSON.stringify({ xml, filename }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
