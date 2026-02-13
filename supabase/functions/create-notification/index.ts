import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // JWT validation
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: caller }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const {
      tenant_id,
      target_user_ids,
      type = "info",
      category,
      title,
      message,
      entity_type,
      entity_id,
    } = await req.json();

    if (!tenant_id || !category || !title || !message) {
      return new Response(
        JSON.stringify({ error: "tenant_id, category, title, message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Resolve target users
    let userIds: string[] = [];

    if (target_user_ids === "all_tenant_members" || !target_user_ids) {
      // Get all users belonging to this tenant
      const { data: members } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("tenant_id", tenant_id);
      userIds = members?.map((m) => m.user_id) ?? [];
    } else if (Array.isArray(target_user_ids)) {
      userIds = target_user_ids;
    } else {
      userIds = [target_user_ids];
    }

    if (userIds.length === 0) {
      return new Response(
        JSON.stringify({ count: 0, message: "No target users found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check user preferences to filter out disabled categories
    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select("user_id")
      .in("user_id", userIds)
      .eq("category", category)
      .eq("enabled", false);

    const disabledUserIds = new Set(prefs?.map((p) => p.user_id) ?? []);
    const filteredUserIds = userIds.filter((id) => !disabledUserIds.has(id));

    if (filteredUserIds.length === 0) {
      return new Response(
        JSON.stringify({ count: 0, message: "All target users have disabled this category" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert notifications
    const rows = filteredUserIds.map((user_id) => ({
      tenant_id,
      user_id,
      type,
      category,
      title,
      message,
      entity_type: entity_type || null,
      entity_id: entity_id || null,
    }));

    const { error, data } = await supabase.from("notifications").insert(rows).select("id");

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ count: data?.length ?? 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
