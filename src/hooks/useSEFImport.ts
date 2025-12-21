import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

export interface SEFInvoice {
  invoiceId: string;
  invoiceNumber: string;
  issueDate: string;
  buyerName: string;
  buyerPib?: string;
  totalAmount: number;
  status: string;
}

interface FetchResult {
  success: boolean;
  invoices: SEFInvoice[];
  totalFound?: number;
  alreadyImported?: number;
  error?: string;
}

export function useSEFImport() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isFetching, setIsFetching] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const fetchSEFInvoices = async (
    companyId: string,
    dateFrom: string,
    dateTo: string
  ): Promise<FetchResult> => {
    setIsFetching(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('sef-fetch-invoices', {
        body: { companyId, dateFrom, dateTo },
      });

      if (error) {
        throw new Error(error.message || 'Greška pri preuzimanju sa SEF-a');
      }

      if (!data.success) {
        throw new Error(data.error || 'Nepoznata greška');
      }

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Greška pri preuzimanju sa SEF-a';
      
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

  const importSEFInvoice = async (
    sefInvoice: SEFInvoice,
    companyId: string
  ): Promise<boolean> => {
    setIsImporting(true);
    
    try {
      // Parse the issue date
      const issueDate = sefInvoice.issueDate.split('T')[0];
      const year = new Date(issueDate).getFullYear();

      // Create invoice in our database
      const { error } = await supabase.from('invoices').insert({
        company_id: companyId,
        invoice_number: sefInvoice.invoiceNumber,
        issue_date: issueDate,
        service_date: issueDate,
        client_name: sefInvoice.buyerName,
        client_pib: sefInvoice.buyerPib || null,
        client_type: 'domestic',
        description: `Uvezeno sa SEF-a`,
        quantity: 1,
        unit_price: sefInvoice.totalAmount,
        total_amount: sefInvoice.totalAmount,
        is_proforma: false,
        year,
        sef_invoice_id: sefInvoice.invoiceId,
        sef_status: 'sent',
        sef_sent_at: new Date().toISOString(),
      });

      if (error) {
        throw new Error(error.message);
      }

      toast({
        title: 'Faktura uvezena',
        description: `Faktura ${sefInvoice.invoiceNumber} je uspešno uvezena.`,
      });

      await queryClient.invalidateQueries({ queryKey: ['invoices'] });
      
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Greška pri uvozu fakture';
      
      toast({
        title: 'Greška',
        description: errorMessage,
        variant: 'destructive',
      });
      
      return false;
    } finally {
      setIsImporting(false);
    }
  };

  const importMultipleSEFInvoices = async (
    sefInvoices: SEFInvoice[],
    companyId: string
  ): Promise<{ success: number; failed: number }> => {
    setIsImporting(true);
    let success = 0;
    let failed = 0;

    try {
      for (const sefInvoice of sefInvoices) {
        const issueDate = sefInvoice.issueDate.split('T')[0];
        const year = new Date(issueDate).getFullYear();

        const { error } = await supabase.from('invoices').insert({
          company_id: companyId,
          invoice_number: sefInvoice.invoiceNumber,
          issue_date: issueDate,
          service_date: issueDate,
          client_name: sefInvoice.buyerName,
          client_pib: sefInvoice.buyerPib || null,
          client_type: 'domestic',
          description: `Uvezeno sa SEF-a`,
          quantity: 1,
          unit_price: sefInvoice.totalAmount,
          total_amount: sefInvoice.totalAmount,
          is_proforma: false,
          year,
          sef_invoice_id: sefInvoice.invoiceId,
          sef_status: 'sent',
          sef_sent_at: new Date().toISOString(),
        });

        if (error) {
          console.error(`Failed to import ${sefInvoice.invoiceNumber}:`, error);
          failed++;
        } else {
          success++;
        }
      }

      if (success > 0) {
        toast({
          title: 'Uvoz završen',
          description: `Uspešno uvezeno: ${success} faktura${failed > 0 ? `, neuspešno: ${failed}` : ''}`,
        });
        await queryClient.invalidateQueries({ queryKey: ['invoices'] });
      }

      return { success, failed };
    } catch (err) {
      toast({
        title: 'Greška',
        description: 'Greška pri masovnom uvozu faktura',
        variant: 'destructive',
      });
      return { success, failed: failed + (sefInvoices.length - success - failed) };
    } finally {
      setIsImporting(false);
    }
  };

  return {
    fetchSEFInvoices,
    importSEFInvoice,
    importMultipleSEFInvoices,
    isFetching,
    isImporting,
  };
}
