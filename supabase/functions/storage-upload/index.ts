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

// Sanitize filename
function sanitizeFilename(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  const name = lastDot > 0 ? filename.substring(0, lastDot) : filename;
  const ext = lastDot > 0 ? filename.substring(lastDot) : '';
  
  const sanitized = name
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_.-]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  
  return sanitized + ext.toLowerCase();
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
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: withSecurityHeaders({ ...corsHeaders, 'Content-Type': 'application/json' }),
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
        headers: withSecurityHeaders({ ...corsHeaders, 'Content-Type': 'application/json' }),
      });
    }

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string; // 'logo' | 'document' | 'reminder' | 'invoice'
    const companyId = formData.get('companyId') as string;
    const folderId = formData.get('folderId') as string | null;
    const invoiceId = formData.get('invoiceId') as string | null;

    if (!file || !type || !companyId) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: withSecurityHeaders({ ...corsHeaders, 'Content-Type': 'application/json' }),
      });
    }

    // Verify user owns this company
    const { data: companyData, error: companyError } = await supabase
      .from('companies')
      .select('user_id')
      .eq('id', companyId)
      .single();

    if (companyError || !companyData) {
      return new Response(JSON.stringify({ error: 'Company not found' }), {
        status: 404,
        headers: withSecurityHeaders({ ...corsHeaders, 'Content-Type': 'application/json' }),
      });
    }

    // Check ownership, bookkeeper access, or admin role
    const isOwner = companyData.user_id === user.id;
    const { data: isBookkeeper } = await supabase.rpc('is_company_bookkeeper', { company_id: companyId });
    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    
    if (!isOwner && !isBookkeeper && !isAdmin) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403,
        headers: withSecurityHeaders({ ...corsHeaders, 'Content-Type': 'application/json' }),
      });
    }

    // Build path based on type
    const timestamp = Date.now();
    const safeFilename = sanitizeFilename(file.name);
    let path: string;
    let contentType = file.type || 'application/octet-stream';
    
    switch (type) {
      case 'logo':
        path = `users/${companyData.user_id}/logos/${companyId}/${timestamp}_${safeFilename}`;
        break;
      case 'document':
        const folder = folderId || 'general';
        path = `users/${companyData.user_id}/documents/${companyId}/${folder}/${timestamp}_${safeFilename}`;
        break;
      case 'reminder':
        path = `users/${companyData.user_id}/reminders/${companyId}/${timestamp}_${safeFilename}`;
        break;
      case 'invoice':
        path = `users/${companyData.user_id}/invoices/${companyId}/${invoiceId || 'temp'}_${timestamp}.pdf`;
        contentType = 'application/pdf';
        break;
      default:
        return new Response(JSON.stringify({ error: 'Invalid type' }), {
          status: 400,
          headers: withSecurityHeaders({ ...corsHeaders, 'Content-Type': 'application/json' }),
        });
    }

    // Get file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Upload to DigitalOcean Spaces using s3-lite-client
    const s3Client = getS3Client();
    const bucket = Deno.env.get('DO_SPACES_BUCKET')!;
    const region = Deno.env.get('DO_SPACES_REGION')!;

    // s3-lite-client putObject signature: (objectName, stream, options)
    // For logos, set public-read ACL so they can be accessed directly via URL
    await s3Client.putObject(path, buffer, {
      metadata: { 
        'Content-Type': contentType,
        ...(type === 'logo' && { 'x-amz-acl': 'public-read' }),
      },
    });

    // Build public URL for logos, path for private files
    let url: string;
    if (type === 'logo') {
      // For public files, return CDN URL
      // Note: ACL must be configured via bucket policy on DigitalOcean
      url = `https://${bucket}.${region}.digitaloceanspaces.com/${path}`;
    } else {
      // For private files, just return the path (use storage-download for signed URLs)
      url = path;
    }

    console.log(`Uploaded ${type} to ${path}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        path,
        url,
        type,
        size: file.size,
      }),
      { headers: withSecurityHeaders({ ...corsHeaders, 'Content-Type': 'application/json' }) }
    );

  } catch (err) {
    return createErrorResponse(err, req, { logPrefix: "storage-upload" });
  }
});
