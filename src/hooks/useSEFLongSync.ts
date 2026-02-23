// @ts-nocheck
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface SyncJob {
  id: string;
  company_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'partial';
  invoice_type: string;
  total_months: number;
  processed_months: number;
  current_month: string | null;
  last_processed_month: string | null;
  invoices_found: number;
  invoices_saved: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string | null;
}

interface UseSEFLongSyncResult {
  startLongSync: (companyId: string, invoiceType: 'purchase' | 'sales', yearsBack?: number) => Promise<string | null>;
  activeJob: SyncJob | null;
  isStarting: boolean;
  progress: number;
  stopPolling: () => void;
  dismissJobStatus: () => void;
  cancelJob: () => Promise<void>;
}

export function useSEFLongSync(companyId: string | null): UseSEFLongSyncResult {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isStarting, setIsStarting] = useState(false);
  const [activeJob, setActiveJob] = useState<SyncJob | null>(null);
  
  // Use ref for polling interval to avoid re-renders
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Track dismissed job IDs in localStorage AND React state (to prevent race conditions)
  const DISMISSED_JOBS_KEY = 'sef_dismissed_job_ids';
  
  // Initialize dismissed IDs from localStorage into state
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(DISMISSED_JOBS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  
  const addDismissedJobId = useCallback((jobId: string) => {
    setDismissedIds(prev => {
      if (prev.includes(jobId)) return prev;
      // Keep only last 50 dismissed jobs to avoid localStorage bloat
      const updated = [...prev, jobId].slice(-50);
      localStorage.setItem(DISMISSED_JOBS_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Calculate progress percentage
  const progress = activeJob 
    ? Math.round((activeJob.processed_months / Math.max(activeJob.total_months, 1)) * 100)
    : 0;

  // Dismiss job status (for completed/failed jobs) - now persists to localStorage
  const dismissJobStatus = useCallback(() => {
    if (activeJob) {
      addDismissedJobId(activeJob.id);
    }
    setActiveJob(null);
  }, [activeJob, addDismissedJobId]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  // Poll for job status by ID - stable function
  const pollJobStatusById = useCallback(async (jobId: string) => {
    try {
      const { data, error } = await supabase
        .from('sef_sync_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (error) {
        console.error('Error polling job status:', error);
        return;
      }

      const job = data as SyncJob;
      setActiveJob(job);

      if (job.status === 'completed') {
        stopPolling();
        
        // Invalidate queries to refresh invoice list
        queryClient.invalidateQueries({ queryKey: ['sef-invoices'] });
        queryClient.invalidateQueries({ queryKey: ['sef-purchase-invoices'] });
        
        toast({
          title: 'Sinhronizacija završena',
          description: `Pronađeno ${job.invoices_found} faktura, sačuvano ${job.invoices_saved}`,
        });
      } else if (job.status === 'failed') {
        stopPolling();
        toast({
          title: 'Greška pri sinhronizaciji',
          description: job.error_message || 'Nepoznata greška',
          variant: 'destructive',
        });
      } else if (job.status === 'partial') {
        // Partial status - cron will continue automatically
        // Keep polling so user sees continuous progress
        // User doesn't see any difference - just looks like it's still running
        console.log('Job in partial status - cron will continue, keeping poll active');
      }
      // For 'running' or 'pending' - keep polling (default behavior)
    } catch (e) {
      console.error('Poll error:', e);
    }
  }, [stopPolling, queryClient, toast]);

  // Start long sync
  const startLongSync = async (
    companyId: string,
    invoiceType: 'purchase' | 'sales',
    yearsBack: number = 3
  ): Promise<string | null> => {
    setIsStarting(true);

    try {
      const { data, error } = await supabase.functions.invoke('sef-long-sync', {
        body: { companyId, yearsBack, invoiceType }
      });

      if (error) throw error;

      if (!data.success) {
        if (data.jobId) {
          // Already running - start polling existing job
          pollJobStatusById(data.jobId);
          stopPolling();
          pollingIntervalRef.current = setInterval(() => pollJobStatusById(data.jobId), 3000);
          
          toast({
            title: 'Sinhronizacija već u toku',
            description: 'Pratite napredak ispod.',
          });
          return data.jobId;
        }
        throw new Error(data.error || 'Greška pri pokretanju');
      }

      toast({
        title: 'Sinhronizacija pokrenuta',
        description: data.message,
      });

      // Start polling
      pollJobStatusById(data.jobId);
      stopPolling();
      pollingIntervalRef.current = setInterval(() => pollJobStatusById(data.jobId), 3000);

      return data.jobId;
    } catch (e) {
      console.error('Start long sync error:', e);
      toast({
        title: 'Greška',
        description: e instanceof Error ? e.message : 'Nepoznata greška',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsStarting(false);
    }
  };

  // Cancel a running job
  const cancelJob = useCallback(async () => {
    if (!activeJob) return;
    
    try {
      await supabase
        .from('sef_sync_jobs')
        .update({
          status: 'failed',
          error_message: 'Korisnik je prekinuo sinhronizaciju',
          completed_at: new Date().toISOString()
        })
        .eq('id', activeJob.id);
      
      stopPolling();
      setActiveJob(null);
      toast({ title: 'Sinhronizacija prekinuta' });
    } catch (e) {
      console.error('Error canceling job:', e);
    }
  }, [activeJob, stopPolling, toast]);

  // Check for existing job on mount - ONLY depends on companyId
  useEffect(() => {
    if (!companyId) {
      setActiveJob(null);
      return;
    }

    const checkExistingJob = async () => {
      try {
        // First check for active (pending/running) job
        const { data: runningJob, error: runningError } = await supabase
          .from('sef_sync_jobs')
          .select('*')
          .eq('company_id', companyId)
          .in('status', ['pending', 'running', 'partial'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (runningError) {
          console.error('Error checking running job:', runningError);
          return;
        }

        if (runningJob) {
          // Use updated_at for activity check (updated by trigger on every progress update)
          const lastActivity = runningJob.updated_at || runningJob.started_at || runningJob.created_at;
          const activityAge = Date.now() - new Date(lastActivity).getTime();
          const TEN_MINUTES = 10 * 60 * 1000; // 10 minutes without activity = stale
          
          // If job has no activity for 10+ minutes, mark it as failed
          // (increased from 5 to 10 to allow cron time to pick up partial jobs)
          if (activityAge > TEN_MINUTES) {
            console.log('Job is stale (no activity for 10+ min), marking as failed:', runningJob.id);
            await supabase
              .from('sef_sync_jobs')
              .update({
                status: 'failed',
                error_message: 'Timeout - sinhronizacija je automatski prekinuta zbog neaktivnosti',
                completed_at: new Date().toISOString()
              })
              .eq('id', runningJob.id);
            // Don't return, continue to check for last completed job
          } else {
            console.log('Found active running/partial job:', runningJob.id, 'status:', runningJob.status);
            setActiveJob(runningJob as SyncJob);
            // Start polling for existing job (works for both running and partial)
            stopPolling();
            pollingIntervalRef.current = setInterval(() => pollJobStatusById(runningJob.id), 3000);
            return;
          }
        }

        // If no active job, load the most recent completed/failed job (within last 24h)
        const yesterday = new Date();
        yesterday.setHours(yesterday.getHours() - 24);
        
        const { data: lastJob, error: lastError } = await supabase
          .from('sef_sync_jobs')
          .select('*')
          .eq('company_id', companyId)
          .in('status', ['completed', 'failed', 'partial'])
          .gte('completed_at', yesterday.toISOString())
          .order('completed_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastError) {
          console.error('Error checking last job:', lastError);
          return;
        }

        if (lastJob) {
          // Check if this job was already dismissed by the user (use state, not localStorage)
          if (dismissedIds.includes(lastJob.id)) {
            console.log('Skipping dismissed job:', lastJob.id);
            return;
          }
          console.log('Found recent completed job:', lastJob.id);
          setActiveJob(lastJob as SyncJob);
        }
      } catch (e) {
        console.error('Check existing job error:', e);
      }
    };

    checkExistingJob();

    return () => {
      stopPolling();
    };
  }, [companyId, dismissedIds]); // Include dismissedIds to re-check when user dismisses

  return {
    startLongSync,
    activeJob,
    isStarting,
    progress,
    stopPolling,
    dismissJobStatus,
    cancelJob
  };
}
