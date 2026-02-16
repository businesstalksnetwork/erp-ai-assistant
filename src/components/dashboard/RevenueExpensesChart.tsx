import { useLanguage } from "@/i18n/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { subMonths, format, startOfMonth, endOfMonth } from "date-fns";
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
      const now = new Date();
      const months = Array.from({ length: 6 }, (_, i) => {
        const d = subMonths(now, 5 - i);
        return { start: startOfMonth(d), end: endOfMonth(d), label: format(d, "MMM yy") };
      });

      const { data: entries } = await supabase
        .from("journal_entries")
        .select("id, entry_date")
        .eq("tenant_id", tenantId)
        .eq("status", "posted")
        .gte("entry_date", months[0].start.toISOString().split("T")[0])
        .lte("entry_date", months[5].end.toISOString().split("T")[0]);

      if (!entries?.length) return months.map((m) => ({ month: m.label, revenue: 0, expenses: 0 }));

      const entryIds = entries.map((e) => e.id);

      const { data: revenueAccts } = await supabase
        .from("chart_of_accounts").select("id").eq("tenant_id", tenantId).eq("account_type", "revenue");
      const { data: expenseAccts } = await supabase
        .from("chart_of_accounts").select("id").eq("tenant_id", tenantId).eq("account_type", "expense");

      const revIds = new Set((revenueAccts || []).map((a) => a.id));
      const expIds = new Set((expenseAccts || []).map((a) => a.id));

      const { data: lines } = await supabase
        .from("journal_lines")
        .select("journal_entry_id, account_id, debit, credit")
        .in("journal_entry_id", entryIds);

      const entryDateMap = new Map(entries.map((e) => [e.id, e.entry_date]));

      const result = months.map((m) => ({ month: m.label, revenue: 0, expenses: 0 }));

      for (const line of lines || []) {
        const entryDate = entryDateMap.get(line.journal_entry_id);
        if (!entryDate) continue;
        const d = new Date(entryDate);
        const idx = months.findIndex((m) => d >= m.start && d <= m.end);
        if (idx === -1) continue;

        if (revIds.has(line.account_id)) result[idx].revenue += Number(line.credit) - Number(line.debit);
        if (expIds.has(line.account_id)) result[idx].expenses += Number(line.debit) - Number(line.credit);
      }

      return result;
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
