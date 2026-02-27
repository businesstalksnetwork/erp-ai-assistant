import { useLanguage } from "@/i18n/LanguageContext";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, DollarSign, Calendar, Download, Sparkles } from "lucide-react";
import { exportToCsv } from "@/lib/exportCsv";
import { fmtNumCompact, fmtNumAuto } from "@/lib/utils";
import React, { Suspense } from "react";

const PayrollCostWidget = React.lazy(() => import("@/components/dashboard/PayrollCostWidget").then(m => ({ default: m.PayrollCostWidget })));

import { WelcomeHeader } from "@/components/dashboard/WelcomeHeader";
import { MobileActionMenu } from "@/components/shared/MobileActionMenu";

export default function HrDashboard() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const { data: employeeCount = 0, isLoading: empLoading } = useQuery({
    queryKey: ["dashboard-employee-count", tenantId],
    queryFn: async () => {
      const { count } = await supabase.from("employees").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!).eq("status", "active");
      return count || 0;
    },
    enabled: !!tenantId, staleTime: 1000 * 60 * 5,
  });

  const { data: pendingLeaveCount = 0 } = useQuery({
    queryKey: ["dashboard-pending-leave", tenantId],
    queryFn: async () => {
      const { count } = await supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!).eq("status", "pending");
      return count || 0;
    },
    enabled: !!tenantId, staleTime: 1000 * 60 * 2,
  });

  const { data: latestPayrollTotal = 0 } = useQuery({
    queryKey: ["dashboard-latest-payroll", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("payroll_runs").select("total_net").eq("tenant_id", tenantId!).order("created_at", { ascending: false }).limit(1);
      return Number(data?.[0]?.total_net ?? 0);
    },
    enabled: !!tenantId, staleTime: 1000 * 60 * 5,
  });

  const fmt = isMobile ? fmtNumCompact : fmtNumAuto;

  const kpis = [
    { label: t("employeeCount"), value: String(employeeCount), icon: Users, borderColor: "border-t-primary" },
    { label: t("pendingLeaveRequests"), value: String(pendingLeaveCount), icon: Calendar, borderColor: "border-t-accent" },
    { label: t("latestPayroll"), value: `${fmt(latestPayrollTotal)} RSD`, icon: DollarSign, borderColor: "border-t-primary" },
  ];

  const exportAction = () => {
    exportToCsv(
      [{ metric: t("employeeCount"), value: employeeCount }, { metric: t("pendingLeaveRequests"), value: pendingLeaveCount }, { metric: t("latestPayroll"), value: latestPayrollTotal }],
      [{ key: "metric", label: "Metric" }, { key: "value", label: "Value", formatter: (v) => String(v) }],
      "hr_dashboard_summary"
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <WelcomeHeader />
        {isMobile ? (
          <MobileActionMenu actions={[{ label: t("exportCsv"), onClick: exportAction }]} />
        ) : (
          <Button variant="outline" size="sm" onClick={exportAction}><Download className="h-4 w-4 mr-2" />{t("exportCsv")}</Button>
        )}
      </div>

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        {empLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="border-t-2 border-t-muted">
                <CardHeader className="flex flex-row items-center justify-between pb-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-8 w-8 rounded-md" /></CardHeader>
                <CardContent className="pt-0"><Skeleton className="h-7 w-32" /></CardContent>
              </Card>
            ))
          : kpis.map((kpi) => (
              <Card key={kpi.label} className={`border-t-2 ${kpi.borderColor}`}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{kpi.label}</CardTitle>
                  <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center"><kpi.icon className="h-4 w-4 text-muted-foreground" /></div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-base lg:text-xl xl:text-2xl font-bold tabular-nums text-foreground whitespace-nowrap">{kpi.value}</div>
                </CardContent>
              </Card>
            ))}
      </div>

      {tenantId && (
        <Suspense fallback={<Skeleton className="h-48 w-full" />}>
          <PayrollCostWidget tenantId={tenantId} />
        </Suspense>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-muted-foreground" />{t("quickActions")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`flex gap-2 ${isMobile ? "overflow-x-auto pb-2" : "flex-wrap"}`}>
            <Button variant="outline" size="sm" className="whitespace-nowrap" onClick={() => navigate("/hr/employees")}>
              <Users className="h-4 w-4 mr-1.5" /> {t("employees")}
            </Button>
            <Button variant="outline" size="sm" className="whitespace-nowrap" onClick={() => navigate("/hr/leave")}>
              <Calendar className="h-4 w-4 mr-1.5" /> {t("pendingLeaveRequests")}
            </Button>
            <Button variant="outline" size="sm" className="whitespace-nowrap" onClick={() => navigate("/hr/payroll")}>
              <DollarSign className="h-4 w-4 mr-1.5" /> {t("payroll")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
