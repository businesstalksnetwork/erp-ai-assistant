// @ts-nocheck
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface SEFSendResult {
  success: boolean;
  sefInvoiceId?: string;
  error?: string;
  message?: string;
}

interface SendOptions {
  silent?: boolean; // If true, don't show toast notifications
}

export function useSEF() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSending, setIsSending] = useState(false);
  const [isStornoSending, setIsStornoSending] = useState(false);

  const sendToSEF = async (invoiceId: string, companyId: string, options?: SendOptions): Promise<SEFSendResult> => {
    setIsSending(true);
    const silent = options?.silent ?? false;
    
    try {
      const { data, error } = await supabase.functions.invoke('sef-send-invoice', {
        body: { invoiceId, companyId, action: 'send' },
      });

      if (error) {
        throw new Error(error.message || 'Greška pri slanju na SEF');
      }

      if (data.success) {
        if (!silent) {
          toast({
            title: 'Uspešno poslato na SEF',
            description: `ID fakture na SEF-u: ${data.sefInvoiceId}`,
          });
        }
        
        // Refresh invoices
        await queryClient.invalidateQueries({ queryKey: ['invoices'] });
        
        return data;
      } else {
        throw new Error(data.error || 'Nepoznata greška');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Greška pri slanju na SEF';
      
      // Always show errors (even in silent mode)
      toast({
        title: 'SEF greška',
        description: errorMessage,
        variant: 'destructive',
      });
      
      return { success: false, error: errorMessage };
    } finally {
      setIsSending(false);
    }
  };

  const sendStornoToSEF = async (
    stornoInvoiceId: string, 
    companyId: string, 
    originalSefId: string,
    options?: SendOptions
  ): Promise<SEFSendResult> => {
    setIsStornoSending(true);
    const silent = options?.silent ?? false;
    
    try {
      const { data, error } = await supabase.functions.invoke('sef-send-invoice', {
        body: { 
          invoiceId: stornoInvoiceId, 
          companyId, 
          action: 'storno',
          originalSefId 
        },
      });

      if (error) {
        throw new Error(error.message || 'Greška pri storniranju na SEF');
      }

      if (data.success) {
        if (!silent) {
          toast({
            title: 'Storno poslat na SEF',
            description: `ID storno fakture na SEF-u: ${data.sefInvoiceId}`,
          });
        }
        
        await queryClient.invalidateQueries({ queryKey: ['invoices'] });
        
        return data;
      } else {
        throw new Error(data.error || 'Nepoznata greška');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Greška pri storniranju na SEF';
      
      // Always show errors
      toast({
        title: 'SEF greška',
        description: errorMessage,
        variant: 'destructive',
      });
      
      return { success: false, error: errorMessage };
    } finally {
      setIsStornoSending(false);
    }
  };

  const getSEFStatus = (invoice: any): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } => {
    const status = invoice.sef_status || 'not_sent';
    
    switch (status) {
      case 'sent':
      case 'approved':
        return { label: 'Poslato', variant: 'default' };
      case 'pending':
        return { label: 'U toku...', variant: 'secondary' };
      case 'error':
        return { label: 'Greška', variant: 'destructive' };
      case 'rejected':
        return { label: 'Odbijeno', variant: 'destructive' };
      default:
        return { label: 'Nije poslato', variant: 'outline' };
    }
  };

  return {
    sendToSEF,
    sendStornoToSEF,
    getSEFStatus,
    isSending,
    isStornoSending,
  };
}
