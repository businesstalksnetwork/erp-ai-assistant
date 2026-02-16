import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AiAnalyticsNarrative } from "@/components/ai/AiAnalyticsNarrative";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, TrendingDown, Banknote, Timer } from "lucide-react";
import { fmtNum } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function WorkingCapitalStress() {
  const { locale } = useLanguage();
  const { tenantId } = useTenant();
  const sr = locale === "sr";
  const t = (en: string, srText: string) => sr ? srText : en;

  const { data, isLoading } = useQuery({
    queryKey: ["working-capital-stress", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      // Fetch journal lines for asset/liability classification
      const { data: lines } = await (supabase
        .from("journal_lines")
        .select("debit, credit, chart_of_accounts:account_id(account_type, code), journal:journal_entry_id(status, tenant_id)")
        .eq("journal.tenant_id", tenantId!) as any);

      let currentAssets = 0, currentLiabilities = 0, cash = 0, inventory = 0;
      for (const line of (lines as any[]) || []) {
        if (line.journal?.status !== "posted") continue;
        const code = line.chart_of_accounts?.code || "";
        const type = line.chart_of_accounts?.account_type || "";
        const net = (Number(line.debit) || 0) - (Number(line.credit) || 0);

        if (type === "asset") {
          if (code.startsWith("24") || code.startsWith("20") || code.startsWith("21")) {
            cash += net;
            currentAssets += net;
          } else if (code.startsWith("13") || code.startsWith("10") || code.startsWith("11") || code.startsWith("12")) {
            inventory += net;
            currentAssets += net;
          } else if (code.startsWith("2")) {
            currentAssets += net;
          }
        } else if (type === "liability") {
          if (code.startsWith("4") || code.startsWith("27")) {
            currentLiabilities += Math.abs(net);
          }
        }
      }

      // Fetch open items for AR/AP
      const { data: openItems } = await supabase
        .from("open_items")
        .select("direction, remaining_amount, due_date")
        .eq("tenant_id", tenantId!)
        .eq("status", "open");

      let totalAR = 0, totalAP = 0;
      let arOver30 = 0, arOver60 = 0, arOver90 = 0;
      const now = new Date();
      for (const item of openItems || []) {
        const remaining = Number(item.remaining_amount) || 0;
        const dueDate = new Date(item.due_date);
        const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / 86400000);

        if (item.direction === "receivable") {
          totalAR += remaining;
          if (daysOverdue > 90) arOver90 += remaining;
          else if (daysOverdue > 60) arOver60 += remaining;
          else if (daysOverdue > 30) arOver30 += remaining;
        } else {
          totalAP += remaining;
        }
      }

      const currentRatio = currentLiabilities > 0 ? currentAssets / currentLiabilities : 0;
      const quickRatio = currentLiabilities > 0 ? (currentAssets - inventory) / currentLiabilities : 0;
      const nwc = currentAssets - currentLiabilities;
      const monthlyBurn = currentLiabilities > 0 ? currentLiabilities / 12 : 1;
      const cashRunway = monthlyBurn > 0 ? cash / monthlyBurn : 99;

      // Liquidity gap waterfall
      const gap30 = cash + (totalAR * 0.3) - (totalAP * 0.4);
      const gap60 = cash + (totalAR * 0.6) - (totalAP * 0.7);
      const gap90 = cash + totalAR - totalAP;

      return {
        currentRatio, quickRatio, nwc, cashRunway: Math.round(cashRunway * 10) / 10,
        cash, totalAR, totalAP, inventory,
        arOver30, arOver60, arOver90,
        gap30, gap60, gap90,
      };
    },
  });

  const waterfallData = data ? [
    { name: sr ? "Gotovina" : "Cash", value: Math.round(data.cash), fill: "hsl(var(--primary))" },
    { name: sr ? "Očekivani AR" : "Expected AR", value: Math.round(data.totalAR), fill: "hsl(var(--accent))" },
    { name: sr ? "Dospeli AP" : "Due AP", value: -Math.round(data.totalAP), fill: "hsl(var(--destructive))" },
    { name: sr ? "Gep 30d" : "Gap 30d", value: Math.round(data.gap30), fill: data.gap30 >= 0 ? "hsl(var(--accent))" : "hsl(var(--destructive))" },
    { name: sr ? "Gep 60d" : "Gap 60d", value: Math.round(data.gap60), fill: data.gap60 >= 0 ? "hsl(var(--accent))" : "hsl(var(--destructive))" },
    { name: sr ? "Gep 90d" : "Gap 90d", value: Math.round(data.gap90), fill: data.gap90 >= 0 ? "hsl(var(--accent))" : "hsl(var(--destructive))" },
  ] : [];

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="space-y-6">
      <PageHeader title={t("Working Capital & Liquidity Stress", "Obrtni kapital i stres likvidnosti")} icon={Activity} />

      {/* KPI Stats */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {[
          { label: t("Current Ratio", "Tekući koef."), value: (data?.currentRatio || 0).toFixed(2), warn: (data?.currentRatio || 0) < 1.5 },
          { label: t("Quick Ratio", "Brzi koef."), value: (data?.quickRatio || 0).toFixed(2), warn: (data?.quickRatio || 0) < 1 },
          { label: t("Net Working Capital", "Neto obrtni kapital"), value: `${fmtNum(Math.round(data?.nwc || 0))} RSD`, warn: (data?.nwc || 0) < 0 },
          { label: t("Cash Runway", "Gotovinski runway"), value: `${data?.cashRunway || 0} ${sr ? "mes." : "mo."}`, warn: (data?.cashRunway || 0) < 3 },
        ].map((kpi, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase">{kpi.label}</p>
              <p className={`text-2xl font-bold mt-1 ${kpi.warn ? "text-destructive" : ""}`}>{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* AR Aging breakdown */}
      <div className="grid gap-3 grid-cols-3">
        {[
          { label: sr ? "AR dospelo 30+ dana" : "AR Overdue 30+ days", value: data?.arOver30 || 0 },
          { label: sr ? "AR dospelo 60+ dana" : "AR Overdue 60+ days", value: data?.arOver60 || 0 },
          { label: sr ? "AR dospelo 90+ dana" : "AR Overdue 90+ days", value: data?.arOver90 || 0 },
        ].map((item, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase">{item.label}</p>
              <p className="text-xl font-bold mt-1 text-destructive">{fmtNum(Math.round(item.value))} RSD</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Liquidity Gap Waterfall */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-primary" />
            {t("Liquidity Gap Waterfall", "Waterfall gep likvidnosti")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={waterfallData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" className="text-xs" />
              <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} className="text-xs" />
              <Tooltip formatter={(v: number) => `${fmtNum(v)} RSD`} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {waterfallData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* AI Narrative */}
      {tenantId && data && (
        <AiAnalyticsNarrative
          tenantId={tenantId}
          contextType="working_capital"
          data={{
            currentRatio: data.currentRatio,
            quickRatio: data.quickRatio,
            netWorkingCapital: Math.round(data.nwc),
            cashRunwayMonths: data.cashRunway,
            cashBalance: Math.round(data.cash),
            totalAR: Math.round(data.totalAR),
            totalAP: Math.round(data.totalAP),
            arOver30: Math.round(data.arOver30),
            arOver60: Math.round(data.arOver60),
            arOver90: Math.round(data.arOver90),
            gap30: Math.round(data.gap30),
            gap60: Math.round(data.gap60),
            gap90: Math.round(data.gap90),
          }}
        />
      )}
    </div>
  );
}
