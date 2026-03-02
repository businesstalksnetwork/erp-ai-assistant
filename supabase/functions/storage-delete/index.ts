import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { S3Client } from 'https://deno.land/x/s3_lite_client@0.7.0/mod.ts';
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

// Initialize S3 client for DigitalOcean Spaces
function getS3Client() {
  const endpoint = Deno.env.get('DO_SPACES_ENDPOINT')!;
  const region = Deno.env.get('DO_SPACES_REGION')!;
  const bucket = Deno.env.get('DO_SPACES_BUCKET')!;
  
  // s3-lite-client expects endpoint without protocol
  const cleanEndpoint = endpoint.replace('https://', '').replace('http://', '');
  
  return new S3Client({
    endPoint: cleanEndpoint,
    port: 443,
    useSSL: true,
    region,
    bucket,
    accessKey: Deno.env.get('DO_SPACES_KEY')!,
    secretKey: Deno.env.get('DO_SPACES_SECRET')!,
    pathStyle: false,
  });
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get auth token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body - can be single path or array of paths
    const body = await req.json();
    const paths: string[] = Array.isArray(body.paths) ? body.paths : [body.path];

    if (!paths || paths.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing path(s) parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify all paths belong to the user
    for (const path of paths) {
      const pathParts = path.split('/');
      if (pathParts[0] !== 'users' || pathParts.length < 2) {
        return new Response(JSON.stringify({ error: `Invalid path format: ${path}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const pathUserId = pathParts[1];
      if (pathUserId !== user.id) {
        // Check if user is bookkeeper for the company owner
        const { data: isBookkeeperFor } = await supabase.rpc('is_bookkeeper_for', { client_user_id: pathUserId });
        if (!isBookkeeperFor) {
          return new Response(JSON.stringify({ error: `Access denied for path: ${path}` }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    // Delete from DigitalOcean Spaces using s3-lite-client
    const s3Client = getS3Client();

    // Delete files one by one (s3-lite-client doesn't have batch delete)
    const deleteResults: { path: string; success: boolean; error?: string }[] = [];
    
    for (const path of paths) {
      try {
        await s3Client.deleteObject(path);
        deleteResults.push({ path, success: true });
      } catch (err) {
        const error = err as Error;
        deleteResults.push({ path, success: false, error: error.message });
      }
    }

    const successCount = deleteResults.filter(r => r.success).length;
    const failCount = deleteResults.filter(r => !r.success).length;

    console.log(`Deleted ${successCount} file(s), ${failCount} failed`);

    return new Response(
      JSON.stringify({ 
        success: failCount === 0, 
        deleted: deleteResults.filter(r => r.success).map(r => r.path),
        failed: deleteResults.filter(r => !r.success),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const error = err as Error;
    console.error('Storage delete error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Delete failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
