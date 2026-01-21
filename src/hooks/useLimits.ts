import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays } from 'date-fns';

const LIMIT_6M = 6000000;
const LIMIT_8M = 8000000;

export interface LimitsData {
  yearlyTotal: number;
  yearlyDomestic: number;
  rollingTotal: number;
  rollingDomestic: number;
  limit6MPercent: number;
  limit8MPercent: number;
  limit6MRemaining: number;
  limit8MRemaining: number;
  fiscalYearlyTotal: number;
  fiscalRollingTotal: number;
  fiscalRollingDomestic: number;
  kpoRollingTotal: number;
  invoiceRollingDomestic: number;
}

export function useLimits(companyId: string | null) {
  // Create date-only anchor for today (no time component, local timezone)
  const now = new Date();
  const todayDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayKey = format(todayDateOnly, 'yyyy-MM-dd');
  
  const { data: limits, isLoading } = useQuery({
    queryKey: ['limits', companyId, todayKey],
    queryFn: async (): Promise<LimitsData> => {
      const currentYear = todayDateOnly.getFullYear();
      const yearStart = `${currentYear}-01-01`;
      const yearEnd = `${currentYear}-12-31`;
      
      // Rolling 365 days: subtract 364 days with inclusive >= gives exactly 365 days
      // Example: today 02.01.2025 -> rollingStart 03.01.2024 -> period is 03.01.2024 to 02.01.2025 = 365 days
      const rollingStart = subDays(todayDateOnly, 364);
      const rollingStartStr = format(rollingStart, 'yyyy-MM-dd');
      const todayStr = format(todayDateOnly, 'yyyy-MM-dd');

      // Get yearly invoices (01.01 - 31.12) - only regular invoices for 6M limit (no advances)
      const { data: yearlyInvoices } = await supabase
        .from('invoices')
        .select('total_amount, client_type')
        .eq('company_id', companyId!)
        .eq('is_proforma', false)
        .neq('invoice_type', 'advance') // Exclude advance invoices - only regular invoices count toward 6M
        .gte('issue_date', yearStart)
        .lte('issue_date', yearEnd);

      // Get rolling 365 days invoices - only domestic for 8M limit (no advances)
      const { data: rollingInvoices } = await supabase
        .from('invoices')
        .select('total_amount, client_type')
        .eq('company_id', companyId!)
        .eq('is_proforma', false)
        .neq('invoice_type', 'advance') // Exclude advance invoices
        .gte('issue_date', rollingStartStr)
        .lte('issue_date', todayStr);

      // Get yearly fiscal data
      const { data: yearlyFiscal } = await supabase
        .from('fiscal_daily_summary' as any)
        .select('total_amount')
        .eq('company_id', companyId!)
        .gte('summary_date', yearStart)
        .lte('summary_date', yearEnd);

      // Get rolling fiscal data - use domestic_amount for 8M limit
      const { data: rollingFiscal } = await supabase
        .from('fiscal_daily_summary' as any)
        .select('total_amount, domestic_amount, kpo_entry_id')
        .eq('company_id', companyId!)
        .gte('summary_date', rollingStartStr)
        .lte('summary_date', todayStr);

      // Get independent KPO entries (not linked to invoices or fiscal) in rolling period
      const { data: rollingKPO } = await supabase
        .from('kpo_entries')
        .select('id, total_amount')
        .eq('company_id', companyId!)
        .is('invoice_id', null)
        .gte('document_date', rollingStartStr)
        .lte('document_date', todayStr);

      // Filter out KPO entries that are linked to fiscal_daily_summary
      const fiscalKpoIdSet = new Set((rollingFiscal as any[] || [])
        .filter((f: any) => f.kpo_entry_id)
        .map((f: any) => f.kpo_entry_id));
      const independentKpo = (rollingKPO || []).filter((k: any) => !fiscalKpoIdSet.has(k.id));
      const kpoRollingTotal = independentKpo.reduce((sum: number, k: any) => sum + Number(k.total_amount), 0);

      const yearlyInvoiceTotal = yearlyInvoices?.reduce((sum, inv) => sum + Number(inv.total_amount), 0) || 0;
      const yearlyDomestic = yearlyInvoices?.filter(i => i.client_type === 'domestic').reduce((sum, inv) => sum + Number(inv.total_amount), 0) || 0;
      
      const rollingInvoiceTotal = rollingInvoices?.reduce((sum, inv) => sum + Number(inv.total_amount), 0) || 0;
      const rollingDomestic = rollingInvoices?.filter(i => i.client_type === 'domestic').reduce((sum, inv) => sum + Number(inv.total_amount), 0) || 0;

      const fiscalYearlyTotal = (yearlyFiscal as any[] || []).reduce((sum: number, f: any) => sum + Number(f.total_amount), 0);
      const fiscalRollingTotal = (rollingFiscal as any[] || []).reduce((sum: number, f: any) => sum + Number(f.total_amount), 0);
      // For 8M limit, use only domestic fiscal amounts
      const fiscalRollingDomestic = (rollingFiscal as any[] || []).reduce((sum: number, f: any) => sum + Number(f.domestic_amount || 0), 0);

      // Total = invoices + fiscal
      const yearlyTotal = yearlyInvoiceTotal + fiscalYearlyTotal;
      const rollingTotal = rollingInvoiceTotal + fiscalRollingTotal;
      
      // Domestic includes fiscal domestic + KPO (treat all KPO as domestic)
      const yearlyDomesticTotal = yearlyDomestic + fiscalYearlyTotal;
      const rollingDomesticTotal = rollingDomestic + fiscalRollingDomestic + kpoRollingTotal;

      return {
        yearlyTotal,
        yearlyDomestic: yearlyDomesticTotal,
        rollingTotal,
        rollingDomestic: rollingDomesticTotal,
        limit6MPercent: Math.min((yearlyTotal / LIMIT_6M) * 100, 100),
        limit8MPercent: Math.min((rollingDomesticTotal / LIMIT_8M) * 100, 100),
        limit6MRemaining: Math.max(LIMIT_6M - yearlyTotal, 0),
        limit8MRemaining: Math.max(LIMIT_8M - rollingDomesticTotal, 0),
        fiscalYearlyTotal,
        fiscalRollingTotal,
        fiscalRollingDomestic,
        kpoRollingTotal,
        invoiceRollingDomestic: rollingDomestic,
      };
    },
    enabled: !!companyId,
  });

  return {
    limits: limits || {
      yearlyTotal: 0,
      yearlyDomestic: 0,
      rollingTotal: 0,
      rollingDomestic: 0,
      limit6MPercent: 0,
      limit8MPercent: 0,
      limit6MRemaining: LIMIT_6M,
      limit8MRemaining: LIMIT_8M,
      fiscalYearlyTotal: 0,
      fiscalRollingTotal: 0,
      fiscalRollingDomestic: 0,
      kpoRollingTotal: 0,
      invoiceRollingDomestic: 0,
    },
    isLoading,
    LIMIT_6M,
    LIMIT_8M,
  };
}
