import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface FiscalEntry {
  id: string;
  company_id: string;
  entry_date: string;
  business_name: string | null;
  receipt_number: string;
  transaction_type: string;
  amount: number;
  year: number;
  created_at: string;
}

export interface FiscalDailySummary {
  id: string;
  company_id: string;
  summary_date: string;
  total_amount: number;
  sales_amount: number;
  refunds_amount: number;
  year: number;
  kpo_entry_id: string | null;
  created_at: string;
}

export interface ParsedFiscalData {
  entry_date: string;
  business_name: string;
  receipt_number: string;
  transaction_type: 'Продаја' | 'Рефундација';
  amount: number;
}

export type KpoItemType = 'products' | 'services';

export function useFiscalEntries(companyId: string | null, year?: number) {
  const queryClient = useQueryClient();
  const currentYear = year || new Date().getFullYear();

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['fiscal-entries', companyId, currentYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fiscal_entries' as any)
        .select('*')
        .eq('company_id', companyId!)
        .eq('year', currentYear)
        .order('entry_date', { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as FiscalEntry[];
    },
    enabled: !!companyId,
  });

  const { data: dailySummaries = [] } = useQuery({
    queryKey: ['fiscal-daily-summaries', companyId, currentYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fiscal_daily_summary' as any)
        .select('*')
        .eq('company_id', companyId!)
        .eq('year', currentYear)
        .order('summary_date', { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as FiscalDailySummary[];
    },
    enabled: !!companyId,
  });

  const { data: availableYears = [] } = useQuery({
    queryKey: ['fiscal-years', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fiscal_entries' as any)
        .select('year')
        .eq('company_id', companyId!);

      if (error) throw error;
      
      const yearsFromDb = [...new Set((data || []).map((d: any) => d.year))];
      const thisYear = new Date().getFullYear();
      
      return [...new Set([thisYear, ...yearsFromDb])].sort((a, b) => b - a);
    },
    enabled: !!companyId,
  });

  const importFiscalData = useMutation({
    mutationFn: async (data: { entries: ParsedFiscalData[], companyId: string, kpoItemType?: KpoItemType }) => {
      const { entries: parsedEntries, companyId, kpoItemType = 'products' } = data;
      
      // Group entries by date for daily summaries
      const dailyGroups: Record<string, ParsedFiscalData[]> = {};
      
      for (const entry of parsedEntries) {
        if (!dailyGroups[entry.entry_date]) {
          dailyGroups[entry.entry_date] = [];
        }
        dailyGroups[entry.entry_date].push(entry);
      }

      // Insert fiscal entries - deduplicate by receipt_number to avoid conflict errors
      const entriesMap = new Map<string, any>();
      for (const entry of parsedEntries) {
        const key = entry.receipt_number;
        // Later entries with same receipt_number will override earlier ones
        entriesMap.set(key, {
          company_id: companyId,
          entry_date: entry.entry_date,
          business_name: entry.business_name,
          receipt_number: entry.receipt_number,
          transaction_type: entry.transaction_type,
          amount: entry.transaction_type === 'Рефундација' ? -Math.abs(entry.amount) : entry.amount,
          year: new Date(entry.entry_date).getFullYear(),
        });
      }
      
      const fiscalEntries = Array.from(entriesMap.values());

      const { error: entriesError } = await supabase
        .from('fiscal_entries' as any)
        .upsert(fiscalEntries, { onConflict: 'company_id,receipt_number' });

      if (entriesError) throw entriesError;

      // Process daily summaries and KPO entries
      for (const [date, dayEntries] of Object.entries(dailyGroups)) {
        const sales = dayEntries
          .filter(e => e.transaction_type === 'Продаја')
          .reduce((sum, e) => sum + e.amount, 0);
        
        const refunds = dayEntries
          .filter(e => e.transaction_type === 'Рефундација')
          .reduce((sum, e) => sum + Math.abs(e.amount), 0);
        
        const total = sales - refunds;
        const entryYear = new Date(date).getFullYear();
        
        // Format date for KPO description
        const formattedDate = new Date(date).toLocaleDateString('sr-RS', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        }).replace(/\//g, '.');

        // Check if daily summary already exists
        const { data: existingSummary } = await supabase
          .from('fiscal_daily_summary' as any)
          .select('id, kpo_entry_id')
          .eq('company_id', companyId)
          .eq('summary_date', date)
          .maybeSingle();

        // Helper: create a new KPO entry for this day and return its id
        const createKpoEntryForDay = async () => {
          const { data: maxOrdinal, error: maxOrdinalError } = await supabase
            .from('kpo_entries')
            .select('ordinal_number')
            .eq('company_id', companyId)
            .eq('year', entryYear)
            .order('ordinal_number', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (maxOrdinalError) throw maxOrdinalError;

          const nextOrdinal = (maxOrdinal?.ordinal_number || 0) + 1;

          const { data: kpoEntry, error: kpoError } = await supabase
            .from('kpo_entries')
            .insert({
              company_id: companyId,
              invoice_id: null,
              ordinal_number: nextOrdinal,
              description: `Fiskalna kasa ${formattedDate} godine`,
              products_amount: kpoItemType === 'products' ? total : 0,
              services_amount: kpoItemType === 'services' ? total : 0,
              total_amount: total,
              year: entryYear,
            } as any)
            .select('id')
            .single();

          if (kpoError) throw kpoError;
          return kpoEntry?.id as string;
        };

        if (existingSummary) {
          // Update existing summary
          const { error: updateSummaryError } = await supabase
            .from('fiscal_daily_summary' as any)
            .update({
              sales_amount: sales,
              refunds_amount: refunds,
              total_amount: total,
            })
            .eq('id', (existingSummary as any).id);

          if (updateSummaryError) throw updateSummaryError;

          // If a KPO entry exists, update it; otherwise create & link it
          if ((existingSummary as any).kpo_entry_id) {
            const { error: updateKpoError } = await supabase
              .from('kpo_entries')
              .update({
                total_amount: total,
                products_amount: kpoItemType === 'products' ? total : 0,
                services_amount: kpoItemType === 'services' ? total : 0,
              })
              .eq('id', (existingSummary as any).kpo_entry_id);

            if (updateKpoError) throw updateKpoError;
          } else {
            const kpoId = await createKpoEntryForDay();
            const { error: linkError } = await supabase
              .from('fiscal_daily_summary' as any)
              .update({ kpo_entry_id: kpoId })
              .eq('id', (existingSummary as any).id);

            if (linkError) throw linkError;
          }
        } else {
          const kpoId = await createKpoEntryForDay();

          // Create daily summary
          const { error: insertSummaryError } = await supabase
            .from('fiscal_daily_summary' as any)
            .insert({
              company_id: companyId,
              summary_date: date,
              sales_amount: sales,
              refunds_amount: refunds,
              total_amount: total,
              year: entryYear,
              kpo_entry_id: kpoId,
            });

          if (insertSummaryError) throw insertSummaryError;
        }
      }

      return { count: parsedEntries.length };
    },
    onSuccess: (data) => {
      toast({
        title: 'Uspešno uvezeno',
        description: `Uvezeno ${data.count} fiskalnih računa`,
      });
      queryClient.invalidateQueries({ queryKey: ['fiscal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['fiscal-daily-summaries'] });
      queryClient.invalidateQueries({ queryKey: ['kpo'] });
      queryClient.invalidateQueries({ queryKey: ['limits'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Greška',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Helper function to recalculate a day's summary after deletions
  const recalculateDaySummary = async (companyId: string, date: string) => {
    // Get remaining entries for this date
    const { data: remainingEntries, error: fetchError } = await supabase
      .from('fiscal_entries' as any)
      .select('*')
      .eq('company_id', companyId)
      .eq('entry_date', date);

    if (fetchError) throw fetchError;

    const typedEntries = (remainingEntries || []) as unknown as FiscalEntry[];

    // Get existing daily summary
    const { data: existingSummary } = await supabase
      .from('fiscal_daily_summary' as any)
      .select('id, kpo_entry_id')
      .eq('company_id', companyId)
      .eq('summary_date', date)
      .maybeSingle();

    if (!existingSummary) return;

    if (typedEntries.length === 0) {
      // No entries left for this day - delete summary and KPO entry
      if ((existingSummary as any).kpo_entry_id) {
        await supabase
          .from('kpo_entries')
          .delete()
          .eq('id', (existingSummary as any).kpo_entry_id);
      }
      await supabase
        .from('fiscal_daily_summary' as any)
        .delete()
        .eq('id', (existingSummary as any).id);
    } else {
      // Recalculate totals
      const sales = typedEntries
        .filter(e => e.transaction_type === 'Продаја')
        .reduce((sum, e) => sum + e.amount, 0);
      const refunds = typedEntries
        .filter(e => e.transaction_type === 'Рефундација')
        .reduce((sum, e) => sum + Math.abs(e.amount), 0);
      const total = sales - refunds;

      // Update daily summary
      await supabase
        .from('fiscal_daily_summary' as any)
        .update({
          sales_amount: sales,
          refunds_amount: refunds,
          total_amount: total,
        })
        .eq('id', (existingSummary as any).id);

      // Update KPO entry if exists
      if ((existingSummary as any).kpo_entry_id) {
        await supabase
          .from('kpo_entries')
          .update({
            total_amount: total,
            products_amount: total,
            services_amount: 0,
          })
          .eq('id', (existingSummary as any).kpo_entry_id);
      }
    }
  };

  // Delete a single fiscal entry
  const deleteFiscalEntry = useMutation({
    mutationFn: async (data: { entryId: string; companyId: string; entryDate: string }) => {
      const { entryId, companyId, entryDate } = data;

      // Delete the entry
      const { error } = await supabase
        .from('fiscal_entries' as any)
        .delete()
        .eq('id', entryId);

      if (error) throw error;

      // Recalculate daily summary
      await recalculateDaySummary(companyId, entryDate);

      return { entryId };
    },
    onSuccess: () => {
      toast({
        title: 'Obrisano',
        description: 'Fiskalni račun je uspešno obrisan',
      });
      queryClient.invalidateQueries({ queryKey: ['fiscal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['fiscal-daily-summaries'] });
      queryClient.invalidateQueries({ queryKey: ['kpo'] });
      queryClient.invalidateQueries({ queryKey: ['limits'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Greška',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete multiple fiscal entries by IDs
  const deleteFiscalEntries = useMutation({
    mutationFn: async (data: { entryIds: string[]; companyId: string }) => {
      const { entryIds, companyId } = data;

      // Get affected dates first
      const { data: entriesToDelete, error: fetchError } = await supabase
        .from('fiscal_entries' as any)
        .select('entry_date')
        .in('id', entryIds);

      if (fetchError) throw fetchError;

      const affectedDates = [...new Set((entriesToDelete || []).map((e: any) => e.entry_date))];

      // Delete entries
      const { error } = await supabase
        .from('fiscal_entries' as any)
        .delete()
        .in('id', entryIds);

      if (error) throw error;

      // Recalculate summaries for affected dates
      for (const date of affectedDates) {
        await recalculateDaySummary(companyId, date);
      }

      return { count: entryIds.length };
    },
    onSuccess: (data) => {
      toast({
        title: 'Obrisano',
        description: `Obrisano ${data.count} fiskalnih računa`,
      });
      queryClient.invalidateQueries({ queryKey: ['fiscal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['fiscal-daily-summaries'] });
      queryClient.invalidateQueries({ queryKey: ['kpo'] });
      queryClient.invalidateQueries({ queryKey: ['limits'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Greška',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete fiscal entries by date range
  const deleteFiscalEntriesByDateRange = useMutation({
    mutationFn: async (data: { companyId: string; startDate: string; endDate: string }) => {
      const { companyId, startDate, endDate } = data;

      // Get affected entries
      const { data: entriesToDelete, error: fetchError } = await supabase
        .from('fiscal_entries' as any)
        .select('id, entry_date')
        .eq('company_id', companyId)
        .gte('entry_date', startDate)
        .lte('entry_date', endDate);

      if (fetchError) throw fetchError;

      if (!entriesToDelete || entriesToDelete.length === 0) {
        return { count: 0 };
      }

      const affectedDates = [...new Set((entriesToDelete || []).map((e: any) => e.entry_date))];
      const entryIds = entriesToDelete.map((e: any) => e.id);

      // Delete entries
      const { error } = await supabase
        .from('fiscal_entries' as any)
        .delete()
        .in('id', entryIds);

      if (error) throw error;

      // Recalculate summaries for affected dates
      for (const date of affectedDates) {
        await recalculateDaySummary(companyId, date);
      }

      return { count: entryIds.length };
    },
    onSuccess: (data) => {
      if (data.count > 0) {
        toast({
          title: 'Obrisano',
          description: `Obrisano ${data.count} fiskalnih računa`,
        });
      } else {
        toast({
          title: 'Info',
          description: 'Nema računa u izabranom periodu',
        });
      }
      queryClient.invalidateQueries({ queryKey: ['fiscal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['fiscal-daily-summaries'] });
      queryClient.invalidateQueries({ queryKey: ['kpo'] });
      queryClient.invalidateQueries({ queryKey: ['limits'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Greška',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete all fiscal entries for a specific date
  const deleteFiscalEntriesByDate = useMutation({
    mutationFn: async (data: { companyId: string; date: string }) => {
      const { companyId, date } = data;

      // Get entries for this date
      const { data: entriesToDelete, error: fetchError } = await supabase
        .from('fiscal_entries' as any)
        .select('id')
        .eq('company_id', companyId)
        .eq('entry_date', date);

      if (fetchError) throw fetchError;

      if (!entriesToDelete || entriesToDelete.length === 0) {
        return { count: 0 };
      }

      const entryIds = entriesToDelete.map((e: any) => e.id);

      // Delete entries
      const { error } = await supabase
        .from('fiscal_entries' as any)
        .delete()
        .in('id', entryIds);

      if (error) throw error;

      // Recalculate (will delete) summary for this date
      await recalculateDaySummary(companyId, date);

      return { count: entryIds.length };
    },
    onSuccess: (data) => {
      toast({
        title: 'Obrisano',
        description: `Obrisano ${data.count} fiskalnih računa za izabrani dan`,
      });
      queryClient.invalidateQueries({ queryKey: ['fiscal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['fiscal-daily-summaries'] });
      queryClient.invalidateQueries({ queryKey: ['kpo'] });
      queryClient.invalidateQueries({ queryKey: ['limits'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Greška',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const totals = {
    sales: entries.filter(e => e.transaction_type === 'Продаја').reduce((sum, e) => sum + e.amount, 0),
    refunds: entries.filter(e => e.transaction_type === 'Рефундација').reduce((sum, e) => sum + Math.abs(e.amount), 0),
    total: entries.reduce((sum, e) => sum + e.amount, 0),
  };

  return {
    entries,
    dailySummaries,
    isLoading,
    totals,
    availableYears,
    importFiscalData,
    deleteFiscalEntry,
    deleteFiscalEntries,
    deleteFiscalEntriesByDate,
    deleteFiscalEntriesByDateRange,
  };
}
