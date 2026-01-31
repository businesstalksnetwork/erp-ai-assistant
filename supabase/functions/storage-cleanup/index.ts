import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CleanupRequest {
  dryRun?: boolean;
  buckets?: string[];
}

interface FileInfo {
  bucket: string;
  path: string;
  size?: number;
}

// Default buckets to clean
const DEFAULT_BUCKETS = ['company-logos', 'company-documents', 'reminder-attachments', 'invoice-pdfs'];

// deno-lint-ignore no-explicit-any
async function listAllFiles(supabase: any, bucket: string): Promise<FileInfo[]> {
  const files: FileInfo[] = [];
  
  // List root level
  const { data: rootItems, error: rootError } = await supabase.storage
    .from(bucket)
    .list('', { limit: 1000 });

  if (rootError) {
    console.error(`Error listing bucket ${bucket}:`, rootError);
    return files;
  }

  if (!rootItems) return files;

  for (const item of rootItems) {
    if (item.id) {
      // It's a file
      files.push({
        bucket,
        path: item.name,
        size: item.metadata?.size,
      });
    } else {
      // It's a folder, list recursively
      const folderFiles = await listFilesRecursively(supabase, bucket, item.name);
      files.push(...folderFiles);
    }
  }

  return files;
}

// deno-lint-ignore no-explicit-any
async function listFilesRecursively(
  supabase: any,
  bucket: string,
  prefix: string
): Promise<FileInfo[]> {
  const files: FileInfo[] = [];

  const { data: items, error } = await supabase.storage
    .from(bucket)
    .list(prefix, { limit: 1000 });

  if (error) {
    console.error(`Error listing ${bucket}/${prefix}:`, error);
    return files;
  }

  if (!items) return files;

  for (const item of items) {
    const fullPath = `${prefix}/${item.name}`;
    if (item.id) {
      // It's a file
      files.push({
        bucket,
        path: fullPath,
        size: item.metadata?.size,
      });
    } else {
      // It's a folder
      const subFiles = await listFilesRecursively(supabase, bucket, fullPath);
      files.push(...subFiles);
    }
  }

  return files;
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

    // Initialize Supabase client with service role for admin access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // First verify the user is admin
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is admin
    const { data: isAdmin } = await userClient.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin',
    });

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use service role client for storage operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const body: CleanupRequest = await req.json().catch(() => ({}));
    const dryRun = body.dryRun ?? true; // Default to dry run for safety
    const buckets = body.buckets ?? DEFAULT_BUCKETS;

    console.log(`Storage cleanup started - dryRun: ${dryRun}, buckets: ${buckets.join(', ')}`);

    // Collect all files to delete
    const allFiles: FileInfo[] = [];
    for (const bucket of buckets) {
      const files = await listAllFiles(supabase, bucket);
      allFiles.push(...files);
      console.log(`Found ${files.length} files in bucket: ${bucket}`);
    }

    if (dryRun) {
      // Just return the list of files that would be deleted
      const summary: Record<string, { count: number; files: string[] }> = {};
      for (const bucket of buckets) {
        const bucketFiles = allFiles.filter(f => f.bucket === bucket);
        summary[bucket] = {
          count: bucketFiles.length,
          files: bucketFiles.map(f => f.path),
        };
      }

      return new Response(
        JSON.stringify({
          dryRun: true,
          totalFiles: allFiles.length,
          summary,
          message: 'Dry run complete. Set dryRun: false to execute deletion.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Actually delete files
    const results: { bucket: string; deleted: number; errors: string[] }[] = [];

    for (const bucket of buckets) {
      const bucketFiles = allFiles.filter(f => f.bucket === bucket);
      const filePaths = bucketFiles.map(f => f.path);
      
      if (filePaths.length === 0) {
        results.push({ bucket, deleted: 0, errors: [] });
        continue;
      }

      // Delete in batches of 100
      const batchSize = 100;
      let deleted = 0;
      const errors: string[] = [];

      for (let i = 0; i < filePaths.length; i += batchSize) {
        const batch = filePaths.slice(i, i + batchSize);
        const { data, error } = await supabase.storage.from(bucket).remove(batch);
        
        if (error) {
          console.error(`Error deleting from ${bucket}:`, error);
          errors.push(error.message);
        } else if (data) {
          deleted += data.length;
        }
      }

      results.push({ bucket, deleted, errors });
      console.log(`Bucket ${bucket}: deleted ${deleted} files, ${errors.length} errors`);
    }

    const totalDeleted = results.reduce((sum, r) => sum + r.deleted, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

    return new Response(
      JSON.stringify({
        dryRun: false,
        totalDeleted,
        totalErrors,
        results,
        message: `Cleanup complete. Deleted ${totalDeleted} files with ${totalErrors} errors.`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const error = err as Error;
    console.error('Storage cleanup error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Cleanup failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
