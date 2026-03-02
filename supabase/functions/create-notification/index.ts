import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/error-handler.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });
    }
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: caller }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });
    }

    const { tenant_id, target_user_ids, type = "info", category, title, message, entity_type, entity_id } = await req.json();

    if (!tenant_id || !category || !title || !message) {
      return new Response(JSON.stringify({ error: "tenant_id, category, title, message are required" }), { status: 400, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: membership } = await supabase.from("tenant_members").select("id").eq("user_id", caller.id).eq("tenant_id", tenant_id).eq("status", "active").maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: "Forbidden: not a member of this tenant" }), { status: 403, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });
    }

    let userIds: string[] = [];
    if (target_user_ids === "all_tenant_members" || !target_user_ids) {
      const { data: members } = await supabase.from("user_roles").select("user_id").eq("tenant_id", tenant_id);
      userIds = members?.map((m) => m.user_id) ?? [];
    } else if (Array.isArray(target_user_ids)) {
      userIds = target_user_ids;
    } else {
      userIds = [target_user_ids];
    }

    if (userIds.length === 0) {
      return new Response(JSON.stringify({ count: 0, message: "No target users found" }), { headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });
    }

    const { data: prefs } = await supabase.from("notification_preferences").select("user_id").in("user_id", userIds).eq("category", category).eq("enabled", false);
    const disabledUserIds = new Set(prefs?.map((p) => p.user_id) ?? []);
    const filteredUserIds = userIds.filter((id) => !disabledUserIds.has(id));

    if (filteredUserIds.length === 0) {
      return new Response(JSON.stringify({ count: 0, message: "All target users have disabled this category" }), { headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });
    }

    const rows = filteredUserIds.map((user_id) => ({
      tenant_id, user_id, type, category, title, message, entity_type: entity_type || null, entity_id: entity_id || null,
    }));

    const { error, data } = await supabase.from("notifications").insert(rows).select("id");
    if (error) throw error;

    return new Response(JSON.stringify({ count: data?.length ?? 0 }), { headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });
  } catch (err) {
    return createErrorResponse(err, req, { logPrefix: "create-notification" });
  }
});
