import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/error-handler.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { tenant_id, fiscal_period_id } = await req.json();
    if (!tenant_id || !fiscal_period_id) {
      return new Response(JSON.stringify({ error: "Missing parameters" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Verify membership
    const { data: member } = await supabase.from("tenant_members").select("id").eq("tenant_id", tenant_id).eq("user_id", user.id).eq("status", "active").limit(1).single();
    if (!member) {
      return new Response(JSON.stringify({ error: "Not a tenant member" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get fiscal period
    const { data: period } = await supabase.from("fiscal_periods").select("*").eq("id", fiscal_period_id).single();
    if (!period) {
      return new Response(JSON.stringify({ error: "Period not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const checks: Array<{ check: string; status: string; severity: string; message: string; count?: number }> = [];

    // 1. Draft journal entries
    const { count: draftJE } = await supabase.from("journal_entries")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenant_id).eq("status", "draft")
      .gte("entry_date", period.start_date).lte("entry_date", period.end_date);
    checks.push({
      check: "draft_journal_entries", count: draftJE || 0,
      status: (draftJE || 0) === 0 ? "pass" : "fail",
      severity: (draftJE || 0) > 0 ? "error" : "info",
      message: (draftJE || 0) === 0 ? "All journal entries are posted" : `${draftJE} draft journal entries remain`,
    });

    // 2. Unreconciled bank statements
    const { count: unreconciledBS } = await supabase.from("bank_statements")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenant_id).neq("status", "reconciled")
      .gte("statement_date", period.start_date).lte("statement_date", period.end_date);
    checks.push({
      check: "unreconciled_bank_statements", count: unreconciledBS || 0,
      status: (unreconciledBS || 0) === 0 ? "pass" : "fail",
      severity: (unreconciledBS || 0) > 0 ? "warning" : "info",
      message: (unreconciledBS || 0) === 0 ? "All bank statements reconciled" : `${unreconciledBS} unreconciled bank statements`,
    });

    // 3. PDV periods submitted
    const { count: unsubmittedPDV } = await supabase.from("pdv_periods")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenant_id).eq("status", "draft")
      .gte("start_date", period.start_date).lte("end_date", period.end_date);
    checks.push({
      check: "pdv_periods_submitted", count: unsubmittedPDV || 0,
      status: (unsubmittedPDV || 0) === 0 ? "pass" : "fail",
      severity: (unsubmittedPDV || 0) > 0 ? "error" : "info",
      message: (unsubmittedPDV || 0) === 0 ? "All PDV periods submitted" : `${unsubmittedPDV} PDV periods not yet submitted`,
    });

    // 4. Draft invoices
    const { count: draftInv } = await supabase.from("invoices")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenant_id).eq("status", "draft")
      .gte("invoice_date", period.start_date).lte("invoice_date", period.end_date);
    checks.push({
      check: "draft_invoices", count: draftInv || 0,
      status: (draftInv || 0) === 0 ? "pass" : "fail",
      severity: (draftInv || 0) > 0 ? "warning" : "info",
      message: (draftInv || 0) === 0 ? "No draft invoices" : `${draftInv} draft invoices remain`,
    });

    // 5. Fixed assets depreciation check
    const { count: activeAssets } = await supabase.from("fixed_assets")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenant_id).eq("status", "active");
    checks.push({
      check: "fixed_assets_depreciation", count: activeAssets || 0,
      status: "info",
      severity: "info",
      message: `${activeAssets || 0} active fixed assets - ensure monthly depreciation has been run`,
    });

    const passCount = checks.filter(c => c.status === "pass").length;
    const failCount = checks.filter(c => c.status === "fail").length;
    const readiness = failCount === 0 ? "ready" : "not_ready";

    // AI summary
    let aiSummary = "";
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (LOVABLE_API_KEY) {
      try {
        const checksSummary = checks.map(c => `${c.check}: ${c.status} - ${c.message}`).join("\n");
        const aiRes = await fetch("https://api.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${LOVABLE_API_KEY}` },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: `You are a Serbian accounting expert. Summarize this year-end readiness check in 2-3 sentences. Be specific about what needs to be fixed.\n\nChecks:\n${checksSummary}\n\nRespond in Serbian.` }],
            temperature: 0.3,
          }),
        });
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          aiSummary = aiData.choices?.[0]?.message?.content || "";
        }
      } catch (e) {
        console.warn("AI summary failed:", e);
      }
    }

    // CR7-06: Audit log for AI year-end check
    try {
      await supabase.from("ai_action_log").insert({
        tenant_id: tenant_id,
        user_id: user.id,
        action_type: "year_end_check",
        module: "accounting",
        model_version: LOVABLE_API_KEY ? "gpt-4o-mini" : "rule-based",
        user_decision: "auto",
        reasoning: `Year-end check: ${passCount} passed, ${failCount} failed, readiness=${readiness}`,
      });
    } catch (e) {
      console.warn("Failed to log AI action:", e);
    }

    return new Response(JSON.stringify({
      readiness, checks, pass_count: passCount, fail_count: failCount,
      total_checks: checks.length, ai_summary: aiSummary,
    }), { headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });
  } catch (error) {
    return createErrorResponse(error, req, { logPrefix: "ai-year-end-check error" });
  }
});
