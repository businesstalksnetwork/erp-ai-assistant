import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtNum } from "@/lib/utils";
import { Clock, TrendingUp, CheckCircle } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";

interface Props {
  supplierId: string;
}

export default function SupplierLeadTimeHistory({ supplierId }: Props) {
  const { locale } = useLanguage();
  const { tenantId } = useTenant();
  const sr = locale === "sr";
  const t = (en: string, srText: string) => sr ? srText : en;

  const { data: leadTimes, isLoading } = useQuery({
    queryKey: ["lead-times", tenantId, supplierId],
    enabled: !!tenantId && !!supplierId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("supplier_lead_times")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("supplier_id", supplierId)
        .order("received_date", { ascending: true })
        .limit(100);
      return data || [];
    },
  });

  if (isLoading) return <Skeleton className="h-48 w-full" />;
  if (!leadTimes || leadTimes.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground">
          {t("No lead time data available", "Nema podataka o rokovima isporuke")}
        </CardContent>
      </Card>
    );
  }

  const ltDays = leadTimes.map((lt: any) => lt.lead_time_days || 0);
  const avg = ltDays.reduce((a: number, b: number) => a + b, 0) / ltDays.length;
  const sorted = [...ltDays].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const onTimeCount = leadTimes.filter((lt: any) => lt.on_time).length;
  const onTimeRate = (onTimeCount / leadTimes.length) * 100;

  const chartData = leadTimes.map((lt: any) => ({
    date: lt.received_date,
    days: lt.lead_time_days,
    expected: lt.expected_lead_time_days,
  }));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("Avg Lead Time", "Prosečan rok")}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{avg.toFixed(1)} {t("days", "dana")}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("Median", "Medijana")}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{median} {t("days", "dana")}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("On-Time Rate", "Stopa tačnosti")}</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <Badge variant={onTimeRate >= 90 ? "default" : onTimeRate >= 70 ? "secondary" : "destructive"}>
                {Math.round(onTimeRate)}%
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("Lead Time Trend", "Trend rokova isporuke")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip />
              <ReferenceLine y={avg} stroke="hsl(var(--primary))" strokeDasharray="5 5" label={t("Avg", "Prosek")} />
              <Line type="monotone" dataKey="days" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} name={t("Actual", "Stvarni")} />
              {chartData.some((d: any) => d.expected) && (
                <Line type="monotone" dataKey="expected" stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" dot={false} name={t("Expected", "Očekivani")} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
