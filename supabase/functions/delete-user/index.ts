import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/error-handler.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('Authorization');
  return authHeader?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const token = getBearerToken(req);
    if (!token) return new Response(JSON.stringify({ error: 'Nije autorizovano' }), { status: 401, headers: withSecurityHeaders({ ...corsHeaders, 'Content-Type': 'application/json' }) });

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: { user }, error: authErr } = await anonClient.auth.getUser();
    if (authErr || !user) return new Response(JSON.stringify({ error: 'Nije autorizovano' }), { status: 401, headers: withSecurityHeaders({ ...corsHeaders, 'Content-Type': 'application/json' }) });

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roles } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin');
    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ error: 'Samo admin može brisati korisnike' }), { status: 403, headers: withSecurityHeaders({ ...corsHeaders, 'Content-Type': 'application/json' }) });
    }

    const { userId } = await req.json();
    if (!userId) return new Response(JSON.stringify({ error: 'userId je obavezan' }), { status: 400, headers: withSecurityHeaders({ ...corsHeaders, 'Content-Type': 'application/json' }) });
    if (userId === user.id) return new Response(JSON.stringify({ error: 'Ne možete obrisati sopstveni nalog' }), { status: 400, headers: withSecurityHeaders({ ...corsHeaders, 'Content-Type': 'application/json' }) });

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;

    return new Response(JSON.stringify({ success: true, message: 'Korisnik je uspešno obrisan' }), { status: 200, headers: withSecurityHeaders({ ...corsHeaders, 'Content-Type': 'application/json' }) });
  } catch (err) {
    return createErrorResponse(err, req, { logPrefix: "delete-user" });
  }
});
