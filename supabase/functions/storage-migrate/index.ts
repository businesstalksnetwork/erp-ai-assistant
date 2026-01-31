import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { S3Client } from 'https://deno.land/x/s3_lite_client@0.7.0/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

interface MigrationResult {
  bucket: string;
  originalPath: string;
  newPath: string;
  success: boolean;
  error?: string;
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

    // Initialize Supabase client with service role for migration
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin user
    const { data: { user }, error: userError } = await supabaseAnon.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is admin
    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { dryRun = true } = await req.json();
    const results: MigrationResult[] = [];
    const s3Client = getS3Client();
    const bucket = Deno.env.get('DO_SPACES_BUCKET')!;
    const region = Deno.env.get('DO_SPACES_REGION')!;

    console.log(`Starting migration (dryRun: ${dryRun})`);

    // 1. Migrate company logos
    const { data: companies } = await supabase
      .from('companies')
      .select('id, user_id, logo_url')
      .not('logo_url', 'is', null);

    for (const company of companies || []) {
      if (!company.logo_url || company.logo_url.includes('digitaloceanspaces.com')) continue;

      try {
        // Download from Supabase Storage
        const pathMatch = company.logo_url.match(/company-logos\/(.+)$/);
        if (!pathMatch) continue;

        const oldPath = pathMatch[1];
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('company-logos')
          .download(oldPath);

        if (downloadError) {
          results.push({
            bucket: 'company-logos',
            originalPath: oldPath,
            newPath: '',
            success: false,
            error: downloadError.message,
          });
          continue;
        }

        const newPath = `users/${company.user_id}/logos/${company.id}/${Date.now()}_${oldPath.split('/').pop()}`;

        if (!dryRun) {
          // Upload to DigitalOcean Spaces using s3-lite-client
          const buffer = new Uint8Array(await fileData.arrayBuffer());
          await s3Client.putObject(newPath, buffer, {
            metadata: { 'Content-Type': fileData.type || 'image/png' },
          });

          // Update database
          const newUrl = `https://${bucket}.${region}.digitaloceanspaces.com/${newPath}`;
          await supabase
            .from('companies')
            .update({ logo_url: newUrl })
            .eq('id', company.id);
        }

        results.push({
          bucket: 'company-logos',
          originalPath: oldPath,
          newPath,
          success: true,
        });
      } catch (err) {
        const error = err as Error;
        results.push({
          bucket: 'company-logos',
          originalPath: company.logo_url,
          newPath: '',
          success: false,
          error: error.message,
        });
      }
    }

    // 2. Migrate documents
    const { data: documents } = await supabase
      .from('documents')
      .select('id, company_id, file_path, name');

    for (const doc of documents || []) {
      if (doc.file_path.startsWith('users/')) continue; // Already migrated

      try {
        // Get company user_id
        const { data: company } = await supabase
          .from('companies')
          .select('user_id')
          .eq('id', doc.company_id)
          .single();

        if (!company) continue;

        const { data: fileData, error: downloadError } = await supabase.storage
          .from('company-documents')
          .download(doc.file_path);

        if (downloadError) {
          results.push({
            bucket: 'company-documents',
            originalPath: doc.file_path,
            newPath: '',
            success: false,
            error: downloadError.message,
          });
          continue;
        }

        const newPath = `users/${company.user_id}/documents/${doc.file_path}`;

        if (!dryRun) {
          const buffer = new Uint8Array(await fileData.arrayBuffer());
          await s3Client.putObject(newPath, buffer, {
            metadata: { 'Content-Type': fileData.type || 'application/octet-stream' },
          });

          await supabase
            .from('documents')
            .update({ file_path: newPath })
            .eq('id', doc.id);
        }

        results.push({
          bucket: 'company-documents',
          originalPath: doc.file_path,
          newPath,
          success: true,
        });
      } catch (err) {
        const error = err as Error;
        results.push({
          bucket: 'company-documents',
          originalPath: doc.file_path,
          newPath: '',
          success: false,
          error: error.message,
        });
      }
    }

    // 3. Migrate reminder attachments
    const { data: reminders } = await supabase
      .from('payment_reminders')
      .select('id, company_id, attachment_url')
      .not('attachment_url', 'is', null);

    for (const reminder of reminders || []) {
      if (!reminder.attachment_url || reminder.attachment_url.startsWith('users/')) continue;

      try {
        const { data: company } = await supabase
          .from('companies')
          .select('user_id')
          .eq('id', reminder.company_id)
          .single();

        if (!company) continue;

        const { data: fileData, error: downloadError } = await supabase.storage
          .from('reminder-attachments')
          .download(reminder.attachment_url);

        if (downloadError) {
          results.push({
            bucket: 'reminder-attachments',
            originalPath: reminder.attachment_url,
            newPath: '',
            success: false,
            error: downloadError.message,
          });
          continue;
        }

        const newPath = `users/${company.user_id}/reminders/${reminder.attachment_url}`;

        if (!dryRun) {
          const buffer = new Uint8Array(await fileData.arrayBuffer());
          await s3Client.putObject(newPath, buffer, {
            metadata: { 'Content-Type': fileData.type || 'application/octet-stream' },
          });

          await supabase
            .from('payment_reminders')
            .update({ attachment_url: newPath })
            .eq('id', reminder.id);
        }

        results.push({
          bucket: 'reminder-attachments',
          originalPath: reminder.attachment_url,
          newPath,
          success: true,
        });
      } catch (err) {
        const error = err as Error;
        results.push({
          bucket: 'reminder-attachments',
          originalPath: reminder.attachment_url,
          newPath: '',
          success: false,
          error: error.message,
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`Migration complete: ${successCount} success, ${failCount} failed`);

    return new Response(
      JSON.stringify({ 
        success: true,
        dryRun,
        summary: {
          total: results.length,
          success: successCount,
          failed: failCount,
        },
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const error = err as Error;
    console.error('Migration error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Migration failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
