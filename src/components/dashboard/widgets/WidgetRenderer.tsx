import React, { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useTenant } from "@/hooks/useTenant";
import type { WidgetConfig } from "@/hooks/useDashboardLayout";

// Lazy loaded chart widgets (already exist)
const RevenueExpensesChart = React.lazy(() => import("@/components/dashboard/RevenueExpensesChart").then(m => ({ default: m.RevenueExpensesChart })));
const InvoiceStatusChart = React.lazy(() => import("@/components/dashboard/InvoiceStatusChart").then(m => ({ default: m.InvoiceStatusChart })));
const CashFlowChart = React.lazy(() => import("@/components/dashboard/CashFlowChart").then(m => ({ default: m.CashFlowChart })));
const TopCustomersChart = React.lazy(() => import("@/components/dashboard/TopCustomersChart").then(m => ({ default: m.TopCustomersChart })));
const PayrollCostWidget = React.lazy(() => import("@/components/dashboard/PayrollCostWidget").then(m => ({ default: m.PayrollCostWidget })));

// Widget components
import { KpiWidget } from "@/components/dashboard/widgets/KpiWidget";
import { PendingActionsWidget } from "@/components/dashboard/widgets/PendingActionsWidget";
import { QuickActionsWidget } from "@/components/dashboard/widgets/QuickActionsWidget";

// KPI metric key extraction from widget_id (e.g. "kpi_revenue" -> "revenue")
const KPI_PREFIX = "kpi_";

interface Props {
  widgetConfig: WidgetConfig;
}

export function WidgetRenderer({ widgetConfig }: Props) {
  const { tenantId } = useTenant();
  const { widgetId } = widgetConfig;

  // KPI widgets
  if (widgetId.startsWith(KPI_PREFIX)) {
    const metricKey = widgetId.slice(KPI_PREFIX.length);
    return <KpiWidget metricKey={metricKey} />;
  }

  // Named widgets
  const fallback = <Skeleton className="h-full w-full min-h-[200px] rounded-lg" />;

  switch (widgetId) {
    case "pending_actions":
      return <PendingActionsWidget />;
    case "quick_actions":
      return <QuickActionsWidget config={widgetConfig} />;
    case "revenue_expenses_chart":
      return tenantId ? <Suspense fallback={fallback}><RevenueExpensesChart tenantId={tenantId} /></Suspense> : null;
    case "invoice_status_chart":
      return tenantId ? <Suspense fallback={fallback}><InvoiceStatusChart tenantId={tenantId} /></Suspense> : null;
    case "cashflow_chart":
      return tenantId ? <Suspense fallback={fallback}><CashFlowChart tenantId={tenantId} /></Suspense> : null;
    case "top_customers_chart":
      return tenantId ? <Suspense fallback={fallback}><TopCustomersChart tenantId={tenantId} /></Suspense> : null;
    case "payroll_cost_chart":
      return tenantId ? <Suspense fallback={fallback}><PayrollCostWidget tenantId={tenantId} /></Suspense> : null;
    case "today_sales":
      return <KpiWidget metricKey="today_sales" />;
    case "low_stock_alert":
      return <KpiWidget metricKey="low_stock" />;
    case "pending_leave":
      return <KpiWidget metricKey="leave_pending" />;
    case "leave_balance":
      return <KpiWidget metricKey="attendance" />;
    default:
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground text-sm p-4">
          Widget: {widgetId}
        </div>
      );
  }
}
