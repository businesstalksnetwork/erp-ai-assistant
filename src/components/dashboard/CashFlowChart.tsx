import { useLanguage } from "@/i18n/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { subMonths, format, startOfMonth, endOfMonth } from "date-fns";

interface Props {
  tenantId: string;
}

export function CashFlowChart({ tenantId }: Props) {
  const { t } = useLanguage();

  const { data: chartData = [] } = useQuery({
    queryKey: ["dashboard-cashflow", tenantId],
    queryFn: async () => {
      const now = new Date();
      const months = Array.from({ length: 6 }, (_, i) => {
        const d = subMonths(now, 5 - i);
        return { start: startOfMonth(d), end: endOfMonth(d), label: format(d, "MMM yy") };
      });

      const { data: invoices } = await supabase
        .from("invoices")
        .select("total, status, invoice_date")
        .eq("tenant_id", tenantId)
        .gte("invoice_date", months[0].start.toISOString().split("T")[0]);

      const result = months.map((m) => {
        const monthInvoices = (invoices || []).filter((inv) => {
          const d = new Date(inv.invoice_date);
          return d >= m.start && d <= m.end;
        });
        const inflow = monthInvoices.filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.total), 0);
        const outflow = monthInvoices.filter((i) => i.status !== "paid").reduce((s, i) => s + Number(i.total), 0) * 0.3; // approximate
        return { month: m.label, inflow, outflow, net: inflow - outflow };
      });
      return result;
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 5,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("cashFlow") || "Cash Flow"}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="cfGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="month" className="text-xs" />
            <YAxis className="text-xs" />
            <Tooltip />
            <Area type="monotone" dataKey="inflow" stroke="hsl(var(--accent))" fill="hsl(var(--accent) / 0.2)" name={t("inflow")} />
            <Area type="monotone" dataKey="net" stroke="hsl(var(--primary))" fill="url(#cfGrad)" name="Net" />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
