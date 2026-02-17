import { useState, useMemo } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSelectedCompany } from '@/lib/company-context';
import { useInvoices } from '@/hooks/useInvoices';
import { useFiscalEntries } from '@/hooks/useFiscalEntries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Wallet, Users, Store, BarChart3, PieChart as PieChartIcon } from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('sr-RS', {
    style: 'currency',
    currency: 'RSD',
    minimumFractionDigits: 0,
  }).format(amount);
};

const formatShortCurrency = (amount: number) => {
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(0)}k`;
  }
  return amount.toFixed(0);
};

export default function InvoiceAnalytics() {
  const isMobile = useIsMobile();
  const { selectedCompany } = useSelectedCompany();
  const { invoices, isLoading } = useInvoices(selectedCompany?.id || null);
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());

  const year = selectedYear === 'all' ? new Date().getFullYear() : parseInt(selectedYear);
  const { dailySummaries, entries: fiscalEntries, isLoading: fiscalLoading, availableYears: fiscalYears, totals: fiscalTotals } = useFiscalEntries(
    selectedCompany?.id || null,
    year
  );

  // Get only regular invoices (not proforma)
  const regularInvoices = useMemo(() => {
    return invoices.filter(i => i.invoice_type === 'regular' && !i.is_proforma);
  }, [invoices]);

  // Get available years from invoices AND fiscal entries
  const availableYears = useMemo(() => {
    const invoiceYears = [...new Set(regularInvoices.map(i => i.year))];
    const allYears = [...new Set([...invoiceYears, ...(fiscalYears || [])])].sort((a, b) => b - a);
    return allYears;
  }, [regularInvoices, fiscalYears]);

  // Filter invoices by selected year
  const filteredInvoices = useMemo(() => {
    if (selectedYear === 'all') return regularInvoices;
    return regularInvoices.filter(i => i.year === parseInt(selectedYear));
  }, [regularInvoices, selectedYear]);

  // Calculate fiscal totals based on is_paid status
  const fiscalTotal = useMemo(() => {
    return fiscalTotals.total;
  }, [fiscalTotals]);

  const fiscalPaidTotal = useMemo(() => {
    return fiscalTotals.paidTotal;
  }, [fiscalTotals]);

  const fiscalUnpaidTotal = useMemo(() => {
    return fiscalTotals.unpaidTotal;
  }, [fiscalTotals]);

  // Calculate totals (invoices + fiscal)
  const totals = useMemo(() => {
    const invoiceTotal = filteredInvoices.reduce((sum, i) => sum + Number(i.total_amount), 0);
    const invoicePaid = filteredInvoices
      .filter(i => i.payment_status === 'paid')
      .reduce((sum, i) => sum + Number(i.total_amount), 0);
    const invoicePartial = filteredInvoices
      .filter(i => i.payment_status === 'partial')
      .reduce((sum, i) => sum + Number(i.paid_amount || 0), 0);
    const invoiceUnpaid = invoiceTotal - invoicePaid - invoicePartial;

    // Total includes fiscal - now respecting is_paid status
    const total = invoiceTotal + fiscalTotal;
    const paid = invoicePaid + invoicePartial + fiscalPaidTotal;
    const unpaid = invoiceUnpaid + fiscalUnpaidTotal;

    return { total, paid, unpaid };
  }, [filteredInvoices, fiscalTotal, fiscalPaidTotal, fiscalUnpaidTotal]);

  // Monthly line chart data (invoices + fiscal combined)
  const monthlyData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec'];
    const monthlyMap = new Map<number, number>();

    // Initialize all months
    months.forEach((_, index) => {
      monthlyMap.set(index, 0);
    });

    // Add invoices
    filteredInvoices.forEach(invoice => {
      const month = new Date(invoice.issue_date).getMonth();
      const current = monthlyMap.get(month) || 0;
      monthlyMap.set(month, current + Number(invoice.total_amount));
    });

    // Add fiscal
    dailySummaries.forEach(summary => {
      const month = new Date(summary.summary_date).getMonth();
      const current = monthlyMap.get(month) || 0;
      monthlyMap.set(month, current + Number(summary.total_amount));
    });

    return months.map((name, index) => ({
      name,
      promet: Math.round(monthlyMap.get(index) || 0),
    }));
  }, [filteredInvoices, dailySummaries]);

  // Pie chart data - paid vs unpaid (amounts, not counts)
  const paymentDistributionData = useMemo(() => {
    const data = [
      { name: 'Naplaćeno', value: totals.paid, color: 'hsl(var(--chart-2))' },
      { name: 'Nenaplaćeno', value: totals.unpaid, color: 'hsl(var(--chart-5))' },
    ].filter(d => d.value > 0);

    return data;
  }, [totals]);

  // Top 5 partners by total revenue (including fiscal as "Maloprodaja")
  const topPartnersByRevenue = useMemo(() => {
    const partnerMap = new Map<string, number>();

    // Add invoices by client
    filteredInvoices.forEach(invoice => {
      const current = partnerMap.get(invoice.client_name) || 0;
      partnerMap.set(invoice.client_name, current + Number(invoice.total_amount));
    });

    // Add fiscal as "Maloprodaja"
    if (fiscalTotal > 0) {
      partnerMap.set('Maloprodaja', fiscalTotal);
    }

    return Array.from(partnerMap.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [filteredInvoices, fiscalTotal]);

  // Top 5 partners by unpaid amount (including unpaid fiscal as "Maloprodaja")
  const topPartnersByUnpaid = useMemo(() => {
    const partnerMap = new Map<string, number>();

    filteredInvoices.forEach(invoice => {
      const invoiceTotal = Number(invoice.total_amount);
      const invoicePaid =
        invoice.payment_status === 'paid'
          ? invoiceTotal
          : invoice.payment_status === 'partial'
          ? Number(invoice.paid_amount || 0)
          : 0;
      const unpaid = invoiceTotal - invoicePaid;

      if (unpaid > 0) {
        const current = partnerMap.get(invoice.client_name) || 0;
        partnerMap.set(invoice.client_name, current + unpaid);
      }
    });

    // Add unpaid fiscal as "Maloprodaja"
    if (fiscalUnpaidTotal > 0) {
      partnerMap.set('Maloprodaja', fiscalUnpaidTotal);
    }

    return Array.from(partnerMap.entries())
      .map(([name, unpaid]) => ({ name, unpaid }))
      .sort((a, b) => b.unpaid - a.unpaid)
      .slice(0, 5);
  }, [filteredInvoices, fiscalUnpaidTotal]);

  const chartConfig = {
    promet: {
      label: 'Promet',
      color: 'hsl(var(--chart-1))',
    },
  };

  if (!selectedCompany) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Izaberite firmu da biste videli analitiku.</p>
      </div>
    );
  }

  if (isLoading || fiscalLoading) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Učitavanje...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold">Analitika</h1>
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Izaberite godinu" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Sve godine</SelectItem>
            {availableYears.map(year => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ukupan promet</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.total)}</div>
            <p className="text-xs text-muted-foreground">
              {filteredInvoices.length} faktura{fiscalTotal > 0 && ' + fiskalna kasa'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Naplaćeno</CardTitle>
            <TrendingUp className="h-4 w-4 text-chart-2" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-chart-2">{formatCurrency(totals.paid)}</div>
            <p className="text-xs text-muted-foreground">
              {totals.total > 0 ? ((totals.paid / totals.total) * 100).toFixed(1) : 0}% od ukupnog
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Nenaplaćeno</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{formatCurrency(totals.unpaid)}</div>
            <p className="text-xs text-muted-foreground">
              {totals.total > 0 ? ((totals.unpaid / totals.total) * 100).toFixed(1) : 0}% od ukupnog
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Monthly Revenue Line Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Mesečni promet
            </CardTitle>
          </CardHeader>
          <CardContent>
            {totals.total === 0 ? (
              <p className="text-muted-foreground text-sm">Nema podataka za izabrani period</p>
            ) : (
              <div className="overflow-x-auto -mx-2 px-2">
                <ChartContainer config={chartConfig} className="h-[250px] sm:h-[300px] min-w-[600px] w-full">
                  <LineChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-xs" interval={0} tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={value => formatShortCurrency(value)} className="text-xs" width={45} />
                    <ChartTooltip
                      content={<ChartTooltipContent />}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="promet"
                      name="Promet"
                      stroke="hsl(var(--chart-1))"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ChartContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Status Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5" />
              Naplaćeno / Nenaplaćeno
            </CardTitle>
          </CardHeader>
          <CardContent>
            {paymentDistributionData.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nema podataka za izabrani period</p>
            ) : (
              <div className="h-[250px] sm:h-[300px] w-full min-w-0 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={paymentDistributionData}
                      cx={isMobile ? "40%" : "50%"}
                      cy="50%"
                      innerRadius={isMobile ? 40 : 60}
                      outerRadius={isMobile ? 65 : 100}
                      paddingAngle={5}
                      dataKey="value"
                      label={isMobile ? ({ percent }: any) => `${(percent * 100).toFixed(0)}%` : ({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {paymentDistributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <ChartTooltip formatter={(value: number) => formatCurrency(value)} />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-2 sm:gap-6 mt-4 pb-2">
              {paymentDistributionData.map(item => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    {item.name}: {formatCurrency(item.value)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top 5 Lists */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top 5 by Revenue */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Users className="h-5 w-5 shrink-0" />
              Top 5 partnera po prometu
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topPartnersByRevenue.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nema podataka</p>
            ) : (
              <div className="space-y-4">
                {topPartnersByRevenue.map((partner, index) => (
                  <div key={partner.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0 max-w-[55%]">
                      <Badge
                        variant="outline"
                        className="w-6 h-6 flex items-center justify-center rounded-full shrink-0"
                      >
                        {index + 1}
                      </Badge>
                      <div className="flex items-center gap-2 min-w-0">
                        {partner.name === 'Maloprodaja' && (
                          <Store className="h-4 w-4 text-primary shrink-0" />
                        )}
                        <span className="font-medium truncate">{partner.name}</span>
                      </div>
                    </div>
                    <span className="font-semibold shrink-0 ml-2 text-sm sm:text-base">{formatCurrency(partner.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top 5 by Unpaid */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <TrendingDown className="h-5 w-5 text-destructive shrink-0" />
              Top 5 partnera po nenaplaćenom
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topPartnersByUnpaid.length === 0 ? (
              <p className="text-muted-foreground text-sm">Sve je naplaćeno! 🎉</p>
            ) : (
              <div className="space-y-4">
                {topPartnersByUnpaid.map((partner, index) => (
                  <div key={partner.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0 max-w-[55%]">
                      <Badge
                        variant="destructive"
                        className="w-6 h-6 flex items-center justify-center rounded-full shrink-0"
                      >
                        {index + 1}
                      </Badge>
                      <span className="font-medium truncate">{partner.name}</span>
                    </div>
                    <span className="font-semibold text-destructive shrink-0 ml-2 text-sm sm:text-base">
                      {formatCurrency(partner.unpaid)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
