import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;
  const corsHeaders = getCorsHeaders(req);
  
  console.log('sef-continue-sync: Checking for partial jobs to continue...');
  
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Find partial jobs that haven't been updated in the last 30 seconds
    // (to avoid picking up jobs that are still being processed)
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString();
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    
    const { data: partialJobs, error: fetchError } = await supabase
      .from('sef_sync_jobs')
      .select('id, company_id, invoice_type, total_months, last_processed_month, updated_at')
      .eq('status', 'partial')
      .lt('updated_at', thirtySecondsAgo) // Not updated in last 30 seconds
      .order('updated_at', { ascending: true })
      .limit(1);
    
    if (fetchError) {
      console.error('Error fetching partial jobs:', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!partialJobs || partialJobs.length === 0) {
      console.log('No partial jobs to continue');
      return new Response(
        JSON.stringify({ success: true, message: 'No partial jobs to continue' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const job = partialJobs[0];
    console.log(`Found partial job: ${job.id}, last updated: ${job.updated_at}`);
    
    // Check if job is stale (no activity for 10+ minutes)
    if (job.updated_at && new Date(job.updated_at) < new Date(tenMinutesAgo)) {
      console.log(`Job ${job.id} is stale (no activity for 10+ min). Marking as failed.`);
      
      await supabase
        .from('sef_sync_jobs')
        .update({
          status: 'failed',
          error_message: 'Timeout - nema aktivnosti 10+ minuta',
          completed_at: new Date().toISOString(),
        })
        .eq('id', job.id);
      
      return new Response(
        JSON.stringify({ success: true, markedFailed: job.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Continue the job by calling sef-long-sync with continueJobId
    // Pass internal cron token for authorization
    const cronToken = Deno.env.get('CHECKPOINT_API_TOKEN');
    console.log(`Continuing job ${job.id} with internal auth token...`);
    
    const { error: invokeError } = await supabase.functions.invoke('sef-long-sync', {
      body: {
        continueJobId: job.id,
      },
      headers: {
        'x-cron-token': cronToken || '',
      },
    });
    
    if (invokeError) {
      console.error('Error invoking sef-long-sync:', invokeError);
      return new Response(
        JSON.stringify({ success: false, error: invokeError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Successfully triggered continuation for job ${job.id}`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        continued: job.id,
        lastProcessedMonth: job.last_processed_month
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error in sef-continue-sync:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
