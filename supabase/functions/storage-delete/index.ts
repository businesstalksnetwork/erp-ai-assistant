import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { S3Client } from 'https://deno.land/x/s3_lite_client@0.7.0/mod.ts';
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/error-handler.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";

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
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') { return new Response('ok', { headers: corsHeaders }); }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: withSecurityHeaders({ ...corsHeaders, 'Content-Type': 'application/json' }) });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: withSecurityHeaders({ ...corsHeaders, 'Content-Type': 'application/json' }) });
    }

    const body = await req.json();
    const paths: string[] = Array.isArray(body.paths) ? body.paths : [body.path];
    if (!paths || paths.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing path(s)' }), { status: 400, headers: withSecurityHeaders({ ...corsHeaders, 'Content-Type': 'application/json' }) });
    }

    for (const path of paths) {
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
    }

    const s3Client = getS3Client();
    const deleteResults: { path: string; success: boolean; error?: string }[] = [];
    for (const path of paths) {
      try {
        await s3Client.deleteObject(path);
        deleteResults.push({ path, success: true });
      } catch (err) {
        deleteResults.push({ path, success: false, error: 'Delete failed' });
      }
    }

    return new Response(
      JSON.stringify({ success: deleteResults.every(r => r.success), deleted: deleteResults.filter(r => r.success).map(r => r.path), failed: deleteResults.filter(r => !r.success) }),
      { headers: withSecurityHeaders({ ...corsHeaders, 'Content-Type': 'application/json' }) }
    );
  } catch (err) {
    return createErrorResponse(err, req, { logPrefix: "storage-delete" });
  }
});
