import { useLanguage } from "@/i18n/LanguageContext";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { usePermissions } from "@/hooks/usePermissions";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, TrendingUp, TrendingDown, Wallet, FileText, Calculator, AlertCircle, Package, Download, ShieldCheck, CreditCard, ClipboardCheck, Sparkles } from "lucide-react";
import { exportToCsv } from "@/lib/exportCsv";
import { fmtNumCompact, fmtNumAuto } from "@/lib/utils";
import React, { Suspense } from "react";

const RevenueExpensesChart = React.lazy(() => import("@/components/dashboard/RevenueExpensesChart").then(m => ({ default: m.RevenueExpensesChart })));
const InvoiceStatusChart = React.lazy(() => import("@/components/dashboard/InvoiceStatusChart").then(m => ({ default: m.InvoiceStatusChart })));
const CashFlowChart = React.lazy(() => import("@/components/dashboard/CashFlowChart").then(m => ({ default: m.CashFlowChart })));
const TopCustomersChart = React.lazy(() => import("@/components/dashboard/TopCustomersChart").then(m => ({ default: m.TopCustomersChart })));
const AiInsightsWidget = React.lazy(() => import("@/components/ai/AiInsightsWidget").then(m => ({ default: m.AiInsightsWidget })));
const AiMorningBriefing = React.lazy(() => import("@/components/ai/AiMorningBriefing").then(m => ({ default: m.AiMorningBriefing })));
const CashflowForecastWidget = React.lazy(() => import("@/components/dashboard/CashflowForecastWidget").then(m => ({ default: m.CashflowForecastWidget })));
const ComplianceDeadlineWidget = React.lazy(() => import("@/components/dashboard/ComplianceDeadlineWidget").then(m => ({ default: m.ComplianceDeadlineWidget })));
const PayrollCostWidget = React.lazy(() => import("@/components/dashboard/PayrollCostWidget").then(m => ({ default: m.PayrollCostWidget })));

import { ModuleHealthSummary } from "@/components/dashboard/ModuleHealthSummary";
import { FiscalReceiptStatusWidget } from "@/components/dashboard/FiscalReceiptStatusWidget";
import { WelcomeHeader } from "@/components/dashboard/WelcomeHeader";
import { MobileActionMenu } from "@/components/shared/MobileActionMenu";
import { addDays } from "date-fns";

