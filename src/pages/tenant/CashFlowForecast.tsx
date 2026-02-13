import { useState, useMemo } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ReferenceLine, Area, ComposedChart,
} from "recharts";
import { TrendingUp, AlertTriangle, DollarSign } from "lucide-react";

export default function CashFlowForecast() {
  const { locale } = useLanguage();
  const { tenantId } = useTenant();
  const sr = locale === "sr";
  const [collectionRate, setCollectionRate] = useState([85]);

  const { data: historicalData, isLoading } = useQuery({
    queryKey: ["cashflow-forecast", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      // Get monthly inflows (paid invoices) and outflows (supplier invoices paid)
      const { data: invoices } = await supabase
        .from("invoices")
        .select("total, status, invoice_date, paid_at")
        .eq("tenant_id", tenantId!);

      const { data: supplierInvs } = await supabase
        .from("supplier_invoices")
        .select("amount, status, invoice_date")
        .eq("tenant_id", tenantId!);

      // Outstanding AR
      const arTotal = (invoices || [])
        .filter((i: any) => ["draft", "sent"].includes(i.status))
        .reduce((s: number, i: any) => s + Number(i.total), 0);

      // Aggregate by month
      const monthly: Record<string, { inflow: number; outflow: number }> = {};

      for (const inv of (invoices || []) as any[]) {
        if (inv.status !== "paid" || !inv.paid_at) continue;
        const m = inv.paid_at.substring(0, 7);
        if (!monthly[m]) monthly[m] = { inflow: 0, outflow: 0 };
        monthly[m].inflow += Number(inv.total) || 0;
      }

      for (const si of (supplierInvs || []) as any[]) {
        if (si.status !== "paid") continue;
        const m = si.invoice_date?.substring(0, 7) || "";
        if (!monthly[m]) monthly[m] = { inflow: 0, outflow: 0 };
        monthly[m].outflow += Number(si.amount) || 0;
      }

      const sorted = Object.entries(monthly)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-6)
        .map(([month, v]) => ({
          month,
          inflow: Math.round(v.inflow),
          outflow: Math.round(v.outflow),
          net: Math.round(v.inflow - v.outflow),
        }));

      // Fetch loan payments for outflow forecast
      const { data: loans } = await supabase
        .from("loans")
        .select("monthly_payment")
        .eq("tenant_id", tenantId!)
        .in("status", ["active"]);

      const monthlyLoanPayment = (loans || []).reduce((s: number, l: any) => s + (Number(l.monthly_payment) || 0), 0);

      return { historical: sorted, arTotal, monthlyLoanPayment };
    },
  });

  // Simple forecast: weighted moving average + AR + loans
  const forecastData = useMemo(() => {
    if (!historicalData?.historical || historicalData.historical.length < 2) return [];
    const hist = historicalData.historical;
    const rate = collectionRate[0] / 100;

    // Weighted average of last 3 months
    const weights = [0.5, 0.3, 0.2];
    const recent = hist.slice(-3);
    let avgInflow = 0, avgOutflow = 0;
    recent.forEach((m, i) => {
      const w = weights[i] || 0.1;
      avgInflow += m.inflow * w;
      avgOutflow += m.outflow * w;
    });

    // AR spread over 3 months
    const arPerMonth = (historicalData.arTotal * rate) / 3;
    const loanPayment = historicalData.monthlyLoanPayment;

    const lastMonth = hist[hist.length - 1].month;
    const forecast = [];
    for (let i = 1; i <= 3; i++) {
      const [y, m] = lastMonth.split("-").map(Number);
      const nm = m + i;
      const ny = y + Math.floor((nm - 1) / 12);
      const month = `${ny}-${String(((nm - 1) % 12) + 1).padStart(2, "0")}`;
      const inflow = Math.round(avgInflow + arPerMonth);
      const outflow = Math.round(avgOutflow + loanPayment);
      forecast.push({ month, inflow, outflow, net: inflow - outflow, forecast: true });
    }

    return [...hist.map(h => ({ ...h, forecast: false })), ...forecast];
  }, [historicalData, collectionRate]);

  return (
    <div className="space-y-6">
      <PageHeader title={sr ? "Prognoza novčanog toka" : "Cash Flow Forecast"} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardContent className="p-4 space-y-1">
            <p className="text-xs text-muted-foreground uppercase">{sr ? "Neplaćena potraživanja" : "Outstanding AR"}</p>
            <p className="text-2xl font-bold">{(historicalData?.arTotal || 0).toLocaleString()} RSD</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1">
            <p className="text-xs text-muted-foreground uppercase">{sr ? "Mesečna rata kredita" : "Monthly Loan Payment"}</p>
            <p className="text-2xl font-bold">{(historicalData?.monthlyLoanPayment || 0).toLocaleString()} RSD</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-3">
            <Label className="text-xs">{sr ? "Očekivana stopa naplate" : "Expected Collection Rate"}: {collectionRate[0]}%</Label>
            <Slider value={collectionRate} onValueChange={setCollectionRate} min={50} max={100} step={5} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            {sr ? "Istorijski + prognoza (3 meseca)" : "Historical + Forecast (3 months)"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-80" /> : (
            <ResponsiveContainer width="100%" height={350}>
              <ComposedChart data={forecastData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="inflow" name={sr ? "Priliv" : "Inflow"} stroke="hsl(160, 60%, 45%)" strokeWidth={2}
                  strokeDasharray={undefined} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="outflow" name={sr ? "Odliv" : "Outflow"} stroke="hsl(0, 72%, 51%)" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="net" name={sr ? "Neto" : "Net"} stroke="hsl(220, 70%, 50%)" strokeWidth={2.5} dot={{ r: 3 }} />
                <ReferenceLine y={0} stroke="hsl(220, 15%, 50%)" strokeDasharray="3 3" />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
