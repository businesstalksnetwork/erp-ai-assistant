import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AiAnalyticsNarrative } from "@/components/ai/AiAnalyticsNarrative";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp } from "lucide-react";
import { fmtNum } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";

export default function MarginBridge() {
  const { locale } = useLanguage();
  const { tenantId } = useTenant();
  const sr = locale === "sr";
  const t = (en: string, srText: string) => sr ? srText : en;

  const { data, isLoading } = useQuery({
    queryKey: ["margin-bridge", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const year = new Date().getFullYear();
      const { data: lines } = await (supabase
        .from("journal_lines")
        .select("debit, credit, chart_of_accounts:account_id(account_type, code, is_variable_cost), journal:journal_entry_id(status, entry_date, tenant_id)")
        .eq("journal.tenant_id", tenantId!) as any);

      let revenue = 0, cogs = 0, opex = 0, depreciation = 0;

      for (const line of (lines as any[]) || []) {
        if (line.journal?.status !== "posted") continue;
        const d = line.journal.entry_date || "";
        if (parseInt(d.substring(0, 4)) !== year) continue;

        const code = line.chart_of_accounts?.code || "";
        const type = line.chart_of_accounts?.account_type || "";
        const debit = Number(line.debit) || 0;
        const credit = Number(line.credit) || 0;

        if (type === "revenue") {
          revenue += credit - debit;
        } else if (type === "expense") {
          const val = debit - credit;
          // Serbian kontni okvir: 54x = depreciation, 50x-51x = material/COGS
          if (code.startsWith("54")) {
            depreciation += val;
          } else if (code.startsWith("50") || code.startsWith("51") || line.chart_of_accounts?.is_variable_cost) {
            cogs += val;
          } else {
            opex += val;
          }
        }
      }

      const grossProfit = revenue - cogs;
      const ebitda = grossProfit - opex;
      const netProfit = ebitda - depreciation;

      return { revenue, cogs, grossProfit, opex, ebitda, depreciation, netProfit };
    },
  });

  const waterfallData = data ? [
    { name: t("Revenue", "Prihodi"), value: Math.round(data.revenue), cumulative: Math.round(data.revenue), isTotal: true },
    { name: t("COGS", "COGS"), value: -Math.round(data.cogs), cumulative: Math.round(data.grossProfit), isTotal: false },
    { name: t("Gross Profit", "Bruto profit"), value: Math.round(data.grossProfit), cumulative: Math.round(data.grossProfit), isTotal: true },
    { name: t("OpEx", "Operativni rashodi"), value: -Math.round(data.opex), cumulative: Math.round(data.ebitda), isTotal: false },
    { name: "EBITDA", value: Math.round(data.ebitda), cumulative: Math.round(data.ebitda), isTotal: true },
    { name: t("Depreciation", "Amortizacija"), value: -Math.round(data.depreciation), cumulative: Math.round(data.netProfit), isTotal: false },
    { name: t("Net Profit", "Neto profit"), value: Math.round(data.netProfit), cumulative: Math.round(data.netProfit), isTotal: true },
  ] : [];

  // For waterfall effect: show floating bars
  const chartData = waterfallData.map((item, i) => {
    if (item.isTotal) {
      return { name: item.name, base: 0, value: Math.abs(item.value), positive: item.value >= 0 };
    }
    const prevCumulative = i > 0 ? waterfallData[i - 1].cumulative : 0;
    const base = Math.min(prevCumulative, prevCumulative + item.value);
    return { name: item.name, base, value: Math.abs(item.value), positive: item.value >= 0 };
  });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>;

  const grossMargin = data && data.revenue > 0 ? (data.grossProfit / data.revenue * 100).toFixed(1) : "0";
  const netMargin = data && data.revenue > 0 ? (data.netProfit / data.revenue * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      <PageHeader title={t("Margin Bridge (Waterfall)", "Marža — Waterfall analiza")} icon={TrendingUp} />

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase">{t("Revenue", "Prihodi")}</p><p className="text-2xl font-bold mt-1">{fmtNum(Math.round(data?.revenue || 0))}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase">{t("Gross Margin", "Bruto marža")}</p><p className="text-2xl font-bold mt-1">{grossMargin}%</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase">EBITDA</p><p className={`text-2xl font-bold mt-1 ${(data?.ebitda || 0) >= 0 ? "" : "text-destructive"}`}>{fmtNum(Math.round(data?.ebitda || 0))}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase">{t("Net Margin", "Neto marža")}</p><p className={`text-2xl font-bold mt-1 ${(data?.netProfit || 0) >= 0 ? "" : "text-destructive"}`}>{netMargin}%</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">{t("Revenue → Net Profit Waterfall", "Prihodi → Neto profit Waterfall")}</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" className="text-xs" />
              <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} className="text-xs" />
              <Tooltip formatter={(v: number) => `${fmtNum(v)} RSD`} />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" />
              <Bar dataKey="base" stackId="stack" fill="transparent" />
              <Bar dataKey="value" stackId="stack" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.positive ? "hsl(var(--primary))" : "hsl(var(--destructive))"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Component breakdown */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {[
          { label: "COGS", value: data?.cogs || 0, pct: data?.revenue ? (data.cogs / data.revenue * 100).toFixed(0) : "0" },
          { label: t("OpEx", "Operativni"), value: data?.opex || 0, pct: data?.revenue ? (data.opex / data.revenue * 100).toFixed(0) : "0" },
          { label: t("Depreciation", "Amortizacija"), value: data?.depreciation || 0, pct: data?.revenue ? (data.depreciation / data.revenue * 100).toFixed(0) : "0" },
          { label: t("Net Profit", "Neto profit"), value: data?.netProfit || 0, pct: netMargin },
        ].map((item, i) => (
          <Card key={i} className="bg-muted/50">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{item.label} ({item.pct}%)</p>
              <p className="text-lg font-bold mt-1">{fmtNum(Math.round(item.value))} RSD</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {tenantId && data && (
        <AiAnalyticsNarrative
          tenantId={tenantId}
          contextType="margin_bridge"
          data={{
            revenue: Math.round(data.revenue),
            cogs: Math.round(data.cogs),
            grossProfit: Math.round(data.grossProfit),
            opex: Math.round(data.opex),
            ebitda: Math.round(data.ebitda),
            depreciation: Math.round(data.depreciation),
            netProfit: Math.round(data.netProfit),
            grossMarginPct: Number(grossMargin),
            netMarginPct: Number(netMargin),
          }}
        />
      )}
    </div>
  );
}
