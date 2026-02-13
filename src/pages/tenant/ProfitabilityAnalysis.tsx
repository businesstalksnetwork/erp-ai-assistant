import { useState, useMemo } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
// @ts-ignore deep instantiation
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Users, Package, Building, TrendingUp, DollarSign, Percent, ArrowDownUp } from "lucide-react";
import { ExportButton } from "@/components/ExportButton";
import type { CsvColumn } from "@/lib/exportCsv";

/* ── margin color helper ── */
function marginColor(m: number) {
  if (m >= 30) return "text-green-600 dark:text-green-400";
  if (m >= 15) return "text-yellow-600 dark:text-yellow-400";
  return "text-destructive";
}

/* ── types ── */
interface CustRow { name: string; revenue: number; cogs: number; profit: number; margin: number }
interface ProdRow { name: string; qty: number; revenue: number; cogs: number; profit: number; margin: number }
interface CCRow { name: string; revenue: number; expenses: number; profit: number; margin: number }

export default function ProfitabilityAnalysis() {
  const { locale } = useLanguage();
  const { tenantId } = useTenant();
  const sr = locale === "sr";
  const [tab, setTab] = useState("customer");

  /* ── Invoice-lines based query (shared for customer + product) ── */
  const { data: lineData, isLoading: loadingLines } = useQuery({
    queryKey: ["profitability-lines", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data: lines } = await (supabase
        .from("invoice_lines")
        .select("description, quantity, unit_price, total, product_id, product:product_id(default_purchase_price), invoice:invoice_id(partner_name, status, tenant_id)")
        .eq("invoice.tenant_id", tenantId!) as any);

      if (!lines) return { byCustomer: [] as CustRow[], byProduct: [] as ProdRow[] };

      const custMap: Record<string, { revenue: number; cogs: number }> = {};
      const prodMap: Record<string, { revenue: number; cogs: number; qty: number }> = {};

      for (const line of lines as any[]) {
        if (!["paid", "sent", "posted"].includes(line.invoice?.status)) continue;
        const revenue = Number(line.total) || 0;
        const qty = Number(line.quantity) || 0;
        const purchasePrice = Number(line.product?.default_purchase_price) || 0;
        const cogs = qty * purchasePrice;

        // By customer
        const custName = line.invoice?.partner_name || (sr ? "Nepoznato" : "Unknown");
        if (!custMap[custName]) custMap[custName] = { revenue: 0, cogs: 0 };
        custMap[custName].revenue += revenue;
        custMap[custName].cogs += cogs;

        // By product
        const prodName = line.description || (sr ? "Proizvod" : "Product");
        if (!prodMap[prodName]) prodMap[prodName] = { revenue: 0, cogs: 0, qty: 0 };
        prodMap[prodName].revenue += revenue;
        prodMap[prodName].cogs += cogs;
        prodMap[prodName].qty += qty;
      }

      const byCustomer: CustRow[] = Object.entries(custMap)
        .map(([name, d]) => {
          const profit = Math.round(d.revenue - d.cogs);
          return { name, revenue: Math.round(d.revenue), cogs: Math.round(d.cogs), profit, margin: d.revenue ? Math.round((profit / d.revenue) * 100) : 0 };
        })
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 20);

      const byProduct: ProdRow[] = Object.entries(prodMap)
        .map(([name, d]) => {
          const profit = Math.round(d.revenue - d.cogs);
          return { name, qty: d.qty, revenue: Math.round(d.revenue), cogs: Math.round(d.cogs), profit, margin: d.revenue ? Math.round((profit / d.revenue) * 100) : 0 };
        })
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 20);

      return { byCustomer, byProduct };
    },
  });

  /* ── By cost center (journal-based, add margin %) ── */
  const { data: ccData, isLoading: loadingCC } = useQuery({
    queryKey: ["profitability-cc", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data: lines } = await (supabase
        .from("journal_lines")
        .select("amount, side, cost_center:cost_center_id(name), accounts:account_id(account_type), journal:journal_entry_id(status)") as any)
        .eq("tenant_id", tenantId!)
        .not("cost_center_id", "is", null);

      if (!lines) return [] as CCRow[];
      const byCC: Record<string, { revenue: number; expenses: number }> = {};
      for (const line of lines as any[]) {
        if (line.journal?.status !== "posted") continue;
        const ccName = line.cost_center?.name || "—";
        if (!byCC[ccName]) byCC[ccName] = { revenue: 0, expenses: 0 };
        const amt = Number(line.amount) || 0;
        if (line.accounts?.account_type === "revenue") byCC[ccName].revenue += line.side === "credit" ? amt : -amt;
        else if (line.accounts?.account_type === "expense") byCC[ccName].expenses += line.side === "debit" ? amt : -amt;
      }
      return Object.entries(byCC)
        .map(([name, d]) => {
          const profit = Math.round(d.revenue - d.expenses);
          return { name, revenue: Math.round(d.revenue), expenses: Math.round(d.expenses), profit, margin: d.revenue ? Math.round((profit / d.revenue) * 100) : 0 };
        })
        .sort((a, b) => b.profit - a.profit);
    },
  });

  const customerData = lineData?.byCustomer || [];
  const productData = lineData?.byProduct || [];
  const costCenterData = ccData || [];

  /* ── KPI totals ── */
  const kpi = useMemo(() => {
    const totalRevenue = customerData.reduce((s, c) => s + c.revenue, 0);
    const totalCogs = customerData.reduce((s, c) => s + c.cogs, 0);
    const grossProfit = totalRevenue - totalCogs;
    const avgMargin = totalRevenue ? Math.round((grossProfit / totalRevenue) * 100) : 0;
    return { totalRevenue, totalCogs, grossProfit, avgMargin };
  }, [customerData]);

  const isLoading = tab === "costcenter" ? loadingCC : loadingLines;

  /* ── CSV columns ── */
  const custCsvCols: CsvColumn<CustRow>[] = [
    { key: "name", label: sr ? "Kupac" : "Customer" },
    { key: "revenue", label: sr ? "Prihod" : "Revenue" },
    { key: "cogs", label: "COGS" },
    { key: "profit", label: sr ? "Bruto profit" : "Gross Profit" },
    { key: "margin", label: sr ? "Marža %" : "Margin %", formatter: (v) => `${v}%` },
  ];
  const prodCsvCols: CsvColumn<ProdRow>[] = [
    { key: "name", label: sr ? "Proizvod" : "Product" },
    { key: "qty", label: sr ? "Količina" : "Quantity" },
    { key: "revenue", label: sr ? "Prihod" : "Revenue" },
    { key: "cogs", label: "COGS" },
    { key: "profit", label: sr ? "Bruto profit" : "Gross Profit" },
    { key: "margin", label: sr ? "Marža %" : "Margin %", formatter: (v) => `${v}%` },
  ];
  const ccCsvCols: CsvColumn<CCRow>[] = [
    { key: "name", label: sr ? "Troškovni centar" : "Cost Center" },
    { key: "revenue", label: sr ? "Prihod" : "Revenue" },
    { key: "expenses", label: sr ? "Rashodi" : "Expenses" },
    { key: "profit", label: sr ? "Profit" : "Profit" },
    { key: "margin", label: sr ? "Marža %" : "Margin %", formatter: (v) => `${v}%` },
  ];

  const exportBtn = tab === "customer"
    ? <ExportButton data={customerData} columns={custCsvCols} filename="profitability_customer" />
    : tab === "product"
    ? <ExportButton data={productData} columns={prodCsvCols} filename="profitability_product" />
    : <ExportButton data={costCenterData} columns={ccCsvCols} filename="profitability_costcenter" />;

  const fmt = (n: number) => n.toLocaleString();

  return (
    <div className="space-y-6">
      <PageHeader title={sr ? "Analiza profitabilnosti" : "Profitability Analysis"} actions={exportBtn} />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: sr ? "Ukupan prihod" : "Total Revenue", value: fmt(kpi.totalRevenue), icon: DollarSign, suffix: " RSD" },
          { label: sr ? "Ukupan COGS" : "Total COGS", value: fmt(kpi.totalCogs), icon: ArrowDownUp, suffix: " RSD" },
          { label: sr ? "Bruto profit" : "Gross Profit", value: fmt(kpi.grossProfit), icon: TrendingUp, suffix: " RSD" },
          { label: sr ? "Prosečna marža" : "Avg Margin", value: `${kpi.avgMargin}`, icon: Percent, suffix: "%" },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="pt-6 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <k.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className="text-lg font-bold">{k.value}{k.suffix}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="customer" className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />{sr ? "Po kupcu" : "By Customer"}</TabsTrigger>
          <TabsTrigger value="product" className="flex items-center gap-1.5"><Package className="h-3.5 w-3.5" />{sr ? "Po proizvodu" : "By Product"}</TabsTrigger>
          <TabsTrigger value="costcenter" className="flex items-center gap-1.5"><Building className="h-3.5 w-3.5" />{sr ? "Po troškovnom centru" : "By Cost Center"}</TabsTrigger>
        </TabsList>

        {/* ── Customer Tab ── */}
        <TabsContent value="customer" className="space-y-4 mt-4">
          {loadingLines ? <Skeleton className="h-80" /> : (
            <>
              <Card>
                <CardContent className="pt-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={customerData.slice(0, 10)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="revenue" name={sr ? "Prihod" : "Revenue"} fill="hsl(220, 70%, 50%)" radius={[0, 4, 4, 0]} stackId="a" />
                      <Bar dataKey="cogs" name="COGS" fill="hsl(0, 72%, 51%)" radius={[0, 4, 4, 0]} stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{sr ? "Kupac" : "Customer"}</TableHead>
                        <TableHead className="text-right">{sr ? "Prihod" : "Revenue"}</TableHead>
                        <TableHead className="text-right">COGS</TableHead>
                        <TableHead className="text-right">{sr ? "Bruto profit" : "Gross Profit"}</TableHead>
                        <TableHead className="text-right">{sr ? "Marža %" : "Margin %"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customerData.map(c => (
                        <TableRow key={c.name}>
                          <TableCell>{c.name}</TableCell>
                          <TableCell className="text-right">{fmt(c.revenue)} RSD</TableCell>
                          <TableCell className="text-right">{fmt(c.cogs)} RSD</TableCell>
                          <TableCell className="text-right font-medium">{fmt(c.profit)} RSD</TableCell>
                          <TableCell className={`text-right font-semibold ${marginColor(c.margin)}`}>{c.margin}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ── Product Tab ── */}
        <TabsContent value="product" className="space-y-4 mt-4">
          {loadingLines ? <Skeleton className="h-80" /> : (
            <>
              <Card>
                <CardContent className="pt-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={productData.slice(0, 10)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="profit" name={sr ? "Profit" : "Profit"} fill="hsl(160, 60%, 45%)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{sr ? "Proizvod" : "Product"}</TableHead>
                        <TableHead className="text-right">{sr ? "Količina" : "Qty"}</TableHead>
                        <TableHead className="text-right">{sr ? "Prihod" : "Revenue"}</TableHead>
                        <TableHead className="text-right">COGS</TableHead>
                        <TableHead className="text-right">{sr ? "Bruto profit" : "Gross Profit"}</TableHead>
                        <TableHead className="text-right">{sr ? "Marža %" : "Margin %"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productData.map(p => (
                        <TableRow key={p.name}>
                          <TableCell>{p.name}</TableCell>
                          <TableCell className="text-right">{p.qty}</TableCell>
                          <TableCell className="text-right">{fmt(p.revenue)} RSD</TableCell>
                          <TableCell className="text-right">{fmt(p.cogs)} RSD</TableCell>
                          <TableCell className="text-right font-medium">{fmt(p.profit)} RSD</TableCell>
                          <TableCell className={`text-right font-semibold ${marginColor(p.margin)}`}>{p.margin}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ── Cost Center Tab ── */}
        <TabsContent value="costcenter" className="space-y-4 mt-4">
          {loadingCC ? <Skeleton className="h-80" /> : (
            <>
              <Card>
                <CardContent className="pt-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={costCenterData}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="revenue" name={sr ? "Prihod" : "Revenue"} fill="hsl(160, 60%, 45%)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expenses" name={sr ? "Rashodi" : "Expenses"} fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{sr ? "Troškovni centar" : "Cost Center"}</TableHead>
                        <TableHead className="text-right">{sr ? "Prihod" : "Revenue"}</TableHead>
                        <TableHead className="text-right">{sr ? "Rashodi" : "Expenses"}</TableHead>
                        <TableHead className="text-right">{sr ? "Profit" : "Profit"}</TableHead>
                        <TableHead className="text-right">{sr ? "Marža %" : "Margin %"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {costCenterData.map(c => (
                        <TableRow key={c.name}>
                          <TableCell>{c.name}</TableCell>
                          <TableCell className="text-right">{fmt(c.revenue)}</TableCell>
                          <TableCell className="text-right">{fmt(c.expenses)}</TableCell>
                          <TableCell className="text-right font-medium">{fmt(c.profit)}</TableCell>
                          <TableCell className={`text-right font-semibold ${marginColor(c.margin)}`}>{c.margin}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
