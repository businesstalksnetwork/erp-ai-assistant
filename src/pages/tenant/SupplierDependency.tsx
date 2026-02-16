import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AiAnalyticsNarrative } from "@/components/ai/AiAnalyticsNarrative";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Truck, AlertTriangle } from "lucide-react";
import { fmtNum } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function SupplierDependency() {
  const { locale } = useLanguage();
  const { tenantId } = useTenant();
  const sr = locale === "sr";
  const t = (en: string, srText: string) => sr ? srText : en;

  const { data, isLoading } = useQuery({
    queryKey: ["supplier-dependency", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const currentYear = new Date().getFullYear();
      const { data: invoices } = await (supabase
        .from("supplier_invoices")
        .select("id, partner_id, total_amount, invoice_date, status")
        .eq("tenant_id", tenantId!) as any);

      const { data: partners } = await supabase
        .from("partners")
        .select("id, name")
        .eq("tenant_id", tenantId!);

      const partnerMap = new Map((partners || []).map(p => [p.id, p.name]));

      // Group by supplier and year
      const supplierSpend = new Map<string, { name: string; currentYear: number; prevYear: number; count: number }>();

      for (const inv of invoices || []) {
        if (!inv.partner_id || inv.status === "cancelled") continue;
        const year = new Date(inv.invoice_date).getFullYear();
        const amount = Number(inv.total_amount) || 0;
        const name = partnerMap.get(inv.partner_id) || "Unknown";

        if (!supplierSpend.has(inv.partner_id)) {
          supplierSpend.set(inv.partner_id, { name, currentYear: 0, prevYear: 0, count: 0 });
        }
        const s = supplierSpend.get(inv.partner_id)!;
        if (year === currentYear) { s.currentYear += amount; s.count++; }
        else if (year === currentYear - 1) { s.prevYear += amount; }
      }

      const suppliers = Array.from(supplierSpend.values())
        .sort((a, b) => b.currentYear - a.currentYear);

      const totalSpend = suppliers.reduce((s, sup) => s + sup.currentYear, 0);
      const top3Spend = suppliers.slice(0, 3).reduce((s, sup) => s + sup.currentYear, 0);
      const concentrationRisk = totalSpend > 0 ? (top3Spend / totalSpend * 100) : 0;

      const top10 = suppliers.slice(0, 10).map(s => ({
        name: s.name,
        spend: Math.round(s.currentYear),
        prevSpend: Math.round(s.prevYear),
        yoyChange: s.prevYear > 0 ? Math.round((s.currentYear - s.prevYear) / s.prevYear * 100) : 0,
        invoiceCount: s.count,
        shareOfTotal: totalSpend > 0 ? Math.round(s.currentYear / totalSpend * 100) : 0,
      }));

      return { top10, totalSpend: Math.round(totalSpend), concentrationRisk: Math.round(concentrationRisk), supplierCount: suppliers.length };
    },
  });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>;

  const chartData = (data?.top10 || []).map(s => ({ name: s.name.length > 15 ? s.name.substring(0, 15) + "…" : s.name, spend: s.spend }));

  return (
    <div className="space-y-6">
      <PageHeader title={t("Supplier Dependency & Cost Exposure", "Zavisnost od dobavljača")} icon={Truck} />

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase">{t("Total Spend YTD", "Ukupna potrošnja YTD")}</p><p className="text-2xl font-bold mt-1">{fmtNum(data?.totalSpend || 0)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase">{t("Suppliers", "Dobavljači")}</p><p className="text-2xl font-bold mt-1">{data?.supplierCount || 0}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase">{t("Top 3 Concentration", "Top 3 koncentracija")}</p><p className={`text-2xl font-bold mt-1 ${(data?.concentrationRisk || 0) > 70 ? "text-destructive" : ""}`}>{data?.concentrationRisk || 0}%</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase">{t("Highest YoY Change", "Najveća YoY promena")}</p><p className="text-2xl font-bold mt-1">{data?.top10?.[0] ? `${data.top10.reduce((m, s) => Math.abs(s.yoyChange) > Math.abs(m) ? s.yoyChange : m, 0)}%` : "0%"}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">{t("Top 10 Suppliers by Spend", "Top 10 dobavljača po potrošnji")}</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} className="text-xs" />
              <YAxis dataKey="name" type="category" width={120} className="text-xs" />
              <Tooltip formatter={(v: number) => `${fmtNum(v)} RSD`} />
              <Bar dataKey="spend" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">{t("Supplier Detail", "Detalji dobavljača")}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Supplier", "Dobavljač")}</TableHead>
                <TableHead className="text-right">{t("Spend YTD", "Potrošnja YTD")}</TableHead>
                <TableHead className="text-right">{t("Share %", "Udeo %")}</TableHead>
                <TableHead className="text-right">{t("YoY Change", "YoY promena")}</TableHead>
                <TableHead className="text-right">{t("Invoices", "Fakture")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.top10 || []).map((s, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-right">{fmtNum(s.spend)}</TableCell>
                  <TableCell className="text-right">{s.shareOfTotal}%</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline" className={s.yoyChange > 15 ? "text-destructive" : s.yoyChange < -5 ? "text-green-600" : ""}>
                      {s.yoyChange > 0 ? "+" : ""}{s.yoyChange}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{s.invoiceCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {tenantId && data && (
        <AiAnalyticsNarrative
          tenantId={tenantId}
          contextType="supplier_risk"
          data={{
            totalSpend: data.totalSpend,
            supplierCount: data.supplierCount,
            concentrationRiskPercent: data.concentrationRisk,
            top5: data.top10.slice(0, 5).map(s => ({ name: s.name, spend: s.spend, yoyChange: s.yoyChange, share: s.shareOfTotal })),
          }}
        />
      )}
    </div>
  );
}
