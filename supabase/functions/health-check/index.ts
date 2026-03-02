/**
 * BC-01: Health Check Edge Function
 * ISO 22301 — Business Continuity: checks DB, Storage, and AI Gateway availability.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";

Deno.serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  const corsHeaders = getCorsHeaders(req);
  const started = Date.now();

  const checks: Record<string, { status: string; latency_ms: number; error?: string }> = {};

  // 1. Database check
  try {
    const dbStart = Date.now();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);
    const { error } = await sb.from("tenants").select("id").limit(1);
    checks.database = {
      status: error ? "degraded" : "healthy",
      latency_ms: Date.now() - dbStart,
      ...(error && { error: error.message }),
    };
  } catch (e) {
    checks.database = { status: "down", latency_ms: Date.now() - started, error: String(e) };
  }

  // 2. Storage check
  try {
    const storageStart = Date.now();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);
    const { error } = await sb.storage.listBuckets();
    checks.storage = {
      status: error ? "degraded" : "healthy",
      latency_ms: Date.now() - storageStart,
      ...(error && { error: error.message }),
    };
  } catch (e) {
    checks.storage = { status: "down", latency_ms: Date.now() - started, error: String(e) };
  }

  // 3. AI Gateway check (OpenAI-compatible endpoint)
  try {
    const aiStart = Date.now();
    const aiKey = Deno.env.get("OPENAI_API_KEY");
    if (!aiKey) {
      checks.ai_gateway = { status: "unconfigured", latency_ms: 0 };
    } else {
      const resp = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${aiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      checks.ai_gateway = {
        status: resp.ok ? "healthy" : "degraded",
        latency_ms: Date.now() - aiStart,
        ...(!resp.ok && { error: `HTTP ${resp.status}` }),
      };
    }
  } catch (e) {
    checks.ai_gateway = { status: "down", latency_ms: Date.now() - started, error: String(e) };
  }

  const allHealthy = Object.values(checks).every((c) => c.status === "healthy" || c.status === "unconfigured");
  const overall = allHealthy ? "healthy" : "degraded";

  return new Response(
    JSON.stringify({
      status: overall,
      timestamp: new Date().toISOString(),
      total_latency_ms: Date.now() - started,
      checks,
    }),
    {
      status: overall === "healthy" ? 200 : 503,
      headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }),
    }
  );
});
