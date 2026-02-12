import { useLanguage } from "@/i18n/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface Props {
  tenantId: string;
}

export function TopCustomersChart({ tenantId }: Props) {
  const { t } = useLanguage();

  const { data: chartData = [] } = useQuery({
    queryKey: ["dashboard-top-customers", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("partner_name, total")
        .eq("tenant_id", tenantId)
        .eq("status", "paid");

      if (!data?.length) return [];

      const totals: Record<string, number> = {};
      for (const inv of data) {
        const name = inv.partner_name || "Unknown";
        totals[name] = (totals[name] || 0) + Number(inv.total);
      }

      return Object.entries(totals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, total]) => ({ name: name.length > 15 ? name.slice(0, 15) + "…" : name, total }));
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 5,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("topCustomers") || "Top Customers"}</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">{t("noResults")}</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} layout="vertical">
              <XAxis type="number" className="text-xs" />
              <YAxis dataKey="name" type="category" width={120} className="text-xs" />
              <Tooltip />
              <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name={t("total")} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
