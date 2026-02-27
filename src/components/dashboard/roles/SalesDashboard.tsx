import { useLanguage } from "@/i18n/LanguageContext";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Target, FileText, Download, Sparkles, Users } from "lucide-react";
import { exportToCsv } from "@/lib/exportCsv";
import { fmtNumCompact, fmtNumAuto } from "@/lib/utils";
import React, { Suspense } from "react";

const RevenueExpensesChart = React.lazy(() => import("@/components/dashboard/RevenueExpensesChart").then(m => ({ default: m.RevenueExpensesChart })));
const TopCustomersChart = React.lazy(() => import("@/components/dashboard/TopCustomersChart").then(m => ({ default: m.TopCustomersChart })));

import { WelcomeHeader } from "@/components/dashboard/WelcomeHeader";
import { MobileActionMenu } from "@/components/shared/MobileActionMenu";

export default function SalesDashboard() {
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

  const { data: pipelineValue = 0, isLoading: pipelineLoading } = useQuery({
    queryKey: ["dashboard-pipeline-value", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("opportunities")
        .select("value")
        .eq("tenant_id", tenantId!)
        .in("stage", ["qualification", "proposal", "negotiation", "discovery"]);
      return (data || []).reduce((sum, o) => sum + Number(o.value || 0), 0);
    },
    enabled: !!tenantId, staleTime: 1000 * 60 * 5,
  });

  const { data: activeLeadsCount = 0 } = useQuery({
    queryKey: ["dashboard-active-leads", tenantId],
    queryFn: async () => {
      const { count } = await supabase.from("leads").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!).in("status", ["new", "contacted", "qualified"]);
      return count || 0;
    },
    enabled: !!tenantId, staleTime: 1000 * 60 * 2,
  });

  const { data: wonThisMonth = 0 } = useQuery({
    queryKey: ["dashboard-won-deals", tenantId],
    queryFn: async () => {
      const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0);
      const { count } = await supabase.from("opportunities").select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId!).eq("stage", "won").gte("closed_at", start.toISOString());
      return count || 0;
    },
    enabled: !!tenantId, staleTime: 1000 * 60 * 2,
  });

  const fmt = isMobile ? fmtNumCompact : fmtNumAuto;
  const loading = kpiLoading || pipelineLoading;

  const kpis = [
    { label: t("revenue"), value: `${fmt(revenue)} RSD`, icon: TrendingUp, borderColor: "border-t-accent" },
    { label: t("pipelineValue"), value: `${fmt(pipelineValue)} RSD`, icon: Target, borderColor: "border-t-primary" },
    { label: t("activeLeads"), value: String(activeLeadsCount), icon: Users, borderColor: "border-t-primary" },
    { label: t("wonDeals"), value: String(wonThisMonth), icon: TrendingUp, borderColor: "border-t-accent" },
  ];

  const exportAction = () => {
    exportToCsv(
      [{ metric: t("revenue"), value: revenue }, { metric: t("pipelineValue"), value: pipelineValue }, { metric: t("activeLeads"), value: activeLeadsCount }, { metric: t("wonDeals"), value: wonThisMonth }],
      [{ key: "metric", label: "Metric" }, { key: "value", label: "Value", formatter: (v) => String(v) }],
      "sales_dashboard_summary"
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
        {loading
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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-muted-foreground" />{t("quickActions")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`flex gap-2 ${isMobile ? "overflow-x-auto pb-2" : "flex-wrap"}`}>
            <Button variant="outline" size="sm" className="whitespace-nowrap" onClick={() => navigate("/accounting/invoices/new")}>
              <FileText className="h-4 w-4 mr-1.5" /> {t("newInvoice")}
            </Button>
            <Button variant="outline" size="sm" className="whitespace-nowrap" onClick={() => navigate("/crm/leads")}>
              <TrendingUp className="h-4 w-4 mr-1.5" /> {t("addLead")}
            </Button>
            <Button variant="outline" size="sm" className="whitespace-nowrap" onClick={() => navigate("/crm/opportunities")}>
              <Target className="h-4 w-4 mr-1.5" /> {t("pipelineValue")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
