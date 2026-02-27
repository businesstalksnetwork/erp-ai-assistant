import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, RefreshCw, AlertTriangle, Package } from "lucide-react";
import { fmtNum } from "@/lib/utils";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar, ReferenceLine,
} from "recharts";

function movingAverage(data: number[], window: number): number[] {
  return data.map((_, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = data.slice(start, i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

function seasonalDecompose(monthly: number[]): { seasonal: number[]; trend: number[] } {
  if (monthly.length < 12) return { seasonal: monthly.map(() => 1), trend: movingAverage(monthly, 3) };
  const trend = movingAverage(monthly, 12);
  const ratio = monthly.map((v, i) => trend[i] > 0 ? v / trend[i] : 1);
  // Average seasonal index per month
  const monthAvg = Array(12).fill(0);
  const monthCnt = Array(12).fill(0);
  ratio.forEach((r, i) => { monthAvg[i % 12] += r; monthCnt[i % 12]++; });
  const indices = monthAvg.map((s, i) => monthCnt[i] > 0 ? s / monthCnt[i] : 1);
  const seasonal = monthly.map((_, i) => indices[i % 12]);
  return { seasonal, trend };
}

export default function DemandForecasting() {
  const { locale } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const sr = locale === "sr";
  const t = (en: string, srText: string) => sr ? srText : en;
  const [selectedProduct, setSelectedProduct] = useState<string>("");

  const { data: products } = useQuery({
    queryKey: ["products-forecast", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name").eq("tenant_id", tenantId!).eq("is_active", true).limit(200);
      return data || [];
    },
  });

  // Fetch sales history from invoice_items + invoices
  const { data: salesData, isLoading } = useQuery({
    queryKey: ["sales-history-forecast", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data: items } = await (supabase as any)
        .from("invoice_items")
        .select("product_id, quantity, invoice_id")
        .eq("tenant_id", tenantId!);

      const { data: invoices } = await (supabase as any)
        .from("invoices")
        .select("id, invoice_date, status")
        .eq("tenant_id", tenantId!)
        .neq("status", "cancelled");

      const invoiceMap = new Map((invoices || []).map((inv: any) => [inv.id, inv.invoice_date]));

      // Group by product + month
      const byProductMonth = new Map<string, Map<string, number>>();
      for (const item of (items || []) as any[]) {
        if (!item.product_id) continue;
        const date = invoiceMap.get(item.invoice_id) as string | undefined;
        if (!date) continue;
        const monthKey = date.substring(0, 7); // YYYY-MM
        if (!byProductMonth.has(item.product_id)) byProductMonth.set(item.product_id, new Map());
        const pm = byProductMonth.get(item.product_id)!;
        pm.set(monthKey, (pm.get(monthKey) || 0) + Number(item.quantity || 0));
      }
      return byProductMonth;
    },
  });

  const productMap = useMemo(() => new Map((products || []).map(p => [p.id, p.name])), [products]);

  // Compute forecast for selected product
  const forecast = useMemo(() => {
    if (!selectedProduct || !salesData?.has(selectedProduct)) return null;
    const monthlyMap = salesData.get(selectedProduct)!;
    const sortedMonths = Array.from(monthlyMap.keys()).sort();
    if (sortedMonths.length < 3) return null;

    const actuals = sortedMonths.map(m => monthlyMap.get(m) || 0);
    const ma3 = movingAverage(actuals, 3);
    const { seasonal, trend } = seasonalDecompose(actuals);

    // Forecast next 3 months
    const lastTrend = trend[trend.length - 1] || actuals[actuals.length - 1];
    const forecastMonths: string[] = [];
    const lastDate = new Date(sortedMonths[sortedMonths.length - 1] + "-01");
    for (let i = 1; i <= 3; i++) {
      const d = new Date(lastDate);
      d.setMonth(d.getMonth() + i);
      forecastMonths.push(d.toISOString().substring(0, 7));
    }

    const forecastQty = forecastMonths.map((_, i) => {
      const sIdx = (sortedMonths.length + i) % 12;
      return Math.max(0, Math.round(lastTrend * (seasonal[sIdx] || 1)));
    });

    // Reorder point: avg daily demand * lead time + safety stock
    const avgMonthly = actuals.reduce((a, b) => a + b, 0) / actuals.length;
    const stdDev = Math.sqrt(actuals.reduce((s, v) => s + (v - avgMonthly) ** 2, 0) / actuals.length);
    const leadTimeDays = 7;
    const avgDaily = avgMonthly / 30;
    const safetyStock = Math.ceil(1.65 * stdDev * Math.sqrt(leadTimeDays / 30));
    const reorderPoint = Math.ceil(avgDaily * leadTimeDays + safetyStock);

    const chartData = sortedMonths.map((m, i) => ({
      month: m,
      actual: Math.round(actuals[i]),
      ma3: Math.round(ma3[i]),
      trend: Math.round(trend[i]),
    }));

    const forecastChart = forecastMonths.map((m, i) => ({
      month: m,
      forecast: forecastQty[i],
    }));

    return { chartData, forecastChart, reorderPoint, safetyStock, avgMonthly: Math.round(avgMonthly), forecastQty };
  }, [selectedProduct, salesData]);

  // Summary across all products
  const productSummaries = useMemo(() => {
    if (!salesData) return [];
    return Array.from(salesData.entries())
      .map(([pid, monthlyMap]) => {
        const months = Array.from(monthlyMap.values());
        const total = months.reduce((a, b) => a + b, 0);
        const avg = months.length > 0 ? total / months.length : 0;
        const lastMonth = Array.from(monthlyMap.entries()).sort().pop();
        return { pid, name: productMap.get(pid) || pid.substring(0, 8), total: Math.round(total), avg: Math.round(avg), months: months.length, lastQty: lastMonth ? Math.round(lastMonth[1]) : 0 };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 20);
  }, [salesData, productMap]);

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="space-y-6">
      <PageHeader title={t("Demand Forecasting", "Prognoza tražnje")} icon={TrendingUp} />

      {/* Product selector */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <Label className="text-sm font-medium whitespace-nowrap">{t("Select Product", "Izaberi proizvod")}</Label>
            <Select value={selectedProduct} onValueChange={setSelectedProduct}>
              <SelectTrigger className="max-w-sm"><SelectValue placeholder={t("Choose a product…", "Izaberi proizvod…")} /></SelectTrigger>
              <SelectContent>
                {productSummaries.map(p => <SelectItem key={p.pid} value={p.pid}>{p.name} ({p.total} {t("units", "jed.")})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {forecast && (
        <>
          {/* KPI cards */}
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase">{t("Avg Monthly Demand", "Prosečna mesečna tražnja")}</p>
              <p className="text-2xl font-bold mt-1">{fmtNum(forecast.avgMonthly)}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase">{t("Reorder Point", "Tačka naručivanja")}</p>
              <p className="text-2xl font-bold mt-1">{fmtNum(forecast.reorderPoint)}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase">{t("Safety Stock", "Sigurnosna zaliha")}</p>
              <p className="text-2xl font-bold mt-1">{fmtNum(forecast.safetyStock)}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase">{t("Next Month Forecast", "Prognoza sledećeg meseca")}</p>
              <p className="text-2xl font-bold mt-1">{fmtNum(forecast.forecastQty[0])}</p>
            </CardContent></Card>
          </div>

          {/* History + forecast chart */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">{t("Sales History & Forecast", "Istorija prodaje i prognoza")}</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={[...forecast.chartData, ...forecast.forecastChart.map(f => ({ month: f.month, actual: null as number | null, ma3: null as number | null, trend: null as number | null, forecast: f.forecast }))]}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="actual" stroke="hsl(var(--primary))" name={t("Actual", "Stvarno")} dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="ma3" stroke="hsl(var(--accent-foreground))" name={t("MA(3)", "PP(3)")} dot={false} strokeDasharray="5 5" />
                  <Line type="monotone" dataKey="forecast" stroke="hsl(var(--destructive))" name={t("Forecast", "Prognoza")} dot strokeDasharray="3 3" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Reorder visualization */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">{t("Reorder Point Analysis", "Analiza tačke naručivanja")}</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={forecast.chartData.slice(-6)}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Bar dataKey="actual" fill="hsl(var(--primary))" name={t("Actual", "Stvarno")} radius={[4, 4, 0, 0]} />
                  <ReferenceLine y={forecast.reorderPoint} stroke="hsl(var(--destructive))" strokeDasharray="3 3" label={t("Reorder", "Naručivanje")} />
                  <ReferenceLine y={forecast.safetyStock} stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" label={t("Safety", "Sigurnost")} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}

      {/* Top products summary */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">{t("Top Products by Sales Volume", "Proizvodi po obimu prodaje")}</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 pr-4">{t("Product", "Proizvod")}</th>
                  <th className="pb-2 pr-4 text-right">{t("Total Sold", "Ukupno")}</th>
                  <th className="pb-2 pr-4 text-right">{t("Avg/Month", "Prosek/Mesec")}</th>
                  <th className="pb-2 pr-4 text-right">{t("Last Month", "Poslednji mesec")}</th>
                  <th className="pb-2 text-right">{t("Months", "Meseci")}</th>
                </tr>
              </thead>
              <tbody>
                {productSummaries.map(p => (
                  <tr key={p.pid} className="border-b last:border-0 cursor-pointer hover:bg-muted/50" onClick={() => setSelectedProduct(p.pid)}>
                    <td className="py-2 pr-4 font-medium">{p.name}</td>
                    <td className="py-2 pr-4 text-right">{fmtNum(p.total)}</td>
                    <td className="py-2 pr-4 text-right">{fmtNum(p.avg)}</td>
                    <td className="py-2 pr-4 text-right">{fmtNum(p.lastQty)}</td>
                    <td className="py-2 text-right">{p.months}</td>
                  </tr>
                ))}
                {productSummaries.length === 0 && (
                  <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">{t("No sales data available", "Nema podataka o prodaji")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <label className={className}>{children}</label>;
}
