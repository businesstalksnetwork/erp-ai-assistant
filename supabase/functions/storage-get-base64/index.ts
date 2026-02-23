import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { S3Client } from 'https://deno.land/x/s3_lite_client@0.7.0/mod.ts';
import { encode as base64Encode } from 'https://deno.land/std@0.208.0/encoding/base64.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Initialize S3 client for DigitalOcean Spaces
function getS3Client() {
  const endpoint = Deno.env.get('DO_SPACES_ENDPOINT')!;
  const region = Deno.env.get('DO_SPACES_REGION')!;
  const bucket = Deno.env.get('DO_SPACES_BUCKET')!;
  
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

// Get MIME type from file extension
function getMimeType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
  };
  return mimeTypes[ext || ''] || 'application/octet-stream';
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

    // Parse request body - accept either URL or path
    const { url, path } = await req.json();

    if (!url && !path) {
      return new Response(JSON.stringify({ error: 'Missing url or path parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let filePath = path;
    
    // If URL is provided, extract path from it
    if (url) {
      const bucket = Deno.env.get('DO_SPACES_BUCKET')!;
      const region = Deno.env.get('DO_SPACES_REGION')!;
      const baseUrl = `https://${bucket}.${region}.digitaloceanspaces.com/`;
      
      if (url.startsWith(baseUrl)) {
        filePath = url.replace(baseUrl, '');
      } else {
        return new Response(JSON.stringify({ error: 'Invalid URL - not from our storage' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Verify path belongs to the user or user is bookkeeper
    const pathParts = filePath.split('/');
    if (pathParts[0] !== 'users' || pathParts.length < 2) {
      return new Response(JSON.stringify({ error: 'Invalid path format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const pathUserId = pathParts[1];
    
    // Verify access - either owner or bookkeeper
    if (pathUserId !== user.id) {
      const { data: isBookkeeperFor } = await supabase.rpc('is_bookkeeper_for', { client_user_id: pathUserId });
      if (!isBookkeeperFor) {
        return new Response(JSON.stringify({ error: 'Access denied' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Download file from S3
    const s3Client = getS3Client();
    const response = await s3Client.getObject(filePath);
    
    // Convert to base64
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.body!) {
      chunks.push(chunk);
    }
    
    // Combine all chunks into a single Uint8Array
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    
    const base64 = base64Encode(combined);
    const mimeType = getMimeType(filePath);
    const dataUrl = `data:${mimeType};base64,${base64}`;

    console.log(`Converted ${filePath} to base64 (${combined.length} bytes)`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        dataUrl,
        mimeType,
        size: combined.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const error = err as Error;
    console.error('Storage get-base64 error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to get file' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
