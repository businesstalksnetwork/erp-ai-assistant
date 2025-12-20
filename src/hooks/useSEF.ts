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

export function useSEF() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSending, setIsSending] = useState(false);

  const sendToSEF = async (invoiceId: string, companyId: string): Promise<SEFSendResult> => {
    setIsSending(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('sef-send-invoice', {
        body: { invoiceId, companyId },
      });

      if (error) {
        throw new Error(error.message || 'Greška pri slanju na SEF');
      }

      if (data.success) {
        toast({
          title: 'Uspešno poslato na SEF',
          description: `ID fakture na SEF-u: ${data.sefInvoiceId}`,
        });
        
        // Refresh invoices
        await queryClient.invalidateQueries({ queryKey: ['invoices'] });
        
        return data;
      } else {
        throw new Error(data.error || 'Nepoznata greška');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Greška pri slanju na SEF';
      
      toast({
        title: 'Greška',
        description: errorMessage,
        variant: 'destructive',
      });
      
      return { success: false, error: errorMessage };
    } finally {
      setIsSending(false);
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
    getSEFStatus,
    isSending,
  };
}
