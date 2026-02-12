import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, Activity, AlertTriangle } from "lucide-react";

export default function SuperAdminDashboard() {
  const { t } = useLanguage();

  const stats = [
    { label: t("totalTenants"), value: "0", icon: Building2, color: "text-primary" },
    { label: t("activeUsers"), value: "0", icon: Users, color: "text-accent" },
    { label: t("systemHealth"), value: "100%", icon: Activity, color: "text-accent" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("superAdmin")} {t("dashboard")}</h1>

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("recentActivity")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">No recent activity</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">No alerts</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
