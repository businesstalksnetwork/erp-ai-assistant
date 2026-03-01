import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the caller
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { tenant_id } = await req.json();
    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user is a member of the tenant
    const adminClient = createClient(supabaseUrl, supabaseKey);
    const { data: membership } = await adminClient
      .from("tenant_members")
      .select("id")
      .eq("tenant_id", tenant_id)
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Not a member of this tenant" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Run tier calculation using the user's JWT so assert_tenant_member works
    const { error: tierError } = await userClient.rpc("calculate_partner_tiers", {
      p_tenant_id: tenant_id,
    });
    if (tierError) {
      console.error("Tier calculation error:", tierError);
      return new Response(JSON.stringify({ error: tierError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Run dormancy detection
    const { error: dormancyError } = await userClient.rpc("detect_partner_dormancy", {
      p_tenant_id: tenant_id,
    });
    if (dormancyError) {
      console.error("Dormancy detection error:", dormancyError);
      return new Response(JSON.stringify({ error: dormancyError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Run quote expiry
    const { data: expiredCount, error: expiryError } = await userClient.rpc("expire_overdue_quotes", {
      p_tenant_id: tenant_id,
    });
    if (expiryError) {
      console.error("Quote expiry error:", expiryError);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Tiers calculated, dormancy detected, quotes expired", expired_quotes: expiredCount || 0 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("crm-tier-refresh error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
