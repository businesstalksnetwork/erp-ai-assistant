import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

async function getUserIdFromAuthApi(opts: { supabaseUrl: string; anonKey: string; token: string }): Promise<string> {
  const res = await fetch(`${opts.supabaseUrl}/auth/v1/user`, {
    method: 'GET',
    headers: {
      apikey: opts.anonKey,
      Authorization: `Bearer ${opts.token}`,
      'Content-Type': 'application/json',
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`auth/v1/user failed: ${res.status} ${text}`);
  }
  const data = JSON.parse(text) as { id?: string };
  if (!data?.id) {
    throw new Error('auth/v1/user missing id');
  }
  return data.id;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const token = getBearerToken(req);
    if (!token) {
      return new Response(JSON.stringify({ error: 'Nije autorizovano' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let currentUserId: string;
    try {
      currentUserId = await getUserIdFromAuthApi({ supabaseUrl, anonKey: supabaseAnonKey, token });
    } catch (e) {
      console.error('Auth token validation error:', e);
      return new Response(JSON.stringify({ error: 'Nije autorizovano' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Check if current user is admin
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', currentUserId)
      .eq('role', 'admin');

    if (rolesError || !roles || roles.length === 0) {
      console.error('Not admin:', rolesError);
      return new Response(JSON.stringify({ error: 'Samo admin može brisati korisnike' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { userId } = await req.json();
    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId je obavezan' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (userId === currentUserId) {
      return new Response(JSON.stringify({ error: 'Ne možete obrisati sopstveni nalog' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error('Delete error:', deleteError);
      return new Response(JSON.stringify({ error: 'Greška pri brisanju korisnika: ' + deleteError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, message: 'Korisnik je uspešno obrisan' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Neočekivana greška' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
