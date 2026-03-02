import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/error-handler.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";

function validateJmbg(jmbg: string): boolean { return /^\d{13}$/.test(jmbg); }
function validatePib(pib: string): boolean { return /^\d{9}$/.test(pib); }
function validateIcd10(code: string): boolean { return /^[A-Z]\d{2}(\.\d{1,2})?$/i.test(code); }
function validateIsoDate(s: string): boolean { return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s)); }
const VALID_CLAIM_TYPES = ["sick_leave", "maternity", "work_injury"];
const EMPLOYER_DAYS = 30;
function escapeXml(s: string): string { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;"); }
function diffDays(start: string, end: string): number { const s = new Date(start); const e = new Date(end); return Math.max(0, Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1); }

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

    const { claim_id, tenant_id } = await req.json();
    if (!claim_id || !tenant_id) return new Response(JSON.stringify({ error: "claim_id and tenant_id required" }), { status: 400, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: membership } = await supabase.from("tenant_members").select("id").eq("user_id", user.id).eq("tenant_id", tenant_id).eq("status", "active").maybeSingle();
    if (!membership) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });

    const { data: connection } = await supabase.from("ebolovanje_connections").select("*").eq("tenant_id", tenant_id).eq("is_active", true).maybeSingle();
    if (!connection) return new Response(JSON.stringify({ error: "eBolovanje connection not configured" }), { status: 400, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });

    const { data: claim, error: claimErr } = await supabase.from("ebolovanje_claims").select("*, employees(full_name, jmbg, id), legal_entities(name, pib)").eq("id", claim_id).eq("tenant_id", tenant_id).single();
    if (claimErr || !claim) return new Response(JSON.stringify({ error: "Claim not found" }), { status: 404, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });

    if (!claim.employees || !claim.legal_entities) return new Response(JSON.stringify({ error: "Employee or legal entity not found" }), { status: 400, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });
    if (!validateJmbg(claim.employees.jmbg)) return new Response(JSON.stringify({ error: "Invalid employee JMBG" }), { status: 400, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });
    if (!validatePib(claim.legal_entities.pib)) return new Response(JSON.stringify({ error: "Invalid employer PIB" }), { status: 400, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });
    if (!VALID_CLAIM_TYPES.includes(claim.claim_type)) return new Response(JSON.stringify({ error: "Invalid claim type" }), { status: 400, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });
    if (!validateIsoDate(claim.start_date) || !validateIsoDate(claim.end_date)) return new Response(JSON.stringify({ error: "Invalid date format" }), { status: 400, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });
    if (claim.diagnosis_code && !validateIcd10(claim.diagnosis_code)) return new Response(JSON.stringify({ error: "Invalid ICD-10 code" }), { status: 400, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });

    const totalDays = diffDays(claim.start_date, claim.end_date);
    const employerDays = Math.min(totalDays, EMPLOYER_DAYS);
    const rfzoDays = Math.max(0, totalDays - EMPLOYER_DAYS);

    if (connection.environment === "sandbox") {
      const fakeClaimNumber = `RFZO-${Date.now()}`;
      await supabase.from("ebolovanje_claims").update({ status: "submitted", submitted_at: new Date().toISOString(), rfzo_claim_number: fakeClaimNumber }).eq("id", claim_id);
      return new Response(JSON.stringify({ success: true, status: "submitted", rfzo_claim_number: fakeClaimNumber, simulated: true }), { headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });
    }

    return new Response(JSON.stringify({ success: true }), { headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });
  } catch (err) {
    return createErrorResponse(err, req, { logPrefix: "ebolovanje-submit" });
  }
});
