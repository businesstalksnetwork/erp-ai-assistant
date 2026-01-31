import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { S3Client, GetObjectCommand } from 'https://esm.sh/@aws-sdk/client-s3@3.712.0';
import { getSignedUrl } from 'https://esm.sh/@aws-sdk/s3-request-presigner@3.712.0';

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

    // Parse request body
    const { path, expiresIn = 3600 } = await req.json();

    if (!path) {
      return new Response(JSON.stringify({ error: 'Missing path parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract user_id from path to verify access
    // Path format: users/{user_id}/...
    const pathParts = path.split('/');
    if (pathParts[0] !== 'users' || pathParts.length < 2) {
      return new Response(JSON.stringify({ error: 'Invalid path format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const pathUserId = pathParts[1];
    
    // Verify access - either owner or bookkeeper
    if (pathUserId !== user.id) {
      // Check if user is bookkeeper for the company owner
      const { data: isBookkeeperFor } = await supabase.rpc('is_bookkeeper_for', { client_user_id: pathUserId });
      if (!isBookkeeperFor) {
        return new Response(JSON.stringify({ error: 'Access denied' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Generate presigned URL
    const s3Client = getS3Client();
    const bucket = Deno.env.get('DO_SPACES_BUCKET')!;

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: path,
    });

    // Cap expiration at 7 days
    const safeExpiresIn = Math.min(expiresIn, 60 * 60 * 24 * 7);
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: safeExpiresIn });

    console.log(`Generated signed URL for ${path}, expires in ${safeExpiresIn}s`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        signedUrl,
        expiresIn: safeExpiresIn,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const error = err as Error;
    console.error('Storage download error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to generate download URL' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
