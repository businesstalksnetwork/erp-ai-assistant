import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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
}

export function useLimits(companyId: string | null) {
  const { data: limits, isLoading } = useQuery({
    queryKey: ['limits', companyId],
    queryFn: async (): Promise<LimitsData> => {
      const currentYear = new Date().getFullYear();
      const yearStart = `${currentYear}-01-01`;
      const yearEnd = `${currentYear}-12-31`;
      
      const today = new Date();
      const rolling365Start = new Date(today);
      rolling365Start.setDate(rolling365Start.getDate() - 365);

      // Get yearly invoices (01.01 - 31.12) - all invoices for 6M limit
      const { data: yearlyInvoices } = await supabase
        .from('invoices')
        .select('total_amount, client_type')
        .eq('company_id', companyId!)
        .eq('is_proforma', false)
        .gte('issue_date', yearStart)
        .lte('issue_date', yearEnd);

      // Get rolling 365 days invoices - only domestic for 8M limit
      const { data: rollingInvoices } = await supabase
        .from('invoices')
        .select('total_amount, client_type')
        .eq('company_id', companyId!)
        .eq('is_proforma', false)
        .gte('issue_date', rolling365Start.toISOString().split('T')[0]);

      const yearlyTotal = yearlyInvoices?.reduce((sum, inv) => sum + Number(inv.total_amount), 0) || 0;
      const yearlyDomestic = yearlyInvoices?.filter(i => i.client_type === 'domestic').reduce((sum, inv) => sum + Number(inv.total_amount), 0) || 0;
      
      const rollingTotal = rollingInvoices?.reduce((sum, inv) => sum + Number(inv.total_amount), 0) || 0;
      const rollingDomestic = rollingInvoices?.filter(i => i.client_type === 'domestic').reduce((sum, inv) => sum + Number(inv.total_amount), 0) || 0;

      return {
        yearlyTotal,
        yearlyDomestic,
        rollingTotal,
        rollingDomestic,
        limit6MPercent: Math.min((yearlyTotal / LIMIT_6M) * 100, 100),
        limit8MPercent: Math.min((rollingDomestic / LIMIT_8M) * 100, 100),
        limit6MRemaining: Math.max(LIMIT_6M - yearlyTotal, 0),
        limit8MRemaining: Math.max(LIMIT_8M - rollingDomestic, 0),
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
    },
    isLoading,
    LIMIT_6M,
    LIMIT_8M,
  };
}
