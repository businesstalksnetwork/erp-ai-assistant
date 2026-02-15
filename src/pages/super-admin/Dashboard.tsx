import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, Activity, AlertTriangle } from "lucide-react";

export default function SuperAdminDashboard() {
  const { t } = useLanguage();
  const [tenantCount, setTenantCount] = useState(0);
  const [userCount, setUserCount] = useState(0);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      supabase.from("tenants").select("id"),
      supabase.from("profiles").select("id"),
      supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(5),
    ]).then(([t, u, a]) => {
      if (t.error) console.error("Tenant count error:", t.error);
      if (u.error) console.error("User count error:", u.error);
      setTenantCount(t.data?.length ?? 0);
      setUserCount(u.data?.length ?? 0);
      setRecentActivity(a.data || []);
    });
  }, []);

  const stats = [
    { label: t("totalTenants"), value: String(tenantCount), icon: Building2, color: "text-primary" },
    { label: t("activeUsers"), value: String(userCount), icon: Users, color: "text-accent" },
    { label: t("systemHealth"), value: "Healthy", icon: Activity, color: "text-accent" },
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
            {recentActivity.length === 0 ? (
              <p className="text-muted-foreground text-sm">No recent activity</p>
            ) : (
              <div className="space-y-2">
                {recentActivity.map((a) => (
                  <div key={a.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                    <span className="font-medium">{a.action}</span>
                    <span className="text-muted-foreground text-xs">{new Date(a.created_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
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
