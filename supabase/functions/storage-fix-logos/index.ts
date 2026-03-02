import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { S3Client } from 'https://deno.land/x/s3_lite_client@0.7.0/mod.ts';
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

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

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
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

    // Initialize Supabase client with service role for admin access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is admin
    const supabaseAnon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    
    const { data: { user }, error: userError } = await supabaseAnon.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is admin
    const { data: isAdmin } = await supabase.rpc('has_role', { 
      _user_id: user.id, 
      _role: 'admin' 
    });
    
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const { dryRun = true } = await req.json().catch(() => ({}));
    
    const bucket = Deno.env.get('DO_SPACES_BUCKET')!;
    
    // Fetch all companies with DO Spaces logo URLs
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('id, name, logo_url')
      .like('logo_url', `https://${bucket}%`);

    if (companiesError) {
      throw new Error(`Failed to fetch companies: ${companiesError.message}`);
    }

    console.log(`Found ${companies?.length || 0} companies with DO Spaces logos`);

    const results: { company: string; path: string; status: string }[] = [];
    const s3Client = getS3Client();

    for (const company of companies || []) {
      if (!company.logo_url) continue;

      try {
        // Extract path from URL
        // URL format: https://bucket.region.digitaloceanspaces.com/path/to/file
        const url = new URL(company.logo_url);
        const path = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;

        console.log(`Processing: ${company.name} - ${path}`);

        if (dryRun) {
          results.push({
            company: company.name,
            path,
            status: 'would_fix',
          });
          continue;
        }

        // Download the file
        const response = await s3Client.getObject(path);
        const data = new Uint8Array(await response.arrayBuffer());

        // Determine content type from path
        const ext = path.split('.').pop()?.toLowerCase();
        const contentTypes: Record<string, string> = {
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'gif': 'image/gif',
          'webp': 'image/webp',
          'svg': 'image/svg+xml',
        };
        const contentType = contentTypes[ext || ''] || 'application/octet-stream';

        // Re-upload with public-read ACL
        await s3Client.putObject(path, data, {
          metadata: {
            'Content-Type': contentType,
            'x-amz-acl': 'public-read',
          },
        });

        console.log(`Fixed: ${company.name}`);
        results.push({
          company: company.name,
          path,
          status: 'fixed',
        });

      } catch (err) {
        const error = err as Error;
        console.error(`Error fixing ${company.name}:`, error.message);
        results.push({
          company: company.name,
          path: company.logo_url,
          status: `error: ${error.message}`,
        });
      }
    }

    const fixed = results.filter(r => r.status === 'fixed').length;
    const wouldFix = results.filter(r => r.status === 'would_fix').length;
    const errors = results.filter(r => r.status.startsWith('error')).length;

    return new Response(
      JSON.stringify({
        success: true,
        dryRun,
        summary: {
          total: results.length,
          fixed,
          wouldFix,
          errors,
        },
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const error = err as Error;
    console.error('Storage fix logos error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Fix failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
