import { useLanguage } from "@/i18n/LanguageContext";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { usePermissions } from "@/hooks/usePermissions";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, TrendingUp, TrendingDown, Wallet, FileText, Calculator, AlertCircle, Package, Download, ShieldCheck, CreditCard } from "lucide-react";
import { exportToCsv } from "@/lib/exportCsv";
import { fmtNum, fmtNumCompact } from "@/lib/utils";
import { RevenueExpensesChart } from "@/components/dashboard/RevenueExpensesChart";
import { InvoiceStatusChart } from "@/components/dashboard/InvoiceStatusChart";
import { CashFlowChart } from "@/components/dashboard/CashFlowChart";
import { TopCustomersChart } from "@/components/dashboard/TopCustomersChart";
import { ModuleHealthSummary } from "@/components/dashboard/ModuleHealthSummary";
import { FiscalReceiptStatusWidget } from "@/components/dashboard/FiscalReceiptStatusWidget";
import { WelcomeHeader } from "@/components/dashboard/WelcomeHeader";
import { AiInsightsWidget } from "@/components/ai/AiInsightsWidget";
import { CashflowForecastWidget } from "@/components/dashboard/CashflowForecastWidget";
import { ComplianceDeadlineWidget } from "@/components/dashboard/ComplianceDeadlineWidget";
import { MobileActionMenu } from "@/components/shared/MobileActionMenu";
import { addDays } from "date-fns";

