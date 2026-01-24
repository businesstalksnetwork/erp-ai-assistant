import { useMemo } from 'react';
import { useInvoices, Invoice } from '@/hooks/useInvoices';

export interface ClientStats {
  totalRevenue: number;
  invoiceCount: number;
  averageInvoice: number;
  revenueShare: number;
  paidAmount: number;
  unpaidAmount: number;
  recentInvoices: Invoice[];
}

export function useClientStats(clientId: string | null, companyId: string | null) {
  const { invoices } = useInvoices(companyId);

  const stats = useMemo(() => {
    if (!clientId || !invoices.length) {
      return {
        totalRevenue: 0,
        invoiceCount: 0,
        averageInvoice: 0,
        revenueShare: 0,
        paidAmount: 0,
        unpaidAmount: 0,
        recentInvoices: [],
      };
    }

    // Filter invoices for this client (exclude proforma and storno for revenue calculations)
    const clientInvoices = invoices.filter(inv => inv.client_id === clientId);
    const revenueInvoices = clientInvoices.filter(inv => 
      inv.invoice_type === 'regular' || inv.invoice_type === 'advance'
    );

    // Calculate total revenue for client
    const totalRevenue = revenueInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);

    // Calculate paid/unpaid amounts
    const paidAmount = revenueInvoices
      .filter(inv => inv.payment_status === 'paid')
      .reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
    
    const unpaidAmount = revenueInvoices
      .filter(inv => inv.payment_status !== 'paid')
      .reduce((sum, inv) => sum + (inv.total_amount || 0), 0);

    // Calculate total company revenue (for share calculation)
    const allRevenueInvoices = invoices.filter(inv => 
      inv.invoice_type === 'regular' || inv.invoice_type === 'advance'
    );
    const totalCompanyRevenue = allRevenueInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);

    // Calculate share percentage
    const revenueShare = totalCompanyRevenue > 0 
      ? (totalRevenue / totalCompanyRevenue) * 100 
      : 0;

    // Get recent invoices (last 10, sorted by date descending)
    const recentInvoices = [...clientInvoices]
      .sort((a, b) => new Date(b.issue_date).getTime() - new Date(a.issue_date).getTime())
      .slice(0, 10);

    return {
      totalRevenue,
      invoiceCount: clientInvoices.length,
      averageInvoice: revenueInvoices.length > 0 ? totalRevenue / revenueInvoices.length : 0,
      revenueShare,
      paidAmount,
      unpaidAmount,
      recentInvoices,
    };
  }, [clientId, invoices]);

  return stats;
}
