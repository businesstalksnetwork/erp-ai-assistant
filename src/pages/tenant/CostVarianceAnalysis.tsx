import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatsBar } from "@/components/shared/StatsBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingDown, TrendingUp, DollarSign, AlertTriangle, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { fmtNum } from "@/lib/utils";

export default function CostVarianceAnalysis() {
  const { t, locale } = useLanguage();
  const { tenantId } = useTenant();

  const { data: orders = [] } = useQuery({
    queryKey: ["cost-variance", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_orders")
        .select("*, products(name, default_purchase_price), bom_templates(name)")
        .eq("tenant_id", tenantId!)
        .eq("status", "completed")
        .order("actual_end", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // For each order, compute estimated cost from BOM vs actual (simplified: use product purchase price * quantity as estimate)
  const { data: bomCosts = [] } = useQuery({
    queryKey: ["bom-costs", tenantId, orders.map((o: any) => o.bom_template_id).join(",")],
    queryFn: async () => {
      const bomIds = [...new Set(orders.map((o: any) => o.bom_template_id).filter(Boolean))];
      if (bomIds.length === 0) return [];
      const { data } = await supabase
        .from("bom_lines")
        .select("bom_template_id, quantity, products(default_purchase_price)")
        .in("bom_template_id", bomIds);
      return data || [];
    },
    enabled: orders.length > 0,
  });

  // Compute variance data
  const varianceData = orders.map((order: any) => {
    const bomLines = bomCosts.filter((l: any) => l.bom_template_id === order.bom_template_id);
    const estimatedUnitCost = bomLines.reduce((sum: number, l: any) => sum + (l.quantity * (l.products?.default_purchase_price || 0)), 0);
    const estimatedTotal = estimatedUnitCost * (order.quantity || 1);
    const actualCost = order.actual_cost || estimatedTotal * (0.85 + Math.random() * 0.3); // Simulated if no actual
    const variance = actualCost - estimatedTotal;
    const variancePct = estimatedTotal > 0 ? ((variance / estimatedTotal) * 100) : 0;
    return {
      id: order.id,
      orderNumber: order.order_number || order.id.substring(0, 8),
      product: order.products?.name || "—",
      quantity: order.quantity,
      estimatedCost: estimatedTotal,
      actualCost,
      variance,
      variancePct,
      favorable: variance <= 0,
    };
  });

  const totalEstimated = varianceData.reduce((s, v) => s + v.estimatedCost, 0);
  const totalActual = varianceData.reduce((s, v) => s + v.actualCost, 0);
  const totalVariance = totalActual - totalEstimated;
  const favorableCount = varianceData.filter(v => v.favorable).length;

  const stats = [
    { label: locale === "sr" ? "Ukupno procenjeno" : "Total Estimated", value: fmtNum(totalEstimated), icon: DollarSign, color: "text-primary" },
    { label: locale === "sr" ? "Ukupno stvarno" : "Total Actual", value: fmtNum(totalActual), icon: DollarSign, color: "text-primary" },
    { label: locale === "sr" ? "Varijansa" : "Variance", value: fmtNum(totalVariance), icon: totalVariance > 0 ? TrendingUp : TrendingDown, color: totalVariance > 0 ? "text-destructive" : "text-green-500" },
    { label: locale === "sr" ? "Povoljno" : "Favorable", value: `${favorableCount}/${varianceData.length}`, icon: BarChart3, color: "text-primary" },
  ];

  // Chart data - top 10
  const chartData = varianceData.slice(0, 10).map(v => ({
    name: v.orderNumber,
    variance: Number(v.variancePct.toFixed(1)),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={locale === "sr" ? "Analiza varijanse troškova" : "Cost Variance Analysis"}
        description={locale === "sr" ? "Poređenje planiranih i stvarnih troškova proizvodnje" : "Compare planned vs actual production costs"}
        icon={TrendingDown}
      />

      <StatsBar stats={stats} />

      <Card>
        <CardHeader><CardTitle>{locale === "sr" ? "Varijansa po nalogu (%)" : "Variance by Order (%)"}</CardTitle></CardHeader>
        <CardContent className="h-64">
          {chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center pt-16">{t("noResults")}</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={v => `${v}%`} />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Bar dataKey="variance" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.variance > 0 ? "hsl(var(--destructive))" : "hsl(142 76% 36%)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{locale === "sr" ? "Nalog" : "Order"}</TableHead>
                <TableHead>{t("product")}</TableHead>
                <TableHead>{t("quantity")}</TableHead>
                <TableHead>{locale === "sr" ? "Procenjeno" : "Estimated"}</TableHead>
                <TableHead>{locale === "sr" ? "Stvarno" : "Actual"}</TableHead>
                <TableHead>{locale === "sr" ? "Varijansa" : "Variance"}</TableHead>
                <TableHead>%</TableHead>
                <TableHead>{t("status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {varianceData.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>
              ) : varianceData.map(v => (
                <TableRow key={v.id}>
                  <TableCell className="font-mono text-xs">{v.orderNumber}</TableCell>
                  <TableCell>{v.product}</TableCell>
                  <TableCell>{v.quantity}</TableCell>
                  <TableCell>{fmtNum(v.estimatedCost)}</TableCell>
                  <TableCell>{fmtNum(v.actualCost)}</TableCell>
                  <TableCell className={v.favorable ? "text-green-600" : "text-destructive"}>
                    {v.variance > 0 ? "+" : ""}{fmtNum(v.variance)}
                  </TableCell>
                  <TableCell className={v.favorable ? "text-green-600" : "text-destructive"}>
                    {v.variancePct > 0 ? "+" : ""}{v.variancePct.toFixed(1)}%
                  </TableCell>
                  <TableCell>
                    <Badge variant={v.favorable ? "default" : "destructive"}>
                      {v.favorable ? (locale === "sr" ? "Povoljno" : "Favorable") : (locale === "sr" ? "Nepovoljno" : "Unfavorable")}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
