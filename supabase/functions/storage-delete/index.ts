import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { S3Client, DeleteObjectCommand, DeleteObjectsCommand } from 'https://esm.sh/@aws-sdk/client-s3@3.712.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize S3 client for DigitalOcean Spaces
function getS3Client() {
  const endpoint = Deno.env.get('DO_SPACES_ENDPOINT')!;
  const region = Deno.env.get('DO_SPACES_REGION')!;
  
  return new S3Client({
    endpoint: endpoint.startsWith('https://') ? endpoint : `https://${endpoint}`,
    region,
    credentials: {
      accessKeyId: Deno.env.get('DO_SPACES_KEY')!,
      secretAccessKey: Deno.env.get('DO_SPACES_SECRET')!,
    },
    forcePathStyle: false,
  });
}

Deno.serve(async (req) => {
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

    // Delete from DigitalOcean Spaces
    const s3Client = getS3Client();
    const bucket = Deno.env.get('DO_SPACES_BUCKET')!;

    if (paths.length === 1) {
      // Single file delete
      const command = new DeleteObjectCommand({
        Bucket: bucket,
        Key: paths[0],
      });
      await s3Client.send(command);
    } else {
      // Batch delete
      const command = new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: paths.map(key => ({ Key: key })),
          Quiet: true,
        },
      });
      await s3Client.send(command);
    }

    console.log(`Deleted ${paths.length} file(s)`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        deleted: paths,
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
