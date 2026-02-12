import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, TrendingDown, Wallet, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function TenantDashboard() {
  const { t } = useLanguage();

  const kpis = [
    { label: t("revenue"), value: "0 RSD", icon: TrendingUp, color: "text-accent" },
    { label: t("expenses"), value: "0 RSD", icon: TrendingDown, color: "text-destructive" },
    { label: t("profit"), value: "0 RSD", icon: DollarSign, color: "text-primary" },
    { label: t("cashBalance"), value: "0 RSD", icon: Wallet, color: "text-primary" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("dashboard")}</h1>

      <div className="grid gap-4 md:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.label}</CardTitle>
              <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {t("aiInsights")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder={t("askAI")} className="w-full" />
          <p className="text-sm text-muted-foreground">AI insights and anomaly alerts will appear here.</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-lg">{t("pendingActions")}</CardTitle></CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">No pending actions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-lg">{t("quickActions")}</CardTitle></CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">Quick action buttons will appear based on enabled modules</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
