import { useLanguage } from "@/i18n/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { fmtNum } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface Props {
  tenantId: string;
}

export function RevenueExpensesChart({ tenantId }: Props) {
  const { t } = useLanguage();
  const isMobile = useIsMobile();

  const { data: chartData = [] } = useQuery({
    queryKey: ["dashboard-rev-exp-chart", tenantId],
    queryFn: async () => {
      const { data } = await supabase.rpc("dashboard_revenue_expenses_monthly", {
        _tenant_id: tenantId!,
        _months: 6,
      });
      return (data as any[] || []).map((row: any) => ({
        month: row.month_label,
        revenue: Number(row.revenue),
        expenses: Number(row.expenses),
      }));
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 5,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("revenueVsExpenses")}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={isMobile ? 220 : 280}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="month" className="text-xs" />
            <YAxis className="text-xs" />
            <Tooltip formatter={(v: number) => fmtNum(v)} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
            <Legend />
            <Bar dataKey="revenue" name={t("revenue")} fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expenses" name={t("expenses")} fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
