import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SyncJob {
  id: string;
  company_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  invoice_type: string;
  total_months: number;
  processed_months: number;
  current_month: string | null;
  invoices_found: number;
  invoices_saved: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface UseSEFLongSyncResult {
  startLongSync: (companyId: string, invoiceType: 'purchase' | 'sales', yearsBack?: number) => Promise<string | null>;
  activeJob: SyncJob | null;
  isStarting: boolean;
  progress: number;
  stopPolling: () => void;
}

export function useSEFLongSync(companyId: string | null): UseSEFLongSyncResult {
  const { toast } = useToast();
  const [isStarting, setIsStarting] = useState(false);
  const [activeJob, setActiveJob] = useState<SyncJob | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  // Calculate progress percentage
  const progress = activeJob 
    ? Math.round((activeJob.processed_months / activeJob.total_months) * 100)
    : 0;

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
  }, [pollingInterval]);

  // Poll for job status
  const pollJobStatus = useCallback(async (jobId: string) => {
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

      setActiveJob(data as SyncJob);

      // Stop polling if job is done
      if (data.status === 'completed') {
        stopPolling();
        toast({
          title: 'Sinhronizacija završena',
          description: `Pronađeno ${data.invoices_found} faktura, sačuvano ${data.invoices_saved}`,
        });
      } else if (data.status === 'failed') {
        stopPolling();
        toast({
          title: 'Greška pri sinhronizaciji',
          description: data.error_message || 'Nepoznata greška',
          variant: 'destructive',
        });
      }
    } catch (e) {
      console.error('Poll error:', e);
    }
  }, [stopPolling, toast]);

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
          pollJobStatus(data.jobId);
          const interval = setInterval(() => pollJobStatus(data.jobId), 3000);
          setPollingInterval(interval);
          
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
      pollJobStatus(data.jobId);
      const interval = setInterval(() => pollJobStatus(data.jobId), 3000);
      setPollingInterval(interval);

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

  // Check for existing running job on mount
  useEffect(() => {
    if (!companyId) return;

    const checkExistingJob = async () => {
      const { data } = await supabase
        .from('sef_sync_jobs')
        .select('*')
        .eq('company_id', companyId)
        .in('status', ['pending', 'running'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setActiveJob(data as SyncJob);
        // Start polling for existing job
        const interval = setInterval(() => pollJobStatus(data.id), 3000);
        setPollingInterval(interval);
      }
    };

    checkExistingJob();

    return () => {
      stopPolling();
    };
  }, [companyId, pollJobStatus, stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    startLongSync,
    activeJob,
    isStarting,
    progress,
    stopPolling
  };
}
