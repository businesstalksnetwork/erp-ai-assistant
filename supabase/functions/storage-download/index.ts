import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { S3Client } from 'https://deno.land/x/s3_lite_client@0.7.0/mod.ts';
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/error-handler.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";

// Initialize S3 client for DigitalOcean Spaces
function getS3Client() {
  const endpoint = Deno.env.get('DO_SPACES_ENDPOINT')!;
  const region = Deno.env.get('DO_SPACES_REGION')!;
  const bucket = Deno.env.get('DO_SPACES_BUCKET')!;
  const cleanEndpoint = endpoint.replace('https://', '').replace('http://', '');
  return new S3Client({
    endPoint: cleanEndpoint, port: 443, useSSL: true, region, bucket,
    accessKey: Deno.env.get('DO_SPACES_KEY')!, secretKey: Deno.env.get('DO_SPACES_SECRET')!, pathStyle: false,
  });
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;
  const corsHeaders = getCorsHeaders(req);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: withSecurityHeaders({ ...corsHeaders, 'Content-Type': 'application/json' }) });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, { global: { headers: { Authorization: authHeader } } });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: withSecurityHeaders({ ...corsHeaders, 'Content-Type': 'application/json' }) });
    }

    const { path, expiresIn = 3600 } = await req.json();
    if (!path) {
      return new Response(JSON.stringify({ error: 'Missing path parameter' }), { status: 400, headers: withSecurityHeaders({ ...corsHeaders, 'Content-Type': 'application/json' }) });
    }

    const pathParts = path.split('/');
    if (pathParts[0] !== 'users' || pathParts.length < 2) {
      return new Response(JSON.stringify({ error: 'Invalid path format' }), { status: 400, headers: withSecurityHeaders({ ...corsHeaders, 'Content-Type': 'application/json' }) });
    }

    const pathUserId = pathParts[1];
    if (pathUserId !== user.id) {
      const { data: isBookkeeperFor } = await supabase.rpc('is_bookkeeper_for', { client_user_id: pathUserId });
      if (!isBookkeeperFor) {
        return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: withSecurityHeaders({ ...corsHeaders, 'Content-Type': 'application/json' }) });
      }
    }

    const s3Client = getS3Client();
    const safeExpiresIn = Math.min(expiresIn, 60 * 60 * 24 * 7);
    const signedUrl = await s3Client.getPresignedUrl('GET', path, { expirySeconds: safeExpiresIn });

    return new Response(
      JSON.stringify({ success: true, signedUrl, expiresIn: safeExpiresIn }),
      { headers: withSecurityHeaders({ ...corsHeaders, 'Content-Type': 'application/json' }) }
    );
  } catch (err) {
    return createErrorResponse(err, req, { logPrefix: "storage-download" });
  }
});
