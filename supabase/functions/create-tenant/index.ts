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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is super_admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: isSA } = await supabase.rpc("is_super_admin", { _user_id: caller.id });
    if (!isSA) {
      return new Response(JSON.stringify({ error: "Forbidden: Super Admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { tenant_name, slug, plan, legal_entity, admin_user } = body;

    // 1. Create tenant
    const { data: tenant, error: tenantErr } = await supabase
      .from("tenants")
      .insert({ name: tenant_name, slug, plan, status: "trial" })
      .select()
      .single();

    if (tenantErr) throw tenantErr;

    // 2. Create legal entity
    if (legal_entity) {
      const { error: leErr } = await supabase.from("legal_entities").insert({
        tenant_id: tenant.id,
        name: legal_entity.name || tenant_name,
        pib: legal_entity.pib || null,
        maticni_broj: legal_entity.maticni_broj || null,
        address: legal_entity.address || null,
        city: legal_entity.city || null,
        country: legal_entity.country || "RS",
      });
      if (leErr) console.error("Legal entity error:", leErr);
    }

    // 3. Create admin auth user
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email: admin_user.email,
      password: admin_user.password,
      email_confirm: true,
      user_metadata: { full_name: admin_user.full_name },
    });

    if (authErr) throw authErr;

    const userId = authData.user.id;

    // 4. Profile is auto-created by handle_new_user trigger, but update full_name
    await supabase.from("profiles").update({ full_name: admin_user.full_name }).eq("id", userId);

    // 5. Add admin role (trigger already adds 'user', so add 'admin')
    await supabase.from("user_roles").insert({ user_id: userId, role: "admin" });

    // 6. Add tenant membership
    await supabase.from("tenant_members").insert({
      tenant_id: tenant.id,
      user_id: userId,
      role: "admin",
      status: "active",
    });

    // 7. Seed modules based on plan
    const { data: allModules } = await supabase.from("module_definitions").select("id, key").order("sort_order");

    if (allModules && allModules.length > 0) {
      const planModules: Record<string, string[]> = {
        basic: ["accounting", "sales"],
        professional: ["accounting", "sales", "inventory", "hr", "crm"],
        enterprise: allModules.map((m) => m.key),
      };

      const enabledKeys = planModules[plan] || planModules.basic;
      const modulesToInsert = allModules
        .filter((m) => enabledKeys.includes(m.key))
        .map((m) => ({ tenant_id: tenant.id, module_id: m.id, is_enabled: true }));

      if (modulesToInsert.length > 0) {
        await supabase.from("tenant_modules").insert(modulesToInsert);
      }
    }

    return new Response(
      JSON.stringify({ success: true, tenant_id: tenant.id, user_id: userId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("create-tenant error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
