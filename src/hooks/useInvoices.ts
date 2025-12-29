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

      // Determine year from service date
      const serviceDateObj = new Date(serviceDate);
      const kpoYear = serviceDateObj.getFullYear();

      // Get next invoice number for the service date year
      const { data: lastInvoice } = await supabase
        .from('invoices')
        .select('invoice_number')
        .eq('company_id', proforma.company_id)
        .eq('year', kpoYear)
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

      // Get proforma items before creating new invoice
      const { data: proformaItems } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', proformaId);

      // Create the new invoice
      const { data, error } = await supabase
        .from('invoices')
        .insert({
          company_id: proforma.company_id,
          client_id: proforma.client_id,
          invoice_number: `${nextNumber}/${kpoYear}`,
          issue_date: new Date().toISOString().split('T')[0],
          service_date: serviceDate,
          client_name: proforma.client_name,
          client_address: proforma.client_address,
          client_pib: proforma.client_pib,
          client_maticni_broj: proforma.client_maticni_broj,
          client_type: proforma.client_type,
          description: proforma.description,
          quantity: proforma.quantity,
          unit_price: proforma.unit_price,
          total_amount: proforma.total_amount,
          foreign_currency: proforma.foreign_currency,
          foreign_amount: proforma.foreign_amount,
          exchange_rate: proforma.exchange_rate,
          item_type: proforma.item_type,
          payment_deadline: proforma.payment_deadline,
          payment_method: proforma.payment_method,
          note: proforma.note,
          is_proforma: false,
          converted_from_proforma: proformaId,
          year: kpoYear,
        })
        .select()
        .single();

      if (error) throw error;

      // Copy invoice items from proforma to new invoice
      if (proformaItems && proformaItems.length > 0) {
        const newItems = proformaItems.map(item => ({
          invoice_id: data.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_amount: item.total_amount,
          item_type: item.item_type,
        }));

        const { error: itemsError } = await supabase.from('invoice_items').insert(newItems);
        if (itemsError) throw itemsError;
      }

      // Calculate products and services amounts from items
      const productsAmount = proformaItems
        ?.filter(item => item.item_type === 'products')
        .reduce((sum, item) => sum + Number(item.total_amount), 0) || 0;

      const servicesAmount = proformaItems
        ?.filter(item => item.item_type === 'services')
        .reduce((sum, item) => sum + Number(item.total_amount), 0) || 0;

      // If no items, use the invoice's item_type and total_amount
      const finalProductsAmount = proformaItems && proformaItems.length > 0 
        ? productsAmount 
        : (proforma.item_type === 'products' ? proforma.total_amount : 0);
      const finalServicesAmount = proformaItems && proformaItems.length > 0 
        ? servicesAmount 
        : (proforma.item_type === 'services' ? proforma.total_amount : 0);

      // Get next KPO ordinal number for the year
      const { data: maxOrdinal } = await supabase
        .from('kpo_entries')
        .select('ordinal_number')
        .eq('company_id', proforma.company_id)
        .eq('year', kpoYear)
        .order('ordinal_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      const ordinalNumber = (maxOrdinal?.ordinal_number || 0) + 1;

      // Format service date for description
      const formattedServiceDate = serviceDateObj.toLocaleDateString('sr-RS', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });

      // Create KPO entry
      const { error: kpoError } = await supabase.from('kpo_entries').insert({
        company_id: proforma.company_id,
        invoice_id: data.id,
        ordinal_number: ordinalNumber,
        description: `Faktura ${data.invoice_number}, ${formattedServiceDate}, ${proforma.client_name}`,
        products_amount: finalProductsAmount,
        services_amount: finalServicesAmount,
        total_amount: proforma.total_amount,
        year: kpoYear,
        document_date: serviceDate,
      });

      if (kpoError) throw kpoError;

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

      // Use service_date year for KPO, fallback to current year
      const serviceDateStr = original.service_date || new Date().toISOString().split('T')[0];
      const kpoYear = new Date(serviceDateStr).getFullYear();

      // Get next invoice number for storno
      const { data: lastInvoice } = await supabase
        .from('invoices')
        .select('invoice_number')
        .eq('company_id', original.company_id)
        .eq('year', kpoYear)
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

      // Get original invoice items
      const { data: originalItems } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', originalInvoiceId);

      // Create storno invoice with negative amounts
      const { data: stornoData, error: stornoError } = await supabase
        .from('invoices')
        .insert({
          company_id: original.company_id,
          client_id: original.client_id,
          invoice_number: `${nextNumber}/${kpoYear}`,
          issue_date: new Date().toISOString().split('T')[0],
          service_date: serviceDateStr,
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
          year: kpoYear,
        })
        .select()
        .single();

      if (stornoError) throw stornoError;

      // Copy invoice items with negative amounts
      if (originalItems && originalItems.length > 0) {
        const stornoItems = originalItems.map(item => ({
          invoice_id: stornoData.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: -Math.abs(item.unit_price),
          total_amount: -Math.abs(item.total_amount),
          item_type: item.item_type,
        }));

        const { error: itemsError } = await supabase.from('invoice_items').insert(stornoItems);
        if (itemsError) throw itemsError;
      }

      // Calculate negative products and services amounts
      const productsAmount = originalItems
        ?.filter(item => item.item_type === 'products')
        .reduce((sum, item) => sum + Number(item.total_amount), 0) || 0;

      const servicesAmount = originalItems
        ?.filter(item => item.item_type === 'services')
        .reduce((sum, item) => sum + Number(item.total_amount), 0) || 0;

      // If no items, use the invoice's item_type and total_amount
      const finalProductsAmount = originalItems && originalItems.length > 0 
        ? -Math.abs(productsAmount)
        : (original.item_type === 'products' ? -Math.abs(original.total_amount) : 0);
      const finalServicesAmount = originalItems && originalItems.length > 0 
        ? -Math.abs(servicesAmount)
        : (original.item_type === 'services' ? -Math.abs(original.total_amount) : 0);

      // Get next KPO ordinal number
      const { data: maxOrdinal } = await supabase
        .from('kpo_entries')
        .select('ordinal_number')
        .eq('company_id', original.company_id)
        .eq('year', kpoYear)
        .order('ordinal_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      const ordinalNumber = (maxOrdinal?.ordinal_number || 0) + 1;

      // Format service date for description
      const formattedServiceDate = new Date(serviceDateStr).toLocaleDateString('sr-RS', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });

      // Create KPO entry with negative amounts
      const { error: kpoError } = await supabase.from('kpo_entries').insert({
        company_id: original.company_id,
        invoice_id: stornoData.id,
        ordinal_number: ordinalNumber,
        description: `STORNO Faktura ${stornoData.invoice_number}, ${formattedServiceDate}, ${original.client_name}`,
        products_amount: finalProductsAmount,
        services_amount: finalServicesAmount,
        total_amount: -Math.abs(original.total_amount),
        year: kpoYear,
        document_date: serviceDateStr,
      });

      if (kpoError) throw kpoError;

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
