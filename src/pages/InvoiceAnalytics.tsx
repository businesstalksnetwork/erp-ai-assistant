import { useState, useMemo } from 'react';
import { useSelectedCompany } from '@/lib/company-context';
import { useInvoices } from '@/hooks/useInvoices';
import { useKPO } from '@/hooks/useKPO';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TrendingUp, TrendingDown, Wallet, Users, Building2, BarChart3, PieChart, BookOpen, AlertTriangle } from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend } from 'recharts';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('sr-RS', {
    style: 'currency',
    currency: 'RSD',
    minimumFractionDigits: 0,
  }).format(amount);
};

export default function InvoiceAnalytics() {
  const { selectedCompany } = useSelectedCompany();
  const { invoices, isLoading } = useInvoices(selectedCompany?.id || null);
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  
  // KPO data
  const kpoYear = selectedYear === 'all' ? new Date().getFullYear() : parseInt(selectedYear);
  const { entries: kpoEntries, totals: kpoTotals, isLoading: kpoLoading, availableYears: kpoAvailableYears } = useKPO(selectedCompany?.id || null, kpoYear);

  // Get only regular invoices (not proforma, not advance)
  const regularInvoices = useMemo(() => {
    return invoices.filter(i => 
      i.invoice_type === 'regular' && 
      !i.is_proforma
    );
  }, [invoices]);

  // Get available years from invoices AND KPO entries
  const availableYears = useMemo(() => {
    const invoiceYears = [...new Set(regularInvoices.map(i => i.year))];
    const kpoYears = kpoAvailableYears || [];
    const allYears = [...new Set([...invoiceYears, ...kpoYears])].sort((a, b) => b - a);
    return allYears;
  }, [regularInvoices, kpoAvailableYears]);

  // Filter invoices by selected year
  const filteredInvoices = useMemo(() => {
    if (selectedYear === 'all') return regularInvoices;
    return regularInvoices.filter(i => i.year === parseInt(selectedYear));
  }, [regularInvoices, selectedYear]);

  // Calculate totals
  const totals = useMemo(() => {
    const total = filteredInvoices.reduce((sum, i) => sum + Number(i.total_amount), 0);
    const paid = filteredInvoices
      .filter(i => i.payment_status === 'paid')
      .reduce((sum, i) => sum + Number(i.total_amount), 0);
    const partiallyPaid = filteredInvoices
      .filter(i => i.payment_status === 'partial')
      .reduce((sum, i) => sum + Number(i.paid_amount || 0), 0);
    const unpaid = total - paid - partiallyPaid;

    return { total, paid: paid + partiallyPaid, unpaid };
  }, [filteredInvoices]);

  // Top 5 customers by revenue
  const topCustomers = useMemo(() => {
    const customerMap = new Map<string, { name: string; total: number }>();
    
    filteredInvoices.forEach(invoice => {
      const current = customerMap.get(invoice.client_name) || { name: invoice.client_name, total: 0 };
      current.total += Number(invoice.total_amount);
      customerMap.set(invoice.client_name, current);
    });

    return Array.from(customerMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [filteredInvoices]);

  // Invoiced by partners (all partners)
  const invoicedByPartner = useMemo(() => {
    const partnerMap = new Map<string, { name: string; total: number; count: number }>();
    
    filteredInvoices.forEach(invoice => {
      const current = partnerMap.get(invoice.client_name) || { name: invoice.client_name, total: 0, count: 0 };
      current.total += Number(invoice.total_amount);
      current.count += 1;
      partnerMap.set(invoice.client_name, current);
    });

    const totalInvoiced = filteredInvoices.reduce((sum, i) => sum + Number(i.total_amount), 0);

    return Array.from(partnerMap.values())
      .sort((a, b) => b.total - a.total)
      .map(p => ({ ...p, percentage: totalInvoiced > 0 ? (p.total / totalInvoiced) * 100 : 0 }));
  }, [filteredInvoices]);

  // Unpaid by partners
  const unpaidByPartner = useMemo(() => {
    const partnerMap = new Map<string, { 
      name: string; 
      total: number; 
      paid: number; 
      unpaid: number;
      invoiceCount: number;
    }>();
    
    filteredInvoices.forEach(invoice => {
      const current = partnerMap.get(invoice.client_name) || { 
        name: invoice.client_name, 
        total: 0, 
        paid: 0, 
        unpaid: 0,
        invoiceCount: 0
      };
      const invoiceTotal = Number(invoice.total_amount);
      const invoicePaid = invoice.payment_status === 'paid' 
        ? invoiceTotal 
        : (invoice.payment_status === 'partial' ? Number(invoice.paid_amount || 0) : 0);

      current.total += invoiceTotal;
      current.paid += invoicePaid;
      current.unpaid += (invoiceTotal - invoicePaid);
      current.invoiceCount += 1;
      partnerMap.set(invoice.client_name, current);
    });

    return Array.from(partnerMap.values())
      .filter(p => p.unpaid > 0)
      .sort((a, b) => b.unpaid - a.unpaid);
  }, [filteredInvoices]);

  // Monthly revenue data for bar chart
  const monthlyData = useMemo(() => {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun',
      'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec'
    ];
    
    const monthlyMap = new Map<number, { invoiced: number; paid: number }>();
    
    // Initialize all months
    months.forEach((_, index) => {
      monthlyMap.set(index, { invoiced: 0, paid: 0 });
    });
    
    filteredInvoices.forEach(invoice => {
      const month = new Date(invoice.issue_date).getMonth();
      const current = monthlyMap.get(month) || { invoiced: 0, paid: 0 };
      const invoiceTotal = Number(invoice.total_amount);
      const invoicePaid = invoice.payment_status === 'paid' 
        ? invoiceTotal 
        : (invoice.payment_status === 'partial' ? Number(invoice.paid_amount || 0) : 0);
      
      current.invoiced += invoiceTotal;
      current.paid += invoicePaid;
      monthlyMap.set(month, current);
    });

    return months.map((name, index) => {
      const data = monthlyMap.get(index) || { invoiced: 0, paid: 0 };
      return {
        name,
        fakturisano: Math.round(data.invoiced),
        naplaceno: Math.round(data.paid),
      };
    });
  }, [filteredInvoices]);

  // Payment status distribution for pie chart
  const paymentStatusData = useMemo(() => {
    const paidCount = filteredInvoices.filter(i => i.payment_status === 'paid').length;
    const partialCount = filteredInvoices.filter(i => i.payment_status === 'partial').length;
    const unpaidCount = filteredInvoices.filter(i => i.payment_status === 'unpaid' || !i.payment_status).length;
    
    return [
      { name: 'Plaćeno', value: paidCount, color: 'hsl(var(--chart-2))' },
      { name: 'Delimično', value: partialCount, color: 'hsl(var(--chart-4))' },
      { name: 'Neplaćeno', value: unpaidCount, color: 'hsl(var(--chart-1))' },
    ].filter(item => item.value > 0);
  }, [filteredInvoices]);

  // Top customers for horizontal bar chart
  const topCustomersChartData = useMemo(() => {
    return topCustomers.map((customer, index) => ({
      name: customer.name.length > 15 ? customer.name.substring(0, 15) + '...' : customer.name,
      fullName: customer.name,
      iznos: Math.round(customer.total),
      fill: `hsl(var(--chart-${(index % 5) + 1}))`,
    }));
  }, [topCustomers]);

  // Unpaid by partners for horizontal bar chart
  const unpaidChartData = useMemo(() => {
    return unpaidByPartner.slice(0, 10).map((partner, index) => ({
      name: partner.name.length > 15 ? partner.name.substring(0, 15) + '...' : partner.name,
      fullName: partner.name,
      nenaplaceno: Math.round(partner.unpaid),
      fill: `hsl(var(--chart-${(index % 5) + 1}))`,
    }));
  }, [unpaidByPartner]);

  // KPO monthly data
  const kpoMonthlyData = useMemo(() => {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun',
      'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec'
    ];
    const monthlyMap = new Map<number, number>();
    
    kpoEntries.forEach(entry => {
      if (entry.document_date) {
        const month = new Date(entry.document_date).getMonth();
        monthlyMap.set(month, (monthlyMap.get(month) || 0) + Number(entry.total_amount));
      }
    });
    
    return months.map((name, index) => ({
      name,
      kpo: Math.round(monthlyMap.get(index) || 0),
    }));
  }, [kpoEntries]);

  // Combined monthly data for comparison chart
  const combinedMonthlyData = useMemo(() => {
    return monthlyData.map((item, index) => ({
      ...item,
      kpo: kpoMonthlyData[index]?.kpo || 0,
    }));
  }, [monthlyData, kpoMonthlyData]);

  const chartConfig = {
    fakturisano: {
      label: "Fakturisano",
      color: "hsl(var(--chart-1))",
    },
    naplaceno: {
      label: "Naplaćeno",
      color: "hsl(var(--chart-2))",
    },
    iznos: {
      label: "Iznos",
      color: "hsl(var(--chart-3))",
    },
    nenaplaceno: {
      label: "Nenaplaćeno",
      color: "hsl(var(--chart-5))",
    },
    kpo: {
      label: "KPO Promet",
      color: "hsl(var(--chart-4))",
    },
  };

  if (!selectedCompany) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Izaberite firmu da biste videli analitiku.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Učitavanje...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold">Analitika faktura</h1>
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Izaberite godinu" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Sve godine</SelectItem>
            {availableYears.map(year => (
              <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ukupno fakturisano</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.total)}</div>
            <p className="text-xs text-muted-foreground">
              {filteredInvoices.length} faktura
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Naplaćeno</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totals.paid)}</div>
            <p className="text-xs text-muted-foreground">
              {totals.total > 0 ? ((totals.paid / totals.total) * 100).toFixed(1) : 0}% od ukupnog
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Nenaplaćeno</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(totals.unpaid)}</div>
            <p className="text-xs text-muted-foreground">
              {totals.total > 0 ? ((totals.unpaid / totals.total) * 100).toFixed(1) : 0}% od ukupnog
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Monthly Revenue Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Mesečni promet
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredInvoices.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nema podataka</p>
            ) : (
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <BarChart data={monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis 
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                    className="text-xs"
                  />
                  <ChartTooltip 
                    content={<ChartTooltipContent />}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend />
                  <Bar dataKey="fakturisano" name="Fakturisano" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="naplaceno" name="Naplaćeno" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Payment Status Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Status plaćanja
            </CardTitle>
          </CardHeader>
          <CardContent>
            {paymentStatusData.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nema podataka</p>
            ) : (
              <div className="h-[300px] w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={paymentStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {paymentStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <ChartTooltip 
                      formatter={(value: number, name: string) => [`${value} faktura`, name]}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="flex justify-center gap-4 mt-4">
              {paymentStatusData.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-sm text-muted-foreground">{item.name}: {item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>


      {/* Top 5 Customers & Invoiced by Partner */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Top 5 Customers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Top 5 kupaca
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topCustomers.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nema podataka</p>
            ) : (
              <div className="space-y-4">
                {topCustomers.map((customer, index) => (
                  <div key={customer.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="w-6 h-6 flex items-center justify-center rounded-full">
                        {index + 1}
                      </Badge>
                      <span className="font-medium truncate max-w-[200px]">{customer.name}</span>
                    </div>
                    <span className="font-semibold">{formatCurrency(customer.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Invoiced by Partner */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Fakturisano po partnerima
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-[300px] overflow-y-auto">
            {invoicedByPartner.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nema podataka</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Partner</TableHead>
                    <TableHead className="text-right">Iznos</TableHead>
                    <TableHead className="text-right">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoicedByPartner.map(partner => (
                    <TableRow key={partner.name}>
                      <TableCell className="font-medium truncate max-w-[150px]">{partner.name}</TableCell>
                      <TableCell className="text-right">{formatCurrency(partner.total)}</TableCell>
                      <TableCell className="text-right">{partner.percentage.toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Unpaid by Partner - Chart + Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <TrendingDown className="h-5 w-5" />
            Nenaplaćena potraživanja po partnerima
          </CardTitle>
        </CardHeader>
        <CardContent>
          {unpaidByPartner.length === 0 ? (
            <p className="text-muted-foreground text-sm">Sve fakture su naplaćene! 🎉</p>
          ) : (
            <div className="grid gap-6 md:grid-cols-5">
              {/* Small Chart - 2 columns */}
              <div className="md:col-span-2">
                <ChartContainer config={chartConfig} className="h-[200px] w-full">
                  <BarChart data={unpaidChartData.slice(0, 5)} layout="vertical" margin={{ top: 5, right: 20, left: 60, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={true} vertical={false} />
                    <XAxis 
                      type="number" 
                      tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                      className="text-xs"
                    />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      className="text-xs"
                      width={55}
                    />
                    <ChartTooltip 
                      formatter={(value: number, name: string, props: any) => [formatCurrency(value), props.payload.fullName]}
                    />
                    <Bar dataKey="nenaplaceno" name="Nenaplaćeno" radius={[0, 4, 4, 0]}>
                      {unpaidChartData.slice(0, 5).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill="hsl(var(--chart-1))" />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </div>
              
              {/* Table - 3 columns */}
              <div className="md:col-span-3 max-h-[250px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Partner</TableHead>
                      <TableHead className="text-right">Ukupno</TableHead>
                      <TableHead className="text-right">Naplaćeno</TableHead>
                      <TableHead className="text-right">Nenaplaćeno</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unpaidByPartner.map(partner => (
                      <TableRow key={partner.name}>
                        <TableCell className="font-medium truncate max-w-[120px]">{partner.name}</TableCell>
                        <TableCell className="text-right">{formatCurrency(partner.total)}</TableCell>
                        <TableCell className="text-right text-green-600">{formatCurrency(partner.paid)}</TableCell>
                        <TableCell className="text-right text-destructive font-semibold">{formatCurrency(partner.unpaid)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPO Section */}
      {selectedYear !== 'all' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              KPO Promet ({selectedYear})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {kpoLoading ? (
              <p className="text-muted-foreground text-sm">Učitavanje...</p>
            ) : kpoEntries.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nema KPO unosa za izabranu godinu</p>
            ) : (
              <>
                {/* KPO Summary Cards */}
                <div className="grid gap-4 md:grid-cols-3 mb-6">
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Ukupan KPO promet</p>
                    <p className="text-2xl font-bold">{formatCurrency(kpoTotals.total)}</p>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Proizvodi</p>
                    <p className="text-xl font-semibold">{formatCurrency(kpoTotals.products)}</p>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Usluge</p>
                    <p className="text-xl font-semibold">{formatCurrency(kpoTotals.services)}</p>
                  </div>
                </div>

                {/* Warning if KPO differs from invoiced */}
                {Math.abs(kpoTotals.total - totals.total) > 1000 && totals.total > 0 && (
                  <Alert className="mb-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                      KPO promet se razlikuje od fakturisanog iznosa za {formatCurrency(Math.abs(kpoTotals.total - totals.total))}
                    </AlertDescription>
                  </Alert>
                )}

                {/* KPO vs Invoiced Chart */}
                <ChartContainer config={chartConfig} className="h-[300px] w-full">
                  <BarChart data={combinedMonthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis 
                      tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                      className="text-xs"
                    />
                    <ChartTooltip 
                      content={<ChartTooltipContent />}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Legend />
                    <Bar dataKey="fakturisano" name="Fakturisano" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="kpo" name="KPO Promet" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>

                {/* Products vs Services Pie */}
                {(kpoTotals.products > 0 || kpoTotals.services > 0) && (
                  <div className="mt-6">
                    <h4 className="text-sm font-medium mb-4">Raspodela: Proizvodi vs Usluge</h4>
                    <div className="h-[200px] w-full flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie
                            data={[
                              { name: 'Proizvodi', value: kpoTotals.products, color: 'hsl(var(--chart-3))' },
                              { name: 'Usluge', value: kpoTotals.services, color: 'hsl(var(--chart-4))' },
                            ].filter(item => item.value > 0)}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          >
                            <Cell fill="hsl(var(--chart-3))" />
                            <Cell fill="hsl(var(--chart-4))" />
                          </Pie>
                          <ChartTooltip 
                            formatter={(value: number, name: string) => [formatCurrency(value), name]}
                          />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
