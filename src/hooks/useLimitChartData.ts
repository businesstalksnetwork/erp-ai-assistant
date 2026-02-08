import { useMemo } from 'react';
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, subDays } from 'date-fns';
import { sr } from 'date-fns/locale';

interface Invoice {
  total_amount: number;
  client_type: string;
  issue_date: string;
  is_proforma: boolean;
  invoice_type?: string | null;
}

interface FiscalSummary {
  summary_date: string;
  total_amount: number;
  domestic_amount?: number;
}

interface KpoEntry {
  id: string;
  total_amount: number;
  document_date: string | null;
  invoice_id: string | null;
}

export interface MonthlyChartData {
  month: string;
  monthLabel: string;
  invoices: number;
  fiscal: number;
  kpo: number;
  total: number;
  cumulative: number;
}

export function useLimitChartData(
  limitType: '6m' | '8m',
  invoices: Invoice[],
  dailySummaries: FiscalSummary[],
  kpoEntries?: KpoEntry[],
) {
  return useMemo(() => {
    const now = new Date();
    const todayDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const months: { start: Date; end: Date; label: string; key: string }[] = [];

    if (limitType === '6m') {
      // Calendar year: Jan-Dec of current year
      for (let m = 0; m < 12; m++) {
        const start = new Date(now.getFullYear(), m, 1);
        const end = endOfMonth(start);
        months.push({
          start,
          end,
          label: format(start, 'MMM', { locale: sr }),
          key: format(start, 'yyyy-MM'),
        });
      }
    } else {
      // Rolling 12 months ending today, first month clipped to exact 365 days
      const rollingStart = subDays(todayDateOnly, 364);
      for (let i = 11; i >= 0; i--) {
        const monthDate = subMonths(todayDateOnly, i);
        const calStart = startOfMonth(monthDate);
        // First month: clip to rolling start (exact 365 days)
        const start = i === 11 ? rollingStart : calStart;
        const end = i === 0 ? todayDateOnly : endOfMonth(calStart);
        months.push({
          start,
          end,
          label: format(calStart, 'MMM yy', { locale: sr }),
          key: format(calStart, 'yyyy-MM'),
        });
      }
    }

    // Filter invoices: no proformas, no advances
    const validInvoices = invoices.filter(
      (inv) => !inv.is_proforma && inv.invoice_type !== 'advance',
    );

    // For 8M, also get rolling start for KPO filtering
    const rollingStart = subDays(todayDateOnly, 364);

    // Build fiscal KPO id set for deduplication
    const fiscalKpoIds = new Set(
      (dailySummaries as any[])
        .filter((s: any) => s.kpo_entry_id)
        .map((s: any) => s.kpo_entry_id),
    );

    let cumulative = 0;
    const chartData: MonthlyChartData[] = months.map(({ start, end, label, key }) => {
      // Invoices for this month
      let monthInvoices = validInvoices.filter((inv) => {
        const d = new Date(inv.issue_date);
        return d >= start && d <= end;
      });

      // For 8M limit, only domestic invoices
      if (limitType === '8m') {
        monthInvoices = monthInvoices.filter((inv) => inv.client_type === 'domestic');
      }

      const invoiceTotal = monthInvoices.reduce((s, inv) => s + Number(inv.total_amount), 0);

      // Fiscal for this month
      const monthFiscal = dailySummaries.filter((f) => {
        const d = new Date(f.summary_date);
        return d >= start && d <= end;
      });

      let fiscalTotal: number;
      if (limitType === '8m') {
        fiscalTotal = monthFiscal.reduce(
          (s, f) => s + Number((f as any).domestic_amount || 0),
          0,
        );
      } else {
        fiscalTotal = monthFiscal.reduce((s, f) => s + Number(f.total_amount), 0);
      }

      // KPO (only for 8M, independent entries not linked to invoices or fiscal)
      let kpoTotal = 0;
      if (limitType === '8m' && kpoEntries) {
        const independentKpo = kpoEntries.filter(
          (k) =>
            !k.invoice_id &&
            !fiscalKpoIds.has(k.id) &&
            k.document_date &&
            (() => {
              const d = new Date(k.document_date!);
              return d >= start && d <= end;
            })(),
        );
        kpoTotal = independentKpo.reduce((s, k) => s + Number(k.total_amount), 0);
      }

      const total = invoiceTotal + fiscalTotal + kpoTotal;
      cumulative += total;

      return {
        month: key,
        monthLabel: label,
        invoices: invoiceTotal,
        fiscal: fiscalTotal,
        kpo: kpoTotal,
        total,
        cumulative,
      };
    });

    return chartData;
  }, [limitType, invoices, dailySummaries, kpoEntries]);
}
