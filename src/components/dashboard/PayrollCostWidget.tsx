import { useLanguage } from "@/i18n/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users } from "lucide-react";
import { fmtNum } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useNavigate } from "react-router-dom";

interface Props {
  tenantId: string;
}

export function PayrollCostWidget({ tenantId }: Props) {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-payroll-cost", tenantId],
    queryFn: async () => {
      const { data: runs } = await supabase
        .from("payroll_runs")
        .select("period_month, period_year, total_gross, total_net, total_taxes, total_contributions, status")
        .eq("tenant_id", tenantId)
        .in("status", ["calculated", "approved", "paid"])
        .order("period_year", { ascending: true })
        .order("period_month", { ascending: true })
        .limit(12);

      if (!runs?.length) return null;

      const months = runs.map((r: any) => {
        const gross = Number(r.total_gross || 0);
        const taxes = Number(r.total_taxes || 0);
        const contributions = Number(r.total_contributions || 0);
        const net = Number(r.total_net || 0);
        const monthLabel = new Date(2024, r.period_month - 1).toLocaleString("sr-Latn", { month: "short" });
        return {
          label: `${monthLabel} ${String(r.period_year).slice(-2)}`,
          gross,
          net,
          taxes,
          contributions,
          employerCost: gross + contributions,
        };
      });

      const latest = months[months.length - 1];
      const prev = months.length > 1 ? months[months.length - 2] : null;
      const trend = prev ? ((latest.employerCost - prev.employerCost) / (prev.employerCost || 1)) * 100 : 0;

      return { months, latestCost: latest.employerCost, latestNet: latest.net, trend };
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[180px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/analytics/payroll-benchmark")}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          {t("payroll")} — {t("totalCost")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-3 mb-3">
          <span className="text-2xl font-bold tabular-nums">{fmtNum(data.latestCost)} RSD</span>
          {data.trend !== 0 && (
            <span className={`text-xs font-medium ${data.trend > 0 ? "text-destructive" : "text-accent"}`}>
              {data.trend > 0 ? "▲" : "▼"} {Math.abs(data.trend).toFixed(1)}%
            </span>
          )}
        </div>
        <div className="h-[160px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.months} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={40} />
              <Tooltip
                formatter={(value: number, name: string) => [fmtNum(value) + " RSD", name === "net" ? t("netSalary") : name === "taxes" ? t("totalTaxes") : t("contributions")]}
                contentStyle={{ fontSize: 12 }}
              />
              <Bar dataKey="net" stackId="a" fill="hsl(var(--primary))" radius={[0, 0, 0, 0]} />
              <Bar dataKey="taxes" stackId="a" fill="hsl(var(--destructive))" radius={[0, 0, 0, 0]} />
              <Bar dataKey="contributions" stackId="a" fill="hsl(var(--accent))" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
