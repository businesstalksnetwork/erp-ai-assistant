import { useLanguage } from "@/i18n/LanguageContext";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, TrendingUp, TrendingDown, ShieldCheck, Download, ClipboardCheck, Sparkles } from "lucide-react";
import { exportToCsv } from "@/lib/exportCsv";
import { fmtNumCompact, fmtNumAuto } from "@/lib/utils";
import React, { Suspense } from "react";

const RevenueExpensesChart = React.lazy(() => import("@/components/dashboard/RevenueExpensesChart").then(m => ({ default: m.RevenueExpensesChart })));
const TopCustomersChart = React.lazy(() => import("@/components/dashboard/TopCustomersChart").then(m => ({ default: m.TopCustomersChart })));

import { WelcomeHeader } from "@/components/dashboard/WelcomeHeader";
import { MobileActionMenu } from "@/components/shared/MobileActionMenu";

export default function ManagerDashboard() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const { data: kpiData, isLoading: kpiLoading } = useQuery({
    queryKey: ["dashboard-kpi-summary", tenantId],
    queryFn: async () => {
      const { data } = await supabase.rpc("dashboard_kpi_summary", { _tenant_id: tenantId! });
      return (data as any)?.[0] ?? { revenue: 0, expenses: 0, cash_balance: 0 };
    },
    enabled: !!tenantId, staleTime: 1000 * 60 * 5,
  });

  const revenue = Number(kpiData?.revenue ?? 0);
  const expenses = Number(kpiData?.expenses ?? 0);
  const profit = revenue - expenses;

  const { data: pendingApprovalCount = 0 } = useQuery({
    queryKey: ["dashboard-pending-approvals", tenantId],
    queryFn: async () => {
      const { count } = await supabase.from("approval_requests").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!).eq("status", "pending");
      return count || 0;
    },
    enabled: !!tenantId, staleTime: 1000 * 60 * 2,
  });

  const fmt = isMobile ? fmtNumCompact : fmtNumAuto;

  const kpis = [
    { label: t("revenue"), value: `${fmt(revenue)} RSD`, icon: TrendingUp, borderColor: "border-t-accent" },
    { label: t("expenses"), value: `${fmt(expenses)} RSD`, icon: TrendingDown, borderColor: "border-t-destructive" },
    { label: t("profit"), value: `${fmt(profit)} RSD`, icon: DollarSign, borderColor: "border-t-primary" },
    { label: t("pendingApprovals"), value: String(pendingApprovalCount), icon: ShieldCheck, borderColor: "border-t-primary" },
  ];

  const exportAction = () => {
    exportToCsv(
      [{ metric: t("revenue"), value: revenue }, { metric: t("expenses"), value: expenses }, { metric: t("profit"), value: profit }],
      [{ key: "metric", label: "Metric" }, { key: "value", label: "Value", formatter: (v) => Number(v).toFixed(2) }],
      "manager_dashboard_summary"
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

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        {kpiLoading
          ? Array.from({ length: 4 }).map((_, i) => (
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
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <div className="grid gap-3 grid-cols-1 lg:grid-cols-2">
            <RevenueExpensesChart tenantId={tenantId} />
            <TopCustomersChart tenantId={tenantId} />
          </div>
        </Suspense>
      )}

      <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-muted-foreground" />{t("pendingActions")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {pendingApprovalCount > 0 ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm"><ShieldCheck className="h-4 w-4 text-primary" /><span>{pendingApprovalCount} {t("pendingApprovals")}</span></div>
                <Button size="sm" variant="ghost" onClick={() => navigate("/settings/pending-approvals")}>{t("view")}</Button>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">{t("noPendingActions")}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-muted-foreground" />{t("quickActions")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`flex gap-2 ${isMobile ? "overflow-x-auto pb-2" : "flex-wrap"}`}>
              <Button variant="outline" size="sm" className="whitespace-nowrap" onClick={() => navigate("/settings/pending-approvals")}>
                <ShieldCheck className="h-4 w-4 mr-1.5" /> {t("pendingApprovals")}
              </Button>
              <Button variant="outline" size="sm" className="whitespace-nowrap" onClick={() => navigate("/analytics")}>
                <TrendingUp className="h-4 w-4 mr-1.5" /> {t("reports")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