export default function TenantDashboard() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { canAccess } = usePermissions();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Revenue
  const { data: revenue = 0 } = useQuery({
    queryKey: ["dashboard-revenue", tenantId],
    queryFn: async () => {
      const { data: entries } = await supabase.from("journal_entries").select("id").eq("tenant_id", tenantId!).eq("status", "posted");
      if (!entries?.length) return 0;
      const { data: revenueAccounts } = await supabase.from("chart_of_accounts").select("id").eq("tenant_id", tenantId!).eq("account_type", "revenue");
      if (!revenueAccounts?.length) return 0;
      const { data: lines } = await supabase.from("journal_lines").select("credit").in("journal_entry_id", entries.map((e) => e.id)).in("account_id", revenueAccounts.map((a) => a.id));
      return lines?.reduce((sum, l) => sum + Number(l.credit), 0) || 0;
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 5,
  });

  // Expenses
  const { data: expenses = 0 } = useQuery({
    queryKey: ["dashboard-expenses", tenantId],
    queryFn: async () => {
      const { data: entries } = await supabase.from("journal_entries").select("id").eq("tenant_id", tenantId!).eq("status", "posted");
      if (!entries?.length) return 0;
      const { data: expenseAccounts } = await supabase.from("chart_of_accounts").select("id").eq("tenant_id", tenantId!).eq("account_type", "expense");
      if (!expenseAccounts?.length) return 0;
      const { data: lines } = await supabase.from("journal_lines").select("debit").in("journal_entry_id", entries.map((e) => e.id)).in("account_id", expenseAccounts.map((a) => a.id));
      return lines?.reduce((sum, l) => sum + Number(l.debit), 0) || 0;
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 5,
  });

  // Cash balance
  const { data: cashBalance = 0 } = useQuery({
    queryKey: ["dashboard-cash", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("invoices").select("total").eq("tenant_id", tenantId!).eq("status", "paid");
      return data?.reduce((sum, inv) => sum + Number(inv.total), 0) || 0;
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 5,
  });

  // Pending actions
  const { data: draftCount = 0 } = useQuery({
    queryKey: ["dashboard-drafts", tenantId],
    queryFn: async () => {
      const { count } = await supabase.from("journal_entries").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!).eq("status", "draft");
      return count || 0;
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 2,
  });

  const { data: overdueCount = 0 } = useQuery({
    queryKey: ["dashboard-overdue", tenantId],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { count } = await supabase.from("invoices").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!).in("status", ["draft", "sent"]).lt("due_date", today);
      return count || 0;
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 2,
  });

  const { data: lowStockCount = 0 } = useQuery({
    queryKey: ["dashboard-low-stock", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("inventory_stock").select("id, quantity_on_hand, min_stock_level").eq("tenant_id", tenantId!).gt("min_stock_level", 0);
      if (!data) return 0;
      return data.filter((s) => Number(s.quantity_on_hand) < Number(s.min_stock_level)).length;
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 2,
  });

  const { data: pendingApprovalCount = 0 } = useQuery({
    queryKey: ["dashboard-pending-approvals", tenantId],
    queryFn: async () => {
      const { count } = await supabase.from("approval_requests").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!).eq("status", "pending");
      return count || 0;
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 2,
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
        const termMonths = loan.term_months;
        for (let i = 1; i <= termMonths; i++) {
          if (paidSet.has(`${loan.id}-${i}`)) continue;
          const paymentDate = addDays(new Date(loan.start_date), i * 30);
          if (paymentDate >= today && paymentDate <= weekFromNow) count++;
        }
      });
      return count;
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 2,
  });

  const profit = revenue - expenses;
  const fmt = isMobile ? fmtNumCompact : fmtNum;

  const kpis = [
    { label: t("revenue"), value: `${fmt(revenue)} RSD`, icon: TrendingUp, borderColor: "border-accent" },
    { label: t("expenses"), value: `${fmt(expenses)} RSD`, icon: TrendingDown, borderColor: "border-destructive" },
    { label: t("profit"), value: `${fmt(profit)} RSD`, icon: DollarSign, borderColor: "border-primary" },
    { label: t("cashBalance"), value: `${fmt(cashBalance)} RSD`, icon: Wallet, borderColor: "border-primary" },
  ];

  const exportAction = () => {
    exportToCsv(
      [{ metric: t("revenue"), value: revenue }, { metric: t("expenses"), value: expenses }, { metric: t("profit"), value: profit }, { metric: t("cashBalance"), value: cashBalance }],
      [{ key: "metric", label: "Metric" }, { key: "value", label: "Value", formatter: (v) => Number(v).toFixed(2) }],
      "dashboard_summary"
    );
  };

  return (
    <div className="space-y-6">
      {/* Welcome header */}
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

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className={`border-t-[3px] ${kpi.borderColor} hover:shadow-lg transition-all hover:-translate-y-0.5`}>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{kpi.label}</CardTitle>
              <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center border border-primary/10">
                <kpi.icon className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl lg:text-3xl font-bold tabular-nums text-foreground">{kpi.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Fiscal Receipt Status */}
      {tenantId && canAccess("pos") && <FiscalReceiptStatusWidget tenantId={tenantId} />}

      {/* AI Insights */}
      {tenantId && <AiInsightsWidget tenantId={tenantId} />}

      {/* Charts Row 1 */}
      {tenantId && (
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          <RevenueExpensesChart tenantId={tenantId} />
          <InvoiceStatusChart tenantId={tenantId} />
        </div>
      )}

      {/* Charts Row 2 */}
      {tenantId && (
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          <CashFlowChart tenantId={tenantId} />
          <TopCustomersChart tenantId={tenantId} />
        </div>
      )}

      {/* Cashflow Forecast + Compliance Deadlines */}
      {tenantId && (
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          <CashflowForecastWidget tenantId={tenantId} />
          <ComplianceDeadlineWidget tenantId={tenantId} />
        </div>
      )}

      {/* Module Health */}
      {tenantId && <ModuleHealthSummary tenantId={tenantId} />}

      {/* Pending Actions + Quick Actions */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">{t("pendingActions")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {draftCount > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <AlertCircle className="h-4 w-4 text-accent" />
                  <span>{draftCount} {t("draftJournalEntries")}</span>
                </div>
                <Button size="sm" variant="ghost" onClick={() => navigate("/accounting/journal")}>{t("view")}</Button>
              </div>
            )}
            {overdueCount > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <span>{overdueCount} {t("overdueInvoices")}</span>
                </div>
                <Button size="sm" variant="ghost" onClick={() => navigate("/accounting/invoices")}>{t("view")}</Button>
              </div>
            )}
            {lowStockCount > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Package className="h-4 w-4 text-accent" />
                  <span>{lowStockCount} {t("lowStockAlert")}</span>
                </div>
                <Button size="sm" variant="ghost" onClick={() => navigate("/inventory/stock")}>{t("view")}</Button>
              </div>
            )}
            {pendingApprovalCount > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <ShieldCheck className="h-4 w-4 text-accent" />
                  <span>{pendingApprovalCount} {t("pendingApprovals")}</span>
                </div>
                <Button size="sm" variant="ghost" onClick={() => navigate("/settings/pending-approvals")}>{t("view")}</Button>
              </div>
            )}
            {upcomingLoanPayments > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <CreditCard className="h-4 w-4 text-accent" />
                  <span>{upcomingLoanPayments} {t("upcomingPayments")}</span>
                </div>
                <Button size="sm" variant="ghost" onClick={() => navigate("/accounting/loans")}>{t("view")}</Button>
              </div>
            )}
            {draftCount === 0 && overdueCount === 0 && lowStockCount === 0 && pendingApprovalCount === 0 && upcomingLoanPayments === 0 && (
              <p className="text-muted-foreground text-sm">No pending actions</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">{t("quickActions")}</CardTitle></CardHeader>
          <CardContent>
            <div className={`flex gap-3 ${isMobile ? "overflow-x-auto pb-2" : "flex-wrap"}`}>
              {canAccess("accounting") && (
                <>
                  <Button variant="outline" size="sm" className="whitespace-nowrap" onClick={() => navigate("/accounting/invoices/new")}>
                    <FileText className="h-4 w-4 mr-2" /> {t("newInvoice")}
                  </Button>
                  <Button variant="outline" size="sm" className="whitespace-nowrap" onClick={() => navigate("/accounting/journal")}>
                    <Calculator className="h-4 w-4 mr-2" /> {t("newJournalEntry")}
                  </Button>
                </>
              )}
              {canAccess("crm") && (
                <Button variant="outline" size="sm" className="whitespace-nowrap" onClick={() => navigate("/crm/leads")}>
                  <TrendingUp className="h-4 w-4 mr-2" /> {t("addLead")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