export default function AdminDashboard() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { canAccess } = usePermissions();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const { data: kpiData, isLoading: kpiLoading } = useQuery({
    queryKey: ["dashboard-kpi-summary", tenantId],
    queryFn: async () => {
      const { data } = await supabase.rpc("dashboard_kpi_summary", { _tenant_id: tenantId! });
      return (data as any)?.[0] ?? { revenue: 0, expenses: 0, cash_balance: 0 };
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 5,
  });

  const revenue = Number(kpiData?.revenue ?? 0);
  const expenses = Number(kpiData?.expenses ?? 0);
  const cashBalance = Number(kpiData?.cash_balance ?? 0);

  const { data: draftCount = 0 } = useQuery({
    queryKey: ["dashboard-drafts", tenantId],
    queryFn: async () => {
      const { count } = await supabase.from("journal_entries").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!).eq("status", "draft");
      return count || 0;
    },
    enabled: !!tenantId, staleTime: 1000 * 60 * 2,
  });

  const { data: overdueCount = 0 } = useQuery({
    queryKey: ["dashboard-overdue", tenantId],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { count } = await supabase.from("invoices").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!).in("status", ["draft", "sent"]).lt("due_date", today);
      return count || 0;
    },
    enabled: !!tenantId, staleTime: 1000 * 60 * 2,
  });

  const { data: lowStockCount = 0 } = useQuery({
    queryKey: ["dashboard-low-stock", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("inventory_stock").select("id, quantity_on_hand, min_stock_level").eq("tenant_id", tenantId!).gt("min_stock_level", 0);
      if (!data) return 0;
      return data.filter((s) => Number(s.quantity_on_hand) < Number(s.min_stock_level)).length;
    },
    enabled: !!tenantId, staleTime: 1000 * 60 * 2,
  });

  const { data: pendingApprovalCount = 0 } = useQuery({
    queryKey: ["dashboard-pending-approvals", tenantId],
    queryFn: async () => {
      const { count } = await supabase.from("approval_requests").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!).eq("status", "pending");
      return count || 0;
    },
    enabled: !!tenantId, staleTime: 1000 * 60 * 2,
  });

  const { data: upcomingLoanPayments = 0 } = useQuery({
    queryKey: ["dashboard-upcoming-loans", tenantId],
    queryFn: async () => {
      if (!tenantId) return 0;
      const { data: loans } = await supabase.from("loans").select("*").eq("tenant_id", tenantId).eq("status", "active");
      if (!loans?.length) return 0;
      const { data: payments } = await supabase.from("loan_payments").select("loan_id, period_number").eq("tenant_id", tenantId);
      const paidSet = new Set((payments || []).map((p: any) => `${p.loan_id}-${p.period_number}`));
      const today = new Date();
      const weekFromNow = addDays(today, 7);
      let count = 0;
      loans.forEach((loan: any) => {
        for (let i = 1; i <= loan.term_months; i++) {
          if (paidSet.has(`${loan.id}-${i}`)) continue;
          const paymentDate = addDays(new Date(loan.start_date), i * 30);
          if (paymentDate >= today && paymentDate <= weekFromNow) count++;
        }
      });
      return count;
    },
    enabled: !!tenantId, staleTime: 1000 * 60 * 2,
  });

  const profit = revenue - expenses;
  const fmt = isMobile ? fmtNumCompact : fmtNumAuto;

  const kpis = [
    { label: t("revenue"), value: `${fmt(revenue)} RSD`, icon: TrendingUp, borderColor: "border-t-accent", route: "/analytics" },
    { label: t("expenses"), value: `${fmt(expenses)} RSD`, icon: TrendingDown, borderColor: "border-t-destructive", route: "/analytics" },
    { label: t("profit"), value: `${fmt(profit)} RSD`, icon: DollarSign, borderColor: "border-t-primary", route: "/analytics" },
    { label: t("cashBalance"), value: `${fmt(cashBalance)} RSD`, icon: Wallet, borderColor: "border-t-primary", route: "/accounting/invoices?filter=paid" },
  ];

  const exportAction = () => {
    exportToCsv(
      [{ metric: t("revenue"), value: revenue }, { metric: t("expenses"), value: expenses }, { metric: t("profit"), value: profit }, { metric: t("cashBalance"), value: cashBalance }],
      [{ key: "metric", label: "Metric" }, { key: "value", label: "Value", formatter: (v) => Number(v).toFixed(2) }],
      "dashboard_summary"
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <WelcomeHeader />
        {isMobile ? (
          <MobileActionMenu actions={[{ label: t("exportCsv"), onClick: exportAction }]} />
        ) : (
          <Button variant="outline" size="sm" onClick={exportAction}>
            <Download className="h-4 w-4 mr-2" />{t("exportCsv")}
          </Button>
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
              <Card key={kpi.label} className={`border-t-2 ${kpi.borderColor} cursor-pointer hover:shadow-md transition-shadow`} onClick={() => navigate(kpi.route)}>
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

      {tenantId && canAccess("pos") && <FiscalReceiptStatusWidget tenantId={tenantId} />}

      {tenantId && (
        <Suspense fallback={<Skeleton className="h-32 w-full" />}><AiMorningBriefing tenantId={tenantId} /></Suspense>
      )}
      {tenantId && (
        <Suspense fallback={<Skeleton className="h-32 w-full" />}><AiInsightsWidget tenantId={tenantId} /></Suspense>
      )}

      {tenantId && (
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <div className="grid gap-3 grid-cols-1 lg:grid-cols-2">
            <RevenueExpensesChart tenantId={tenantId} />
            <InvoiceStatusChart tenantId={tenantId} />
          </div>
        </Suspense>
      )}
      {tenantId && (
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <div className="grid gap-3 grid-cols-1 lg:grid-cols-2">
            <CashFlowChart tenantId={tenantId} />
            <TopCustomersChart tenantId={tenantId} />
          </div>
        </Suspense>
      )}
      {tenantId && (
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <div className="grid gap-3 grid-cols-1 lg:grid-cols-2">
            <CashflowForecastWidget tenantId={tenantId} />
            <ComplianceDeadlineWidget tenantId={tenantId} />
          </div>
        </Suspense>
      )}

      {tenantId && canAccess("hr") && (
        <Suspense fallback={<Skeleton className="h-48 w-full" />}><PayrollCostWidget tenantId={tenantId} /></Suspense>
      )}

      {tenantId && <ModuleHealthSummary tenantId={tenantId} />}

      <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-muted-foreground" />{t("pendingActions")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {draftCount > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm"><AlertCircle className="h-4 w-4 text-warning" /><span>{draftCount} {t("draftJournalEntries")}</span></div>
                <Button size="sm" variant="ghost" onClick={() => navigate("/accounting/journal")}>{t("view")}</Button>
              </div>
            )}
            {overdueCount > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm"><AlertCircle className="h-4 w-4 text-destructive" /><span>{overdueCount} {t("overdueInvoices")}</span></div>
                <Button size="sm" variant="ghost" onClick={() => navigate("/accounting/invoices")}>{t("view")}</Button>
              </div>
            )}
            {lowStockCount > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm"><Package className="h-4 w-4 text-warning" /><span>{lowStockCount} {t("lowStockAlert")}</span></div>
                <Button size="sm" variant="ghost" onClick={() => navigate("/inventory/stock")}>{t("view")}</Button>
              </div>
            )}
            {pendingApprovalCount > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm"><ShieldCheck className="h-4 w-4 text-primary" /><span>{pendingApprovalCount} {t("pendingApprovals")}</span></div>
                <Button size="sm" variant="ghost" onClick={() => navigate("/settings/pending-approvals")}>{t("view")}</Button>
              </div>
            )}
            {upcomingLoanPayments > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm"><CreditCard className="h-4 w-4 text-primary" /><span>{upcomingLoanPayments} {t("upcomingPayments")}</span></div>
                <Button size="sm" variant="ghost" onClick={() => navigate("/accounting/loans")}>{t("view")}</Button>
              </div>
            )}
            {draftCount === 0 && overdueCount === 0 && lowStockCount === 0 && pendingApprovalCount === 0 && upcomingLoanPayments === 0 && (
              <p className="text-muted-foreground text-sm">No pending actions</p>
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
              {canAccess("accounting") && (
                <>
                  <Button variant="outline" size="sm" className="whitespace-nowrap" onClick={() => navigate("/accounting/invoices/new")}>
                    <FileText className="h-4 w-4 mr-1.5" /> {t("newInvoice")}
                  </Button>
                  <Button variant="outline" size="sm" className="whitespace-nowrap" onClick={() => navigate("/accounting/journal")}>
                    <Calculator className="h-4 w-4 mr-1.5" /> {t("newJournalEntry")}
                  </Button>
                </>
              )}
              {canAccess("crm") && (
                <Button variant="outline" size="sm" className="whitespace-nowrap" onClick={() => navigate("/crm/leads")}>
                  <TrendingUp className="h-4 w-4 mr-1.5" /> {t("addLead")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
