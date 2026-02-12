import { useLanguage } from "@/i18n/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface Props {
  tenantId: string;
}

const COLORS = [
  "hsl(var(--muted-foreground))",
  "hsl(var(--accent))",
  "hsl(var(--primary))",
  "hsl(var(--destructive))",
];

export function InvoiceStatusChart({ tenantId }: Props) {
  const { t } = useLanguage();

  const statusLabels: Record<string, string> = {
    draft: t("draft"),
    sent: t("sent"),
    paid: t("paid"),
    cancelled: t("cancelled"),
  };

  const { data: chartData = [] } = useQuery({
    queryKey: ["dashboard-invoice-status-chart", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("status")
        .eq("tenant_id", tenantId);

      if (!data?.length) return [];

      const counts: Record<string, number> = {};
      for (const inv of data) {
        counts[inv.status] = (counts[inv.status] || 0) + 1;
      }

      return Object.entries(counts).map(([status, count]) => ({
        name: statusLabels[status] || status,
        value: count,
      }));
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 5,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("invoiceStatusDistribution")}</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">{t("noResults")}</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value">
                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
