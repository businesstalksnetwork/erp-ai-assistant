import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Authenticate the user using getClaims
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Nije autorizovano' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Validate the JWT using getClaims
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.error('Auth claims error:', claimsError);
      return new Response(
        JSON.stringify({ error: 'Nije autorizovano' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const currentUserId = claimsData.claims.sub as string;
    console.log(`Delete user request from user: ${currentUserId}`);

    // Create admin client with service role key for role checking
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check if current user is admin
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', currentUserId)
      .eq('role', 'admin');

    if (rolesError || !roles || roles.length === 0) {
      console.error('Not admin:', rolesError);
      return new Response(
        JSON.stringify({ error: 'Samo admin može brisati korisnike' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get userId from request body
    const { userId } = await req.json();
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId je obavezan' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prevent admin from deleting themselves
    if (userId === currentUserId) {
      return new Response(
        JSON.stringify({ error: 'Ne možete obrisati sopstveni nalog' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Delete user from auth (this will cascade to profiles due to foreign key)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error('Delete error:', deleteError);
      return new Response(
        JSON.stringify({ error: 'Greška pri brisanju korisnika: ' + deleteError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`User ${userId} deleted by admin ${currentUserId}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Korisnik je uspešno obrisan' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Neočekivana greška' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
