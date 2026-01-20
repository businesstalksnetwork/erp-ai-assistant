import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface StoredSEFInvoice {
  id: string;
  company_id: string;
  sef_invoice_id: string;
  invoice_type: 'purchase' | 'sales';
  invoice_number: string;
  issue_date: string;
  delivery_date?: string;
  due_date?: string;
  counterparty_name: string;
  counterparty_pib?: string;
  counterparty_maticni_broj?: string;
  counterparty_address?: string;
  total_amount: number;
  vat_amount?: number;
  currency: string;
  sef_status: string;
  local_status: 'pending' | 'approved' | 'rejected' | 'imported';
  ubl_xml?: string;
  linked_invoice_id?: string;
  fetched_at: string;
  processed_at?: string;
  created_at: string;
  updated_at: string;
}

interface ImportFromXMLResult {
  success: boolean;
  imported: number;
  errors: string[];
}

export function useSEFStorage(companyId: string | null) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch stored invoices
  const { data: storedInvoices, isLoading, refetch } = useQuery({
    queryKey: ['sef-invoices', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      const { data, error } = await supabase
        .from('sef_invoices')
        .select('*')
        .eq('company_id', companyId)
        .order('issue_date', { ascending: false });

      if (error) throw error;
      return data as StoredSEFInvoice[];
    },
    enabled: !!companyId,
  });

  // Get purchase invoices
  const purchaseInvoices = (storedInvoices || []).filter(inv => inv.invoice_type === 'purchase');
  
  // Get sales invoices
  const salesInvoices = (storedInvoices || []).filter(inv => inv.invoice_type === 'sales');

  // Update local status
  const updateLocalStatus = useMutation({
    mutationFn: async ({ id, localStatus }: { id: string; localStatus: string }) => {
      const { error } = await supabase
        .from('sef_invoices')
        .update({ 
          local_status: localStatus,
          processed_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sef-invoices'] });
    },
  });

  // Link to local invoice
  const linkToLocalInvoice = useMutation({
    mutationFn: async ({ sefInvoiceId, localInvoiceId }: { sefInvoiceId: string; localInvoiceId: string }) => {
      const { error } = await supabase
        .from('sef_invoices')
        .update({ 
          linked_invoice_id: localInvoiceId,
          local_status: 'imported',
        })
        .eq('id', sefInvoiceId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sef-invoices'] });
      toast({
        title: 'Uspešno povezano',
        description: 'SEF faktura je povezana sa lokalnom fakturom',
      });
    },
  });

  // Parse UBL XML and extract invoice data
  const parseUBLXML = (xml: string): Partial<StoredSEFInvoice> | null => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'text/xml');
      
      const getTextContent = (tagName: string): string => {
        const elements = doc.getElementsByTagNameNS('*', tagName);
        return elements.length > 0 ? elements[0].textContent || '' : '';
      };

      return {
        invoice_number: getTextContent('ID'),
        issue_date: getTextContent('IssueDate'),
        delivery_date: getTextContent('ActualDeliveryDate') || undefined,
        due_date: getTextContent('DueDate') || undefined,
        total_amount: parseFloat(getTextContent('PayableAmount')) || 0,
        currency: getTextContent('DocumentCurrencyCode') || 'RSD',
      };
    } catch (err) {
      console.error('Error parsing UBL XML:', err);
      return null;
    }
  };

  // Import from XML file
  const importFromXML = async (file: File): Promise<ImportFromXMLResult> => {
    if (!companyId) {
      return { success: false, imported: 0, errors: ['Nije odabrana firma'] };
    }

    const errors: string[] = [];
    let imported = 0;

    try {
      const xmlContent = await file.text();
      
      // Try to parse as single invoice
      const parsed = parseUBLXML(xmlContent);
      
      if (parsed && parsed.invoice_number) {
        // Determine invoice type from XML (check for CreditNote root)
        const isCredit = xmlContent.includes('<CreditNote') || xmlContent.includes(':CreditNote');
        const isSales = xmlContent.includes('AccountingSupplierParty');
        
        const invoiceType = isSales ? 'sales' : 'purchase';
        
        // Generate a unique SEF invoice ID for imported invoices
        const sefInvoiceId = `IMPORTED-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        const { error } = await supabase
          .from('sef_invoices')
          .insert({
            company_id: companyId,
            sef_invoice_id: sefInvoiceId,
            invoice_type: invoiceType,
            invoice_number: parsed.invoice_number,
            issue_date: parsed.issue_date || new Date().toISOString().split('T')[0],
            delivery_date: parsed.delivery_date,
            due_date: parsed.due_date,
            counterparty_name: 'Uvezeno iz XML',
            total_amount: parsed.total_amount || 0,
            currency: parsed.currency || 'RSD',
            sef_status: 'Imported',
            local_status: 'imported',
            ubl_xml: xmlContent,
          });

        if (error) {
          errors.push(`Greška pri uvozu: ${error.message}`);
        } else {
          imported++;
        }
      } else {
        errors.push('Nije moguće parsirati XML fajl');
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : 'Greška pri čitanju fajla');
    }

    if (imported > 0) {
      await queryClient.invalidateQueries({ queryKey: ['sef-invoices'] });
      toast({
        title: 'Uspešno uvezeno',
        description: `Uvezeno ${imported} faktura`,
      });
    }

    return { success: errors.length === 0, imported, errors };
  };

  // Import from CSV file
  const importFromCSV = async (file: File): Promise<ImportFromXMLResult> => {
    if (!companyId) {
      return { success: false, imported: 0, errors: ['Nije odabrana firma'] };
    }

    const errors: string[] = [];
    let imported = 0;

    try {
      const csvContent = await file.text();
      const lines = csvContent.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        return { success: false, imported: 0, errors: ['CSV fajl je prazan ili nema podataka'] };
      }

      // Parse header
      const headers = lines[0].split(';').map(h => h.trim().toLowerCase());
      
      // Expected columns (SEF export format)
      const invoiceNumberIdx = headers.findIndex(h => h.includes('broj') || h.includes('number'));
      const issueDateIdx = headers.findIndex(h => h.includes('datum') && h.includes('izdav'));
      const totalAmountIdx = headers.findIndex(h => h.includes('iznos') || h.includes('amount'));
      const supplierIdx = headers.findIndex(h => h.includes('dobav') || h.includes('supplier') || h.includes('izdavač'));
      const statusIdx = headers.findIndex(h => h.includes('status'));

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(';').map(v => v.trim().replace(/"/g, ''));
        
        if (values.length < 2) continue;

        const invoiceNumber = invoiceNumberIdx >= 0 ? values[invoiceNumberIdx] : `CSV-${i}`;
        const issueDate = issueDateIdx >= 0 ? values[issueDateIdx] : new Date().toISOString().split('T')[0];
        const totalAmount = totalAmountIdx >= 0 ? parseFloat(values[totalAmountIdx].replace(',', '.')) || 0 : 0;
        const supplierName = supplierIdx >= 0 ? values[supplierIdx] : 'Uvezeno iz CSV';
        const status = statusIdx >= 0 ? values[statusIdx] : 'Imported';

        const sefInvoiceId = `CSV-IMPORT-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`;

        try {
          const { error } = await supabase
            .from('sef_invoices')
            .insert({
              company_id: companyId,
              sef_invoice_id: sefInvoiceId,
              invoice_type: 'purchase',
              invoice_number: invoiceNumber,
              issue_date: issueDate,
              counterparty_name: supplierName,
              total_amount: totalAmount,
              currency: 'RSD',
              sef_status: status,
              local_status: 'imported',
            });

          if (error) {
            errors.push(`Red ${i + 1}: ${error.message}`);
          } else {
            imported++;
          }
        } catch (err) {
          errors.push(`Red ${i + 1}: ${err instanceof Error ? err.message : 'Nepoznata greška'}`);
        }
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : 'Greška pri čitanju CSV fajla');
    }

    if (imported > 0) {
      await queryClient.invalidateQueries({ queryKey: ['sef-invoices'] });
      toast({
        title: 'Uspešno uvezeno',
        description: `Uvezeno ${imported} faktura`,
      });
    }

    return { success: errors.length === 0, imported, errors };
  };

  // Delete stored invoice
  const deleteStoredInvoice = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('sef_invoices')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sef-invoices'] });
      toast({
        title: 'Obrisano',
        description: 'SEF faktura je obrisana iz arhive',
      });
    },
  });

  return {
    storedInvoices: storedInvoices || [],
    purchaseInvoices,
    salesInvoices,
    isLoading,
    refetch,
    updateLocalStatus: updateLocalStatus.mutate,
    linkToLocalInvoice: linkToLocalInvoice.mutate,
    importFromXML,
    importFromCSV,
    deleteStoredInvoice: deleteStoredInvoice.mutate,
    isDeleting: deleteStoredInvoice.isPending,
  };
}
