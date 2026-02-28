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
import { AlertTriangle, Users } from "lucide-react";
import { fmtNum } from "@/lib/utils";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis } from "recharts";

interface PartnerRisk {
  partnerName: string;
  avgDaysToPay: number;
  overdueRate: number;
  totalExposure: number;
  badPayerScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  creditLimitRec: number;
  paymentBehavior: "early" | "on-time" | "late" | "very-late";
}

export default function CustomerRiskScoring() {
  const { locale } = useLanguage();
  const { tenantId } = useTenant();
  const sr = locale === "sr";
  const t = (en: string, srText: string) => sr ? srText : en;

  const { data, isLoading } = useQuery({
    queryKey: ["customer-risk", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      // Fetch invoices with payment data
      const { data: invoices } = await (supabase
        .from("invoices")
        .select("id, partner_id, partner_name, invoice_date, due_date, paid_at, total_with_tax, status")
        .eq("tenant_id", tenantId!) as any);

      const { data: openItems } = await (supabase
        .from("open_items")
        .select("partner_id, remaining_amount, due_date, direction")
        .eq("tenant_id", tenantId!)
        .eq("direction", "receivable")
        .eq("status", "open") as any);

      // Fetch partner names
      const { data: partners } = await supabase
        .from("partners")
        .select("id, name")
        .eq("tenant_id", tenantId!);

      const partnerMap = new Map((partners || []).map(p => [p.id, p.name]));
      const now = new Date();

      // Group invoices by partner
      const partnerStats = new Map<string, { name: string; totalInvoices: number; overdueCount: number; totalDays: number; paidCount: number }>();

      for (const inv of invoices || []) {
        if (!inv.partner_id) continue;
        const name = inv.partner_name || partnerMap.get(inv.partner_id) || "Unknown";
        if (!partnerStats.has(inv.partner_id)) {
          partnerStats.set(inv.partner_id, { name, totalInvoices: 0, overdueCount: 0, totalDays: 0, paidCount: 0 });
        }
        const stats = partnerStats.get(inv.partner_id)!;
        stats.totalInvoices++;

        if (inv.paid_at && inv.invoice_date) {
          const daysToPay = Math.floor((new Date(inv.paid_at).getTime() - new Date(inv.invoice_date).getTime()) / 86400000);
          stats.totalDays += Math.max(0, daysToPay);
          stats.paidCount++;
        }
        if (inv.status === "overdue" || (inv.due_date && new Date(inv.due_date) < now && inv.status !== "paid")) {
          stats.overdueCount++;
        }
      }

      // Calculate exposure from open items
      const exposureMap = new Map<string, number>();
      for (const oi of openItems || []) {
        if (!oi.partner_id) continue;
        exposureMap.set(oi.partner_id, (exposureMap.get(oi.partner_id) || 0) + (Number(oi.remaining_amount) || 0));
      }

      // Build risk scores
      const risks: PartnerRisk[] = [];
      for (const [partnerId, stats] of partnerStats) {
        const avgDays = stats.paidCount > 0 ? Math.round(stats.totalDays / stats.paidCount) : 0;
        const overdueRate = stats.totalInvoices > 0 ? stats.overdueCount / stats.totalInvoices : 0;
        const exposure = exposureMap.get(partnerId) || 0;
        const normalizedExposure = Math.min(exposure / 1000000, 1); // normalize to 1M
        const score = Math.round((avgDays * 0.4) + (overdueRate * 100 * 0.3) + (normalizedExposure * 100 * 0.3));

        let riskLevel: PartnerRisk["riskLevel"] = "low";
        if (score > 70) riskLevel = "critical";
        else if (score > 50) riskLevel = "high";
        else if (score > 30) riskLevel = "medium";

        // Credit limit recommendation: based on avg monthly billing * risk multiplier
        const avgMonthlyBilling = stats.totalInvoices > 0 ? exposure / Math.max(1, stats.totalInvoices / 12) : 0;
        const riskMultiplier = riskLevel === "critical" ? 0.5 : riskLevel === "high" ? 1 : riskLevel === "medium" ? 1.5 : 2;
        const creditLimitRec = Math.round(avgMonthlyBilling * riskMultiplier);

        // Payment behavior classification
        let paymentBehavior: PartnerRisk["paymentBehavior"] = "on-time";
        if (avgDays <= 15) paymentBehavior = "early";
        else if (avgDays <= 30) paymentBehavior = "on-time";
        else if (avgDays <= 60) paymentBehavior = "late";
        else paymentBehavior = "very-late";

        if (stats.totalInvoices > 0) {
          risks.push({
            partnerName: stats.name,
            avgDaysToPay: avgDays,
            overdueRate: Math.round(overdueRate * 100),
            totalExposure: Math.round(exposure),
            badPayerScore: score,
            riskLevel,
            creditLimitRec,
            paymentBehavior,
          });
        }
      }

      risks.sort((a, b) => b.badPayerScore - a.badPayerScore);
      return risks;
    },
  });

  const riskColors: Record<string, string> = {
    low: "bg-green-500/10 text-green-700 border-green-500/20",
    medium: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
    high: "bg-orange-500/10 text-orange-700 border-orange-500/20",
    critical: "bg-destructive/10 text-destructive border-destructive/20",
  };

  const scatterData = (data || []).map(r => ({
    x: r.avgDaysToPay,
    y: r.totalExposure,
    z: r.badPayerScore,
    name: r.partnerName,
  }));

  const critCount = (data || []).filter(r => r.riskLevel === "critical").length;
  const highCount = (data || []).filter(r => r.riskLevel === "high").length;

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="space-y-6">
      <PageHeader title={t("Customer Payment Risk Scoring", "Analiza rizika kupaca")} icon={AlertTriangle} />

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase">{t("Total Customers", "Ukupno kupaca")}</p><p className="text-2xl font-bold mt-1">{(data || []).length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase">{t("Critical Risk", "Kritičan rizik")}</p><p className="text-2xl font-bold mt-1 text-destructive">{critCount}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase">{t("High Risk", "Visok rizik")}</p><p className="text-2xl font-bold mt-1 text-orange-600">{highCount}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase">{t("Total Exposure", "Ukupna izloženost")}</p><p className="text-2xl font-bold mt-1">{fmtNum((data || []).reduce((s, r) => s + r.totalExposure, 0))}</p></CardContent></Card>
      </div>

      {/* Scatter plot */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("Exposure vs Payment Delay", "Izloženost vs kašnjenje")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="x" name={t("Avg Days", "Prosečno dana")} type="number" className="text-xs" />
              <YAxis dataKey="y" name={t("Exposure", "Izloženost")} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} className="text-xs" />
              <ZAxis dataKey="z" range={[50, 400]} />
              <Tooltip formatter={(v: number, name: string) => name === "y" ? `${fmtNum(v)} RSD` : v} />
              <Scatter data={scatterData} fill="hsl(var(--primary))" />
            </ScatterChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Risk table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            {t("Customer Risk Table", "Tabela rizika kupaca")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Customer", "Kupac")}</TableHead>
                <TableHead className="text-right">{t("Avg Days", "Prosečno dana")}</TableHead>
                <TableHead className="text-right">{t("Overdue %", "Kašnjenje %")}</TableHead>
                <TableHead className="text-right">{t("Exposure", "Izloženost")}</TableHead>
                <TableHead className="text-right">{t("Credit Limit", "Kreditni limit")}</TableHead>
                <TableHead>{t("Payment", "Plaćanje")}</TableHead>
                <TableHead className="text-right">{t("Score", "Skor")}</TableHead>
                <TableHead>{t("Risk", "Rizik")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data || []).slice(0, 20).map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{r.partnerName}</TableCell>
                  <TableCell className="text-right">{r.avgDaysToPay}</TableCell>
                  <TableCell className="text-right">{r.overdueRate}%</TableCell>
                  <TableCell className="text-right">{fmtNum(r.totalExposure)}</TableCell>
                  <TableCell className="text-right">{fmtNum(r.creditLimitRec)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px]">
                      {{ early: "⚡ Early", "on-time": "✓ On-time", late: "⏰ Late", "very-late": "🔴 Very Late" }[r.paymentBehavior]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-bold">{r.badPayerScore}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={riskColors[r.riskLevel]}>
                      {sr ? { low: "Nizak", medium: "Srednji", high: "Visok", critical: "Kritičan" }[r.riskLevel] : r.riskLevel.charAt(0).toUpperCase() + r.riskLevel.slice(1)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {tenantId && data && data.length > 0 && (
        <AiAnalyticsNarrative
          tenantId={tenantId}
          contextType="customer_risk"
          data={{
            totalCustomers: data.length,
            criticalRisk: critCount,
            highRisk: highCount,
            totalExposure: data.reduce((s, r) => s + r.totalExposure, 0),
            topRisks: data.slice(0, 5).map(r => ({
              name: r.partnerName,
              score: r.badPayerScore,
              avgDays: r.avgDaysToPay,
              exposure: r.totalExposure,
            })),
          }}
        />
      )}
    </div>
  );
}
