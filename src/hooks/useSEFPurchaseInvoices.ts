import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

export interface SEFPurchaseInvoice {
  sefInvoiceId: string;
  invoiceNumber: string;
  issueDate: string;
  deliveryDate?: string;
  dueDate?: string;
  supplierName: string;
  supplierPib?: string;
  supplierMaticniBroj?: string;
  supplierAddress?: string;
  totalAmount: number;
  vatAmount?: number;
  currency: string;
  status: string;
}

interface FetchResult {
  success: boolean;
  invoices: SEFPurchaseInvoice[];
  totalFound?: number;
  newlyStored?: number;
  alreadyStored?: number;
  error?: string;
}

interface AcceptRejectResult {
  success: boolean;
  message?: string;
  error?: string;
}

interface XMLResult {
  success: boolean;
  xml?: string;
  error?: string;
}

export function useSEFPurchaseInvoices() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isFetching, setIsFetching] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingXML, setIsLoadingXML] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);

  const fetchPurchaseInvoices = async (
    companyId: string,
    dateFrom: string,
    dateTo: string
  ): Promise<FetchResult> => {
    setIsFetching(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('sef-fetch-purchase-invoices', {
        body: { companyId, dateFrom, dateTo },
      });

      if (error) {
        throw new Error(error.message || 'Greška pri preuzimanju faktura');
      }

      if (data.success) {
        toast({
          title: 'Fakture preuzete',
          description: `Pronađeno ${data.totalFound} faktura, novo sačuvano: ${data.newlyStored}`,
        });
        
        await queryClient.invalidateQueries({ queryKey: ['sef-invoices'] });
        
        return data;
      } else {
        throw new Error(data.error || 'Nepoznata greška');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Greška pri preuzimanju';
      
      toast({
        title: 'Greška',
        description: errorMessage,
        variant: 'destructive',
      });
      
      return { success: false, invoices: [], error: errorMessage };
    } finally {
      setIsFetching(false);
    }
  };

  const acceptInvoice = async (
    companyId: string,
    sefInvoiceId: string,
    comment?: string
  ): Promise<AcceptRejectResult> => {
    setIsProcessing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('sef-accept-reject-invoice', {
        body: { companyId, sefInvoiceId, action: 'approve', comment },
      });

      if (error) {
        throw new Error(error.message || 'Greška pri odobravanju');
      }

      if (data.success) {
        toast({
          title: 'Uspešno',
          description: data.message,
        });
        
        await queryClient.invalidateQueries({ queryKey: ['sef-invoices'] });
        
        return data;
      } else {
        throw new Error(data.error || 'Nepoznata greška');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Greška pri odobravanju';
      
      toast({
        title: 'Greška',
        description: errorMessage,
        variant: 'destructive',
      });
      
      return { success: false, error: errorMessage };
    } finally {
      setIsProcessing(false);
    }
  };

  const rejectInvoice = async (
    companyId: string,
    sefInvoiceId: string,
    comment: string
  ): Promise<AcceptRejectResult> => {
    setIsProcessing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('sef-accept-reject-invoice', {
        body: { companyId, sefInvoiceId, action: 'reject', comment },
      });

      if (error) {
        throw new Error(error.message || 'Greška pri odbijanju');
      }

      if (data.success) {
        toast({
          title: 'Uspešno',
          description: data.message,
        });
        
        await queryClient.invalidateQueries({ queryKey: ['sef-invoices'] });
        
        return data;
      } else {
        throw new Error(data.error || 'Nepoznata greška');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Greška pri odbijanju';
      
      toast({
        title: 'Greška',
        description: errorMessage,
        variant: 'destructive',
      });
      
      return { success: false, error: errorMessage };
    } finally {
      setIsProcessing(false);
    }
  };

  const getInvoiceXML = async (
    companyId: string,
    sefInvoiceId: string,
    invoiceType: 'purchase' | 'sales'
  ): Promise<XMLResult> => {
    setIsLoadingXML(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('sef-get-invoice-xml', {
        body: { companyId, sefInvoiceId, invoiceType },
      });

      if (error) {
        throw new Error(error.message || 'Greška pri preuzimanju XML-a');
      }

      if (data.success) {
        return data;
      } else {
        throw new Error(data.error || 'Nepoznata greška');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Greška pri preuzimanju XML-a';
      
      toast({
        title: 'Greška',
        description: errorMessage,
        variant: 'destructive',
      });
      
      return { success: false, error: errorMessage };
    } finally {
      setIsLoadingXML(false);
    }
  };

  const enrichIncompleteInvoices = async (companyId: string): Promise<{ success: boolean; enrichedCount?: number; error?: string }> => {
    setIsEnriching(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('sef-enrich-invoices', {
        body: { companyId },
      });

      if (error) {
        throw new Error(error.message || 'Greška pri dopuni faktura');
      }

      if (data.success) {
        toast({
          title: 'Dopuna završena',
          description: data.message,
        });
        
        await queryClient.invalidateQueries({ queryKey: ['sef-invoices'] });
        
        return data;
      } else {
        throw new Error(data.error || 'Nepoznata greška');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Greška pri dopuni';
      
      toast({
        title: 'Greška',
        description: errorMessage,
        variant: 'destructive',
      });
      
      return { success: false, error: errorMessage };
    } finally {
      setIsEnriching(false);
    }
  };

  return {
    fetchPurchaseInvoices,
    acceptInvoice,
    rejectInvoice,
    getInvoiceXML,
    enrichIncompleteInvoices,
    isFetching,
    isProcessing,
    isLoadingXML,
    isEnriching,
  };
}
