import { useState, useMemo } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { AiAnalyticsNarrative } from "@/components/ai/AiAnalyticsNarrative";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ReferenceLine, Area, ComposedChart,
} from "recharts";
import { TrendingUp, AlertTriangle, DollarSign, Landmark, CreditCard } from "lucide-react";
import { fmtNum } from "@/lib/utils";

const AR_BUCKET_PROBABILITIES = {
  current: 0.95,
  d30: 0.85,
  d60: 0.70,
  d90: 0.50,
  over90: 0.25,
};

export default function CashFlowForecast() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const [collectionRate, setCollectionRate] = useState([85]);

  const { data: forecastInput, isLoading } = useQuery({
    queryKey: ["cashflow-forecast-v2", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const [invoicesRes, supplierRes, loansRes, arAgingRes, apAgingRes, bankRes] = await Promise.all([
        supabase.from("invoices").select("total, status, invoice_date, paid_at").eq("tenant_id", tenantId!),
        supabase.from("supplier_invoices").select("amount, status, invoice_date").eq("tenant_id", tenantId!),
        supabase.from("loans").select("principal, term_months").eq("tenant_id", tenantId!).in("status", ["active"]),
        supabase.from("ar_aging_snapshots").select("bucket_current, bucket_30, bucket_60, bucket_90, bucket_over90, snapshot_date").eq("tenant_id", tenantId!).order("snapshot_date", { ascending: false }).limit(1),
        supabase.from("ap_aging_snapshots").select("total_outstanding, snapshot_date").eq("tenant_id", tenantId!).order("snapshot_date", { ascending: false }).limit(1),
        supabase.from("bank_statements").select("closing_balance, statement_date").eq("tenant_id", tenantId!).order("statement_date", { ascending: false }).limit(1),
      ]);

      const invoices = (invoicesRes.data || []) as any[];
      const supplierInvs = (supplierRes.data || []) as any[];

      const arTotal = invoices
        .filter(i => ["draft", "sent"].includes(i.status))
        .reduce((s, i) => s + Number(i.total), 0);

      const monthly: Record<string, { inflow: number; outflow: number }> = {};
      for (const inv of invoices) {
        if (inv.status !== "paid" || !inv.paid_at) continue;
        const m = inv.paid_at.substring(0, 7);
        if (!monthly[m]) monthly[m] = { inflow: 0, outflow: 0 };
        monthly[m].inflow += Number(inv.total) || 0;
      }
      for (const si of supplierInvs) {
        if (si.status !== "paid") continue;
        const m = si.invoice_date?.substring(0, 7) || "";
        if (!monthly[m]) monthly[m] = { inflow: 0, outflow: 0 };
        monthly[m].outflow += Number(si.amount) || 0;
      }

      const historical = Object.entries(monthly)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-6)
        .map(([month, v]) => ({
          month,
          inflow: Math.round(v.inflow),
          outflow: Math.round(v.outflow),
          net: Math.round(v.inflow - v.outflow),
        }));

      const monthlyLoanPayment = (loansRes.data || []).reduce((s: number, l: any) => {
        const principal = Number(l.principal) || 0;
        const termMonths = Number(l.term_months) || 1;
        return s + (principal / termMonths);
      }, 0);

      const arAging = arAgingRes.data?.[0] || null;
      const weightedAR = arAging
        ? (Number(arAging.bucket_current) * AR_BUCKET_PROBABILITIES.current) +
          (Number(arAging.bucket_30) * AR_BUCKET_PROBABILITIES.d30) +
          (Number(arAging.bucket_60) * AR_BUCKET_PROBABILITIES.d60) +
          (Number(arAging.bucket_90) * AR_BUCKET_PROBABILITIES.d90) +
          (Number(arAging.bucket_over90) * AR_BUCKET_PROBABILITIES.over90)
        : arTotal * (collectionRate[0] / 100);

      const apOutstanding = Number(apAgingRes.data?.[0]?.total_outstanding) || 0;
      const bankBalance = Number(bankRes.data?.[0]?.closing_balance) || 0;

      return { historical, arTotal, monthlyLoanPayment, weightedAR, apOutstanding, bankBalance };
    },
  });

  const forecastData = useMemo(() => {
    if (!forecastInput?.historical || forecastInput.historical.length < 2) return [];
    const hist = forecastInput.historical;
    const rate = collectionRate[0] / 100;

    const weights = [0.5, 0.3, 0.2];
    const recent = hist.slice(-3);
    let avgInflow = 0, avgOutflow = 0;
    recent.forEach((m, i) => {
      const w = weights[i] || 0.1;
      avgInflow += m.inflow * w;
      avgOutflow += m.outflow * w;
    });

    const arPerMonth = (forecastInput.weightedAR * rate) / 3;
    const apPerMonth = forecastInput.apOutstanding / 3;
    const loanPayment = forecastInput.monthlyLoanPayment;

    const lastMonth = hist[hist.length - 1].month;
    let cumCash = forecastInput.bankBalance;

    const histWithCum = hist.map(h => {
      cumCash += h.net;
      return { ...h, forecast: false, cumulativeCash: Math.round(cumCash) };
    });

    const forecastMonths = [];
    for (let i = 1; i <= 3; i++) {
      const [y, mo] = lastMonth.split("-").map(Number);
      const nm = mo + i;
      const ny = y + Math.floor((nm - 1) / 12);
      const month = `${ny}-${String(((nm - 1) % 12) + 1).padStart(2, "0")}`;
      const inflow = Math.round(avgInflow + arPerMonth);
      const outflow = Math.round(avgOutflow + loanPayment + apPerMonth);
      const net = inflow - outflow;
      cumCash += net;
      forecastMonths.push({ month, inflow, outflow, net, forecast: true, cumulativeCash: Math.round(cumCash) });
    }

    return [...histWithCum, ...forecastMonths];
  }, [forecastInput, collectionRate]);

  const projectedCash = forecastData.length > 0 ? forecastData[forecastData.length - 1].cumulativeCash : 0;
  const hasNegativeMonth = forecastData.some(d => d.forecast && d.cumulativeCash < 0);

  const chartData = forecastData.map(d => ({
    ...d,
    histInflow: d.forecast ? undefined : d.inflow,
    histOutflow: d.forecast ? undefined : d.outflow,
    histNet: d.forecast ? undefined : d.net,
    fcInflow: d.forecast ? d.inflow : undefined,
    fcOutflow: d.forecast ? d.outflow : undefined,
    fcNet: d.forecast ? d.net : undefined,
  }));

  const lastHistIdx = chartData.findIndex(d => d.forecast) - 1;
  if (lastHistIdx >= 0 && lastHistIdx < chartData.length - 1) {
    const bridge = chartData[lastHistIdx];
    chartData[lastHistIdx] = {
      ...bridge,
      fcInflow: bridge.histInflow,
      fcOutflow: bridge.histOutflow,
      fcNet: bridge.histNet,
    };
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("cashFlowForecast")} />

      {hasNegativeMonth && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>⚠️ {t("negativeBalanceWarning")}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="p-4 space-y-1">
            <p className="text-xs text-muted-foreground uppercase flex items-center gap-1">
              <Landmark className="h-3 w-3" />
              {t("bankBalance")}
            </p>
            <p className="text-2xl font-bold">{fmtNum(forecastInput?.bankBalance || 0)} RSD</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1">
            <p className="text-xs text-muted-foreground uppercase flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              {t("outstandingAR")}
            </p>
            <p className="text-2xl font-bold">{fmtNum(forecastInput?.arTotal || 0)} RSD</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1">
            <p className="text-xs text-muted-foreground uppercase flex items-center gap-1">
              <CreditCard className="h-3 w-3" />
              {t("upcomingAP")}
            </p>
            <p className="text-2xl font-bold">{fmtNum(forecastInput?.apOutstanding || 0)} RSD</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1">
            <p className="text-xs text-muted-foreground uppercase">{t("monthlyLoanPayment")}</p>
            <p className="text-2xl font-bold">{fmtNum(forecastInput?.monthlyLoanPayment || 0)} RSD</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-3">
            <Label className="text-xs">{t("collectionRate")}: {collectionRate[0]}%</Label>
            <Slider value={collectionRate} onValueChange={setCollectionRate} min={50} max={100} step={5} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            {t("historicalForecast")}
          </CardTitle>
          <p className="text-xs text-muted-foreground">{t("dashedLinesForecast")}</p>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-80" /> : (
            <ResponsiveContainer width="100%" height={380}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => v != null ? fmtNum(v) : ""} />
                <Legend />
                <Area type="monotone" dataKey="cumulativeCash" name={t("cumulativeCash")}
                  fill="hsl(210, 70%, 50%)" fillOpacity={0.1} stroke="hsl(210, 70%, 50%)" strokeWidth={2} />
                <Line type="monotone" dataKey="histInflow" name={t("cfInflow")}
                  stroke="hsl(160, 60%, 45%)" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                <Line type="monotone" dataKey="histOutflow" name={t("cfOutflow")}
                  stroke="hsl(0, 72%, 51%)" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                <Line type="monotone" dataKey="histNet" name={t("cfNet")}
                  stroke="hsl(220, 70%, 50%)" strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} />
                <Line type="monotone" dataKey="fcInflow" name={t("inflowFc")}
                  stroke="hsl(160, 60%, 45%)" strokeWidth={2} strokeDasharray="5 5"
                  dot={{ r: 3, fill: "hsl(var(--background))", strokeWidth: 2 }} connectNulls={false} />
                <Line type="monotone" dataKey="fcOutflow" name={t("outflowFc")}
                  stroke="hsl(0, 72%, 51%)" strokeWidth={2} strokeDasharray="5 5"
                  dot={{ r: 3, fill: "hsl(var(--background))", strokeWidth: 2 }} connectNulls={false} />
                <Line type="monotone" dataKey="fcNet" name={t("netFc")}
                  stroke="hsl(220, 70%, 50%)" strokeWidth={2.5} strokeDasharray="5 5"
                  dot={{ r: 3, fill: "hsl(var(--background))", strokeWidth: 2 }} connectNulls={false} />
                <ReferenceLine y={0} stroke="hsl(220, 15%, 50%)" strokeDasharray="3 3" />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("monthlySummary")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("month")}</TableHead>
                <TableHead className="text-right">{t("cfInflow")}</TableHead>
                <TableHead className="text-right">{t("cfOutflow")}</TableHead>
                <TableHead className="text-right">{t("cfNet")}</TableHead>
                <TableHead className="text-right">{t("cashPosition")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {forecastData.map(row => (
                <TableRow key={row.month} className={row.forecast ? "bg-muted/40" : ""}>
                  <TableCell className="font-medium">
                    {row.month}
                    {row.forecast && <span className="ml-2 text-xs text-muted-foreground">({t("forecastLabel")})</span>}
                  </TableCell>
                  <TableCell className="text-right">{fmtNum(row.inflow)}</TableCell>
                  <TableCell className="text-right">{fmtNum(row.outflow)}</TableCell>
                  <TableCell className={`text-right font-medium ${row.net < 0 ? "text-destructive" : ""}`}>
                    {fmtNum(row.net)}
                  </TableCell>
                  <TableCell className={`text-right font-bold ${row.cumulativeCash < 0 ? "text-destructive" : ""}`}>
                    {fmtNum(row.cumulativeCash)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <TrendingUp className={`h-5 w-5 ${projectedCash < 0 ? "text-destructive" : "text-primary"}`} />
          <div>
            <p className="text-xs text-muted-foreground uppercase">{t("projectedCash3m")}</p>
            <p className={`text-2xl font-bold ${projectedCash < 0 ? "text-destructive" : ""}`}>
              {fmtNum(projectedCash)} RSD
            </p>
          </div>
        </CardContent>
      </Card>

      {tenantId && forecastInput && (
        <AiAnalyticsNarrative
          tenantId={tenantId}
          contextType="cashflow"
          data={{
            bankBalance: forecastInput.bankBalance,
            arTotal: forecastInput.arTotal,
            apOutstanding: forecastInput.apOutstanding,
            monthlyLoanPayment: forecastInput.monthlyLoanPayment,
            projectedCash,
            hasNegativeMonth,
            collectionRate: collectionRate[0],
          }}
        />
      )}
    </div>
  );
}
