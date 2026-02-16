import { useMemo } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
// @ts-ignore deep instantiation
import { supabase } from "@/integrations/supabase/client";
import { BiPageLayout } from "@/components/shared/BiPageLayout";
import type { StatItem } from "@/components/shared/StatsBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AiModuleInsights } from "@/components/shared/AiModuleInsights";
import { AiAnalyticsNarrative } from "@/components/ai/AiAnalyticsNarrative";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  TrendingUp, Percent, DollarSign, Clock, BarChart3, Package, Activity,
} from "lucide-react";

const COLORS = [
  "hsl(220, 70%, 50%)", "hsl(160, 60%, 45%)", "hsl(38, 92%, 50%)",
  "hsl(0, 72%, 51%)", "hsl(280, 60%, 50%)", "hsl(200, 70%, 50%)",
];

export default function AnalyticsDashboard() {
  const { t, locale } = useLanguage();
  const { tenantId } = useTenant();
  const sr = locale === "sr";

  const { data: monthlyData, isLoading } = useQuery({
    queryKey: ["analytics-monthly", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data: lines } = await (supabase
        .from("journal_lines")
        .select("debit, credit, accounts:account_id(account_type, code), journal:journal_entry_id(entry_date, status, tenant_id)") as any)
        .eq("journal.tenant_id", tenantId!);

      if (!lines) return { monthly: [], totals: { revenue: 0, expenses: 0, assets: 0, liabilities: 0, equity: 0 } };

      const monthly: Record<string, { revenue: number; expenses: number }> = {};
      let totalRevenue = 0, totalExpenses = 0, totalAssets = 0, totalLiabilities = 0, totalEquity = 0;

      for (const line of lines as any[]) {
        if (line.journal?.status !== "posted") continue;
        const acctType = line.accounts?.account_type;
        const debit = Number(line.debit) || 0;
        const credit = Number(line.credit) || 0;
        const date = line.journal?.entry_date;
        const monthKey = date ? date.substring(0, 7) : "unknown";
        const net = debit - credit;

        if (acctType === "revenue") {
          const val = -net;
          totalRevenue += val;
          if (!monthly[monthKey]) monthly[monthKey] = { revenue: 0, expenses: 0 };
          monthly[monthKey].revenue += val;
        } else if (acctType === "expense") {
          const val = net;
          totalExpenses += val;
          if (!monthly[monthKey]) monthly[monthKey] = { revenue: 0, expenses: 0 };
          monthly[monthKey].expenses += val;
        } else if (acctType === "asset") {
          totalAssets += net;
        } else if (acctType === "liability") {
          totalLiabilities += -net;
        } else if (acctType === "equity") {
          totalEquity += -net;
        }
      }

      const sorted = Object.entries(monthly)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-12)
        .map(([month, vals]) => ({
          month, revenue: Math.round(vals.revenue),
          expenses: Math.round(vals.expenses),
          profit: Math.round(vals.revenue - vals.expenses),
        }));

      return { monthly: sorted, totals: { revenue: totalRevenue, expenses: totalExpenses, assets: totalAssets, liabilities: totalLiabilities, equity: totalEquity } };
    },
  });

  const { data: invoiceStats } = useQuery({
    queryKey: ["analytics-invoices", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data: invoices } = await supabase.from("invoices").select("total, status, invoice_date, due_date, paid_at").eq("tenant_id", tenantId!);
      if (!invoices || invoices.length === 0) return { dso: 0, totalAR: 0 };
      const paidInvoices = invoices.filter((i: any) => i.status === "paid" && i.paid_at);
      let totalDays = 0;
      for (const inv of paidInvoices as any[]) {
        const issued = new Date(inv.invoice_date).getTime();
        const paid = new Date(inv.paid_at).getTime();
        totalDays += (paid - issued) / (1000 * 60 * 60 * 24);
      }
      const dso = paidInvoices.length > 0 ? Math.round(totalDays / paidInvoices.length) : 0;
      const totalAR = invoices.filter((i: any) => ["draft", "sent"].includes(i.status)).reduce((s: number, i: any) => s + Number(i.total), 0);
      return { dso, totalAR };
    },
  });

  const totals = monthlyData?.totals;
  const grossMargin = totals && totals.revenue > 0 ? ((totals.revenue - totals.expenses) / totals.revenue * 100) : 0;
  const currentRatio = totals && totals.liabilities > 0 ? (totals.assets / totals.liabilities) : 0;
  const debtToEquity = totals && totals.equity > 0 ? (totals.liabilities / totals.equity) : 0;

  const stats: StatItem[] = [
    { label: sr ? "Bruto marža" : "Gross Margin", value: `${grossMargin.toFixed(1)}%`, icon: Percent, color: "text-accent" },
    { label: sr ? "Tekući racio" : "Current Ratio", value: currentRatio.toFixed(2), icon: Activity, color: "text-primary" },
    { label: "DSO", value: `${invoiceStats?.dso || 0}d`, icon: Clock, color: "text-warning" },
    { label: sr ? "Dug/Kapital" : "Debt/Equity", value: debtToEquity.toFixed(2), icon: DollarSign, color: "text-destructive" },
  ];

  const expenseBreakdown = useMemo(() => {
    if (!monthlyData?.monthly) return [];
    return [
      { name: sr ? "Prihodi" : "Revenue", value: Math.abs(totals?.revenue || 0) },
      { name: sr ? "Rashodi" : "Expenses", value: Math.abs(totals?.expenses || 0) },
    ];
  }, [monthlyData, sr, totals]);

  return (
    <BiPageLayout
      title={sr ? "Analitički pregled" : "Analytics Dashboard"}
      icon={BarChart3}
      stats={isLoading ? undefined : stats}
    >
      {isLoading && (
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-accent" />
              {sr ? "Trend profita (12 meseci)" : "Profit Trend (12 months)"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-64" /> : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={monthlyData?.monthly || []}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" name={sr ? "Prihodi" : "Revenue"} stroke="hsl(160, 60%, 45%)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="expenses" name={sr ? "Rashodi" : "Expenses"} stroke="hsl(0, 72%, 51%)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="profit" name={sr ? "Profit" : "Profit"} stroke="hsl(220, 70%, 50%)" strokeWidth={2.5} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              {sr ? "Prihodi vs Rashodi" : "Revenue vs Expenses"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-64" /> : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={monthlyData?.monthly || []}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="revenue" name={sr ? "Prihodi" : "Revenue"} fill="hsl(160, 60%, 45%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name={sr ? "Rashodi" : "Expenses"} fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4 text-warning" />
              {sr ? "Struktura" : "Breakdown"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-64" /> : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={expenseBreakdown} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {expenseBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-accent" />
              {sr ? "MoM rast prihoda" : "MoM Revenue Growth"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-64" /> : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={(monthlyData?.monthly || []).map((m, i, arr) => ({
                  month: m.month,
                  growth: i > 0 && arr[i - 1].revenue > 0
                    ? Math.round(((m.revenue - arr[i - 1].revenue) / arr[i - 1].revenue) * 100)
                    : 0,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip formatter={(v: number) => `${v}%`} />
                  <Bar dataKey="growth" name={sr ? "Rast %" : "Growth %"} fill="hsl(220, 70%, 50%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {tenantId && totals && (
        <AiAnalyticsNarrative
          tenantId={tenantId}
          contextType="dashboard"
          data={{
            grossMargin: Number(grossMargin.toFixed(1)),
            currentRatio: Number(currentRatio.toFixed(2)),
            dso: invoiceStats?.dso || 0,
            debtToEquity: Number(debtToEquity.toFixed(2)),
            revenue: Math.round(totals.revenue),
            expenses: Math.round(totals.expenses),
            profit: Math.round(totals.revenue - totals.expenses),
          }}
        />
      )}
      {tenantId && <AiModuleInsights tenantId={tenantId} module="analytics" />}
    </BiPageLayout>
  );
}