import { useMemo } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatsBar } from "@/components/shared/StatsBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/shared/ResponsiveTable";
import { ShieldCheck, AlertTriangle, TrendingDown, Activity } from "lucide-react";
import { fmtNum } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface ProductQuality {
  productId: string;
  productName: string;
  totalInspections: number;
  passCount: number;
  failCount: number;
  defectRate: number;
  predictedDefectRate: number;
  qualityScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  trend: "improving" | "stable" | "declining";
}

export default function AiQualityPrediction() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();

  const { data, isLoading } = useQuery({
    queryKey: ["ai-quality-prediction", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      // Fetch quality inspections
      const { data: inspections } = await (supabase as any)
        .from("quality_inspections")
        .select("id, production_order_id, result, inspection_date, defects_found, notes")
        .eq("tenant_id", tenantId!);

      // Fetch production orders for product mapping
      const { data: orders } = await (supabase as any)
        .from("production_orders")
        .select("id, product_id, product_name")
        .eq("tenant_id", tenantId!);

      const orderMap = new Map((orders || []).map((o: any) => [o.id, { productId: o.product_id as string, productName: o.product_name as string }]));

      // Group inspections by product
      const productStats = new Map<string, {
        name: string; total: number; pass: number; fail: number;
        monthlyDefects: Map<string, { total: number; failed: number }>;
      }>();

      for (const insp of (inspections || []) as any[]) {
        const order = orderMap.get(insp.production_order_id) as { productId: string; productName: string } | undefined;
        if (!order) continue;
        const pid = order.productId || insp.production_order_id;
        const pname = order.productName || "Unknown";

        if (!productStats.has(pid)) {
          productStats.set(pid, { name: pname, total: 0, pass: 0, fail: 0, monthlyDefects: new Map() });
        }
        const stats = productStats.get(pid)!;
        stats.total++;
        const passed = insp.result === "pass" || insp.result === "passed";
        if (passed) stats.pass++; else stats.fail++;

        if (insp.inspection_date) {
          const monthKey = String(insp.inspection_date).substring(0, 7);
          if (!stats.monthlyDefects.has(monthKey)) stats.monthlyDefects.set(monthKey, { total: 0, failed: 0 });
          const md = stats.monthlyDefects.get(monthKey)!;
          md.total++;
          if (!passed) md.failed++;
        }
      }

      // Build predictions using weighted moving average of monthly defect rates
      const products: ProductQuality[] = [];
      for (const [pid, stats] of productStats) {
        if (stats.total < 2) continue;
        const defectRate = stats.total > 0 ? (stats.fail / stats.total) * 100 : 0;

        // Monthly trend for prediction
        const sortedMonths = Array.from(stats.monthlyDefects.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        const monthlyRates = sortedMonths.map(([, v]) => v.total > 0 ? (v.failed / v.total) * 100 : 0);

        // Exponential weighted moving average for prediction
        let predicted = defectRate;
        if (monthlyRates.length >= 2) {
          const alpha = 0.3;
          let ewma = monthlyRates[0];
          for (let i = 1; i < monthlyRates.length; i++) {
            ewma = alpha * monthlyRates[i] + (1 - alpha) * ewma;
          }
          predicted = Math.round(ewma * 10) / 10;
        }

        // Trend detection
        let trend: ProductQuality["trend"] = "stable";
        if (monthlyRates.length >= 3) {
          const recent = monthlyRates.slice(-2).reduce((a, b) => a + b, 0) / 2;
          const earlier = monthlyRates.slice(0, -2).reduce((a, b) => a + b, 0) / Math.max(1, monthlyRates.length - 2);
          if (recent < earlier * 0.8) trend = "improving";
          else if (recent > earlier * 1.2) trend = "declining";
        }

        const qualityScore = Math.max(0, Math.round(100 - predicted * 2));
        let riskLevel: ProductQuality["riskLevel"] = "low";
        if (predicted > 15) riskLevel = "critical";
        else if (predicted > 10) riskLevel = "high";
        else if (predicted > 5) riskLevel = "medium";

        products.push({
          productId: pid,
          productName: stats.name,
          totalInspections: stats.total,
          passCount: stats.pass,
          failCount: stats.fail,
          defectRate: Math.round(defectRate * 10) / 10,
          predictedDefectRate: predicted,
          qualityScore,
          riskLevel,
          trend,
        });
      }

      products.sort((a, b) => b.predictedDefectRate - a.predictedDefectRate);

      // Monthly trend for chart
      const allMonthly = new Map<string, { total: number; failed: number }>();
      for (const [, stats] of productStats) {
        for (const [month, data] of stats.monthlyDefects) {
          if (!allMonthly.has(month)) allMonthly.set(month, { total: 0, failed: 0 });
          const m = allMonthly.get(month)!;
          m.total += data.total;
          m.failed += data.failed;
        }
      }
      const trendChart = Array.from(allMonthly.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, data]) => ({
          month,
          defectRate: data.total > 0 ? Math.round((data.failed / data.total) * 1000) / 10 : 0,
          inspections: data.total,
        }));

      return { products, trendChart };
    },
  });

  const products = data?.products || [];
  const trendChart = data?.trendChart || [];
  const critCount = products.filter(p => p.riskLevel === "critical").length;
  const highCount = products.filter(p => p.riskLevel === "high").length;
  const avgScore = products.length > 0 ? Math.round(products.reduce((s, p) => s + p.qualityScore, 0) / products.length) : 0;
  const avgDefect = products.length > 0 ? Math.round(products.reduce((s, p) => s + p.predictedDefectRate, 0) / products.length * 10) / 10 : 0;

  const stats = [
    { label: t("totalProducts" as any), value: products.length, icon: Activity, color: "text-primary" },
    { label: t("predictedDefectRate" as any), value: `${avgDefect}%`, icon: AlertTriangle, color: "text-destructive" },
    { label: t("qualityScore" as any), value: avgScore, icon: ShieldCheck, color: "text-primary" },
    { label: t("topRiskProducts" as any), value: critCount + highCount, icon: TrendingDown, color: "text-orange-500" },
  ];

  const riskColors: Record<string, string> = {
    low: "bg-green-500/10 text-green-700 border-green-500/20",
    medium: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
    high: "bg-orange-500/10 text-orange-700 border-orange-500/20",
    critical: "bg-destructive/10 text-destructive border-destructive/20",
  };

  const trendLabels: Record<string, string> = {
    improving: "↑ Improving",
    stable: "→ Stable",
    declining: "↓ Declining",
  };

  const columns: ResponsiveColumn<ProductQuality>[] = [
    { key: "productName", label: t("product" as any), primary: true, sortable: true, sortValue: (p) => p.productName, render: (p) => <span className="font-medium">{p.productName}</span> },
    { key: "totalInspections", label: t("total" as any), align: "right", sortable: true, sortValue: (p) => p.totalInspections, render: (p) => p.totalInspections },
    { key: "defectRate", label: t("defectProbability" as any), align: "right", sortable: true, sortValue: (p) => p.defectRate, render: (p) => `${p.defectRate}%` },
    { key: "predictedDefectRate", label: t("predictedDefectRate" as any), align: "right", sortable: true, sortValue: (p) => p.predictedDefectRate, render: (p) => <span className="font-bold">{p.predictedDefectRate}%</span> },
    { key: "qualityScore", label: t("qualityScore" as any), align: "right", sortable: true, sortValue: (p) => p.qualityScore, render: (p) => p.qualityScore },
    { key: "trend", label: t("qualityTrend" as any), render: (p) => <Badge variant="secondary" className="text-[10px]">{trendLabels[p.trend]}</Badge> },
    { key: "riskLevel", label: t("risk" as any), render: (p) => <Badge variant="outline" className={riskColors[p.riskLevel]}>{p.riskLevel}</Badge> },
  ];

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="space-y-6">
      <PageHeader title={t("aiQualityPrediction" as any)} icon={ShieldCheck} />
      <StatsBar stats={stats} />

      {trendChart.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("qualityTrend" as any)}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trendChart}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" unit="%" />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Line type="monotone" dataKey="defectRate" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} name={t("predictedDefectRate" as any)} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <ResponsiveTable
        data={products}
        columns={columns}
        keyExtractor={(p) => p.productId}
        emptyMessage={t("noResults")}
        enableExport
        exportFilename="ai_quality_predictions"
      />
    </div>
  );
}
