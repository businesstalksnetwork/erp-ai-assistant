import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface KPOEntry {
  id: string;
  company_id: string;
  invoice_id: string | null;
  ordinal_number: number;
  description: string;
  products_amount: number;
  services_amount: number;
  total_amount: number;
  year: number;
  created_at: string;
  document_date: string | null;
  // Dynamic ordinal number for display (1, 2, 3...)
  display_ordinal: number;
}

export function useKPO(companyId: string | null, year?: number) {
  const currentYear = year || new Date().getFullYear();
  const queryClient = useQueryClient();

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['kpo', companyId, currentYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kpo_entries')
        .select('*')
        .eq('company_id', companyId!)
        .eq('year', currentYear)
        .order('document_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      // Assign dynamic ordinal numbers based on sorted order (1, 2, 3...)
      return (data || []).map((entry, index) => ({
        ...entry,
        display_ordinal: index + 1,
      })) as KPOEntry[];
    },
    enabled: !!companyId,
  });

  const { data: availableYears = [] } = useQuery({
    queryKey: ['kpo-years', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kpo_entries')
        .select('year')
        .eq('company_id', companyId!)
        .order('year', { ascending: false });

      if (error) throw error;
      
      const yearsFromDb = [...new Set(data.map(d => d.year))];
      const thisYear = new Date().getFullYear();
      
      // Always include current year, plus any years with entries
      const allYears = [...new Set([thisYear, ...yearsFromDb])].sort((a, b) => b - a);
      return allYears;
    },
    enabled: !!companyId,
  });

  const addEntryMutation = useMutation({
    mutationFn: async (entry: {
      companyId: string;
      year: number;
      document_date: string;
      description: string;
      products_amount: number;
      services_amount: number;
    }) => {
      // Dobavi sledeći ordinal_number za ovu godinu
      const { data: maxOrdinal } = await supabase
        .from('kpo_entries')
        .select('ordinal_number')
        .eq('company_id', entry.companyId)
        .eq('year', entry.year)
        .order('ordinal_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      const ordinalNumber = (maxOrdinal?.ordinal_number || 0) + 1;
      const total = entry.products_amount + entry.services_amount;

      const { error } = await supabase.from('kpo_entries').insert({
        company_id: entry.companyId,
        ordinal_number: ordinalNumber,
        document_date: entry.document_date || null,
        description: entry.description,
        products_amount: entry.products_amount,
        services_amount: entry.services_amount,
        total_amount: total,
        year: entry.year,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpo'] });
      queryClient.invalidateQueries({ queryKey: ['kpo-years'] });
    },
  });

  const deleteEntryMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase
        .from('kpo_entries')
        .delete()
        .eq('id', entryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpo'] });
      queryClient.invalidateQueries({ queryKey: ['kpo-years'] });
    },
  });

  const deleteYearMutation = useMutation({
    mutationFn: async ({ companyId, year }: { companyId: string; year: number }) => {
      const { error } = await supabase
        .from('kpo_entries')
        .delete()
        .eq('company_id', companyId)
        .eq('year', year);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpo'] });
      queryClient.invalidateQueries({ queryKey: ['kpo-years'] });
    },
  });

  const totals = entries.reduce(
    (acc, entry) => ({
      products: acc.products + Number(entry.products_amount),
      services: acc.services + Number(entry.services_amount),
      total: acc.total + Number(entry.total_amount),
    }),
    { products: 0, services: 0, total: 0 }
  );

  return {
    entries,
    isLoading,
    totals,
    availableYears,
    addEntry: addEntryMutation.mutateAsync,
    deleteEntry: deleteEntryMutation.mutateAsync,
    deleteYear: deleteYearMutation.mutateAsync,
    isAdding: addEntryMutation.isPending,
    isDeleting: deleteEntryMutation.isPending || deleteYearMutation.isPending,
  };
}
