import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Invoice {
  id: string;
  company_id: string;
  client_id: string | null;
  invoice_number: string;
  issue_date: string;
  service_date: string | null;
  client_name: string;
  client_address: string | null;
  client_pib: string | null;
  client_maticni_broj: string | null;
  client_type: 'domestic' | 'foreign';
  description: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  foreign_currency: string | null;
  foreign_amount: number | null;
  exchange_rate: number | null;
  item_type: 'products' | 'services';
  payment_deadline: string | null;
  payment_method: string | null;
  note: string | null;
  is_proforma: boolean;
  converted_from_proforma: string | null;
  year: number;
  created_at: string;
}

export function useInvoices(companyId: string | null) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('company_id', companyId!)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Invoice[];
    },
    enabled: !!companyId,
  });

  const createInvoice = useMutation({
    mutationFn: async (invoice: Omit<Invoice, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('invoices')
        .insert(invoice)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['kpo'] });
      queryClient.invalidateQueries({ queryKey: ['limits'] });
      toast({ title: 'Faktura je uspešno kreirana' });
    },
    onError: (error: Error) => {
      toast({ title: 'Greška', description: error.message, variant: 'destructive' });
    },
  });

  const updateInvoice = useMutation({
    mutationFn: async ({ id, ...invoice }: Partial<Invoice> & { id: string }) => {
      const { data, error } = await supabase
        .from('invoices')
        .update(invoice)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['kpo'] });
      queryClient.invalidateQueries({ queryKey: ['limits'] });
      toast({ title: 'Faktura je ažurirana' });
    },
    onError: (error: Error) => {
      toast({ title: 'Greška', description: error.message, variant: 'destructive' });
    },
  });

  const deleteInvoice = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('invoices').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['kpo'] });
      queryClient.invalidateQueries({ queryKey: ['limits'] });
      toast({ title: 'Faktura je obrisana' });
    },
    onError: (error: Error) => {
      toast({ title: 'Greška', description: error.message, variant: 'destructive' });
    },
  });

  const convertProformaToInvoice = useMutation({
    mutationFn: async ({ proformaId, serviceDate }: { proformaId: string; serviceDate: string }) => {
      const proforma = invoices.find(i => i.id === proformaId);
      if (!proforma) throw new Error('Predračun nije pronađen');

      // Get next invoice number
      const currentYear = new Date().getFullYear();
      const { data: lastInvoice } = await supabase
        .from('invoices')
        .select('invoice_number')
        .eq('company_id', proforma.company_id)
        .eq('year', currentYear)
        .eq('is_proforma', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let nextNumber = 1;
      if (lastInvoice?.invoice_number) {
        const match = lastInvoice.invoice_number.match(/(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }

      const { data, error } = await supabase
        .from('invoices')
        .insert({
          ...proforma,
          id: undefined,
          invoice_number: `${nextNumber}/${currentYear}`,
          is_proforma: false,
          converted_from_proforma: proformaId,
          issue_date: new Date().toISOString().split('T')[0],
          service_date: serviceDate,
          year: currentYear,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['kpo'] });
      queryClient.invalidateQueries({ queryKey: ['limits'] });
      toast({ title: 'Predračun je pretvoren u fakturu' });
    },
    onError: (error: Error) => {
      toast({ title: 'Greška', description: error.message, variant: 'destructive' });
    },
  });

  const stornoInvoice = useMutation({
    mutationFn: async (originalInvoiceId: string) => {
      const original = invoices.find(i => i.id === originalInvoiceId);
      if (!original) throw new Error('Faktura nije pronađena');

      if (original.is_proforma) {
        throw new Error('Predračuni se ne mogu stornirati');
      }

      // Get next invoice number for storno
      const currentYear = new Date().getFullYear();
      const { data: lastInvoice } = await supabase
        .from('invoices')
        .select('invoice_number')
        .eq('company_id', original.company_id)
        .eq('year', currentYear)
        .eq('is_proforma', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let nextNumber = 1;
      if (lastInvoice?.invoice_number) {
        const match = lastInvoice.invoice_number.match(/(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }

      // Create storno invoice with negative amounts
      const { data: stornoData, error: stornoError } = await supabase
        .from('invoices')
        .insert({
          company_id: original.company_id,
          client_id: original.client_id,
          invoice_number: `${nextNumber}/${currentYear}`,
          issue_date: new Date().toISOString().split('T')[0],
          service_date: original.service_date,
          client_name: original.client_name,
          client_address: original.client_address,
          client_pib: original.client_pib,
          client_maticni_broj: original.client_maticni_broj,
          client_type: original.client_type,
          description: `STORNO fakture ${original.invoice_number}`,
          quantity: original.quantity,
          unit_price: -Math.abs(original.unit_price),
          total_amount: -Math.abs(original.total_amount),
          foreign_currency: original.foreign_currency,
          foreign_amount: original.foreign_amount ? -Math.abs(original.foreign_amount) : null,
          exchange_rate: original.exchange_rate,
          item_type: original.item_type,
          payment_deadline: null,
          payment_method: original.payment_method,
          note: `Storno fakture br. ${original.invoice_number} od ${new Date(original.issue_date).toLocaleDateString('sr-RS')}`,
          is_proforma: false,
          year: currentYear,
        })
        .select()
        .single();

      if (stornoError) throw stornoError;

      // Copy invoice items with negative amounts
      const { data: originalItems } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', originalInvoiceId);

      if (originalItems && originalItems.length > 0) {
        const stornoItems = originalItems.map(item => ({
          invoice_id: stornoData.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: -Math.abs(item.unit_price),
          total_amount: -Math.abs(item.total_amount),
          item_type: item.item_type,
        }));

        await supabase.from('invoice_items').insert(stornoItems);
      }

      return { stornoInvoice: stornoData, originalInvoice: original };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['kpo'] });
      queryClient.invalidateQueries({ queryKey: ['limits'] });
      toast({ 
        title: 'Storno faktura kreirana',
        description: `Kreirana storno faktura br. ${data.stornoInvoice.invoice_number}`,
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Greška', description: error.message, variant: 'destructive' });
    },
  });

  return {
    invoices,
    isLoading,
    createInvoice,
    updateInvoice,
    deleteInvoice,
    convertProformaToInvoice,
    stornoInvoice,
  };
}
