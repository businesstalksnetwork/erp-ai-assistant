import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/error-handler.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (Deno.env.get("ENVIRONMENT") === "production") {
      // In production, still allow but enforce strict auth below
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }),
      });
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await callerClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }),
      });
    }
    const caller = { id: claimsData.claims.sub as string };

    const { data: isSA } = await supabase.rpc("is_super_admin", { _user_id: caller.id });
    if (!isSA) {
      return new Response(JSON.stringify({ error: "Forbidden: Super Admin only" }), {
        status: 403, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }),
      });
    }

    const { tenant_id, email, password, full_name } = await req.json();

    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { full_name },
    });

    if (authErr) throw authErr;

    const userId = authData.user.id;
    await supabase.from("profiles").update({ full_name }).eq("id", userId);
    await supabase.from("user_roles").insert({ user_id: userId, role: "admin" });
    await supabase.from("tenant_members").insert({ tenant_id, user_id: userId, role: "admin", status: "active" });

    return new Response(
      JSON.stringify({ success: true, user_id: userId }),
      { status: 200, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) }
    );
  } catch (err: any) {
    return createErrorResponse(err, req, { logPrefix: "admin-create-user" });
  }
});
