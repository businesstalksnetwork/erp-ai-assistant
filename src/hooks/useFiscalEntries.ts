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
    mutationFn: async (data: { entries: ParsedFiscalData[], companyId: string }) => {
      const { entries: parsedEntries, companyId } = data;
      
      // Group entries by date for daily summaries
      const dailyGroups: Record<string, ParsedFiscalData[]> = {};
      
      for (const entry of parsedEntries) {
        if (!dailyGroups[entry.entry_date]) {
          dailyGroups[entry.entry_date] = [];
        }
        dailyGroups[entry.entry_date].push(entry);
      }

      // Insert fiscal entries
      const fiscalEntries = parsedEntries.map(entry => ({
        company_id: companyId,
        entry_date: entry.entry_date,
        business_name: entry.business_name,
        receipt_number: entry.receipt_number,
        transaction_type: entry.transaction_type,
        amount: entry.transaction_type === 'Рефундација' ? -Math.abs(entry.amount) : entry.amount,
        year: new Date(entry.entry_date).getFullYear(),
      }));

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

        if (existingSummary) {
          // Update existing summary
          await supabase
            .from('fiscal_daily_summary' as any)
            .update({
              sales_amount: sales,
              refunds_amount: refunds,
              total_amount: total,
            })
            .eq('id', (existingSummary as any).id);

          // Update existing KPO entry if exists
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
        } else {
          // Get next KPO ordinal number
          const { data: maxOrdinal } = await supabase
            .from('kpo_entries')
            .select('ordinal_number')
            .eq('company_id', companyId)
            .eq('year', entryYear)
            .order('ordinal_number', { ascending: false })
            .limit(1)
            .maybeSingle();

          const nextOrdinal = (maxOrdinal?.ordinal_number || 0) + 1;

          // Create KPO entry for this day (invoice_id is null for fiscal entries)
          const { data: kpoEntry, error: kpoError } = await supabase
            .from('kpo_entries')
            .insert({
              company_id: companyId,
              invoice_id: null,
              ordinal_number: nextOrdinal,
              description: `Fiskalna kasa ${formattedDate} godine`,
              products_amount: total,
              services_amount: 0,
              total_amount: total,
              year: entryYear,
            } as any)
            .select('id')
            .single();

          if (kpoError) {
            console.error('Error creating KPO entry:', kpoError);
          }

          // Create daily summary
          await supabase
            .from('fiscal_daily_summary' as any)
            .insert({
              company_id: companyId,
              summary_date: date,
              sales_amount: sales,
              refunds_amount: refunds,
              total_amount: total,
              year: entryYear,
              kpo_entry_id: kpoEntry?.id || null,
            });
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
  };
}
