import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface TemplateItem {
  description: string;
  item_type: 'products' | 'services';
  quantity: number;
  unit_price: number;
  foreign_amount: number;
}

export interface InvoiceTemplate {
  id: string;
  company_id: string;
  name: string;
  invoice_type: 'regular' | 'proforma' | 'advance';
  client_id: string | null;
  client_name: string;
  client_address: string | null;
  client_pib: string | null;
  client_maticni_broj: string | null;
  client_type: 'domestic' | 'foreign';
  foreign_currency: string | null;
  items: TemplateItem[];
  payment_method: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

interface CreateTemplateInput {
  company_id: string;
  name: string;
  invoice_type: string;
  client_id?: string | null;
  client_name: string;
  client_address?: string | null;
  client_pib?: string | null;
  client_maticni_broj?: string | null;
  client_vat_number?: string | null;
  client_type: string;
  foreign_currency?: string | null;
  items: TemplateItem[];
  payment_method?: string | null;
  note?: string | null;
}

export function useInvoiceTemplates(companyId: string | null) {
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['invoice-templates', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      const { data, error } = await supabase
        .from('invoice_templates')
        .select('*')
        .eq('company_id', companyId)
        .order('name', { ascending: true });

      if (error) throw error;
      
      // Parse items from JSONB
      return (data || []).map(t => ({
        ...t,
        items: typeof t.items === 'string' ? JSON.parse(t.items) : t.items,
      })) as InvoiceTemplate[];
    },
    enabled: !!companyId,
  });

  const getTemplatesByType = (type: 'regular' | 'proforma' | 'advance') => {
    return templates.filter(t => t.invoice_type === type);
  };

  const createTemplate = useMutation({
    mutationFn: async (input: CreateTemplateInput) => {
      const { data, error } = await supabase
        .from('invoice_templates')
        .insert({
          ...input,
          items: JSON.stringify(input.items),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-templates', companyId] });
      toast.success('Šablon je uspešno sačuvan');
    },
    onError: (error) => {
      console.error('Error creating template:', error);
      toast.error('Greška pri čuvanju šablona');
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase
        .from('invoice_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-templates', companyId] });
      toast.success('Šablon je obrisan');
    },
    onError: (error) => {
      console.error('Error deleting template:', error);
      toast.error('Greška pri brisanju šablona');
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async (input: { id: string } & Partial<CreateTemplateInput>) => {
      const { id, items, ...updates } = input;
      const updateData: Record<string, unknown> = { ...updates };
      if (items) {
        updateData.items = JSON.stringify(items);
      }
      
      const { data, error } = await supabase
        .from('invoice_templates')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-templates', companyId] });
      toast.success('Šablon je uspešno ažuriran');
    },
    onError: (error) => {
      console.error('Error updating template:', error);
      toast.error('Greška pri ažuriranju šablona');
    },
  });

  const getTemplateById = (id: string) => {
    return templates.find(t => t.id === id) || null;
  };

  return {
    templates,
    isLoading,
    getTemplatesByType,
    getTemplateById,
    createTemplate,
    deleteTemplate,
    updateTemplate,
  };
}
