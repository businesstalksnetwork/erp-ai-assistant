import type { ModuleGroup } from "@/config/rolePermissions";

export type WidgetCategory = "kpi" | "chart" | "action" | "list" | "hr";

export interface WidgetDefinition {
  id: string;
  titleKey: string;
  category: WidgetCategory;
  defaultWidth: number;   // 1-12 grid columns
  defaultHeight: number;  // 1-4 rows
  requiredModule: ModuleGroup;
  /** Default shortcut actions shown on the widget card */
  defaultShortcuts?: { labelKey: string; path: string }[];
}

export const widgetRegistry: Record<string, WidgetDefinition> = {
  // ── KPI widgets ──
  kpi_revenue: {
    id: "kpi_revenue",
    titleKey: "revenue",
    category: "kpi",
    defaultWidth: 3,
    defaultHeight: 1,
    requiredModule: "accounting",
  },
  kpi_expenses: {
    id: "kpi_expenses",
    titleKey: "expenses",
    category: "kpi",
    defaultWidth: 3,
    defaultHeight: 1,
    requiredModule: "accounting",
  },
  kpi_invoices: {
    id: "kpi_invoices",
    titleKey: "invoices",
    category: "kpi",
    defaultWidth: 3,
    defaultHeight: 1,
    requiredModule: "sales",
  },
  kpi_employees: {
    id: "kpi_employees",
    titleKey: "employees",
    category: "kpi",
    defaultWidth: 3,
    defaultHeight: 1,
    requiredModule: "hr",
  },
  kpi_outstanding: {
    id: "kpi_outstanding",
    titleKey: "outstanding",
    category: "kpi",
    defaultWidth: 3,
    defaultHeight: 1,
    requiredModule: "accounting",
  },
  kpi_opportunities: {
    id: "kpi_opportunities",
    titleKey: "opportunities",
    category: "kpi",
    defaultWidth: 4,
    defaultHeight: 1,
    requiredModule: "crm",
  },
  kpi_leave_pending: {
    id: "kpi_leave_pending",
    titleKey: "pendingLeaveRequests",
    category: "kpi",
    defaultWidth: 4,
    defaultHeight: 1,
    requiredModule: "hr",
  },
  kpi_attendance: {
    id: "kpi_attendance",
    titleKey: "attendance",
    category: "kpi",
    defaultWidth: 4,
    defaultHeight: 1,
    requiredModule: "hr",
  },
  kpi_today_sales: {
    id: "kpi_today_sales",
    titleKey: "todaySales",
    category: "kpi",
    defaultWidth: 4,
    defaultHeight: 1,
    requiredModule: "pos",
  },
  kpi_transactions: {
    id: "kpi_transactions",
    titleKey: "transactions",
    category: "kpi",
    defaultWidth: 4,
    defaultHeight: 1,
    requiredModule: "pos",
  },
  kpi_low_stock: {
    id: "kpi_low_stock",
    titleKey: "lowStock",
    category: "kpi",
    defaultWidth: 4,
    defaultHeight: 1,
    requiredModule: "inventory",
  },
  kpi_production: {
    id: "kpi_production",
    titleKey: "production",
    category: "kpi",
    defaultWidth: 3,
    defaultHeight: 1,
    requiredModule: "production",
  },
  kpi_inventory: {
    id: "kpi_inventory",
    titleKey: "inventory",
    category: "kpi",
    defaultWidth: 3,
    defaultHeight: 1,
    requiredModule: "inventory",
  },
  kpi_pending_receipts: {
    id: "kpi_pending_receipts",
    titleKey: "pendingReceipts",
    category: "kpi",
    defaultWidth: 4,
    defaultHeight: 1,
    requiredModule: "purchasing",
  },

  // ── Chart widgets ──
  revenue_expenses_chart: {
    id: "revenue_expenses_chart",
    titleKey: "revenueVsExpenses",
    category: "chart",
    defaultWidth: 6,
    defaultHeight: 2,
    requiredModule: "accounting",
  },
  invoice_status_chart: {
    id: "invoice_status_chart",
    titleKey: "invoiceStatusDistribution",
    category: "chart",
    defaultWidth: 6,
    defaultHeight: 2,
    requiredModule: "sales",
  },
  cashflow_chart: {
    id: "cashflow_chart",
    titleKey: "cashFlow",
    category: "chart",
    defaultWidth: 6,
    defaultHeight: 2,
    requiredModule: "accounting",
  },
  top_customers_chart: {
    id: "top_customers_chart",
    titleKey: "topCustomers",
    category: "chart",
    defaultWidth: 6,
    defaultHeight: 2,
    requiredModule: "crm",
  },
  payroll_cost_chart: {
    id: "payroll_cost_chart",
    titleKey: "payrollCost",
    category: "chart",
    defaultWidth: 6,
    defaultHeight: 2,
    requiredModule: "hr",
  },

  // ── Action widgets ──
  quick_actions: {
    id: "quick_actions",
    titleKey: "quickActions",
    category: "action",
    defaultWidth: 6,
    defaultHeight: 2,
    requiredModule: "dashboard",
    defaultShortcuts: [
      { labelKey: "newInvoice", path: "/invoices/new" },
      { labelKey: "newPartner", path: "/partners/new" },
      { labelKey: "newProduct", path: "/products/new" },
    ],
  },
  pending_actions: {
    id: "pending_actions",
    titleKey: "pendingActions",
    category: "action",
    defaultWidth: 6,
    defaultHeight: 2,
    requiredModule: "dashboard",
  },

  // ── List widgets ──
  today_sales: {
    id: "today_sales",
    titleKey: "todaySales",
    category: "list",
    defaultWidth: 6,
    defaultHeight: 2,
    requiredModule: "pos",
  },
  low_stock_alert: {
    id: "low_stock_alert",
    titleKey: "lowStockAlerts",
    category: "list",
    defaultWidth: 6,
    defaultHeight: 2,
    requiredModule: "inventory",
  },

  // ── HR widgets ──
  pending_leave: {
    id: "pending_leave",
    titleKey: "pendingLeaveRequests",
    category: "hr",
    defaultWidth: 6,
    defaultHeight: 2,
    requiredModule: "hr",
  },
  leave_balance: {
    id: "leave_balance",
    titleKey: "leaveBalance",
    category: "hr",
    defaultWidth: 6,
    defaultHeight: 2,
    requiredModule: "hr",
  },

  // ── AI & Personal widgets ──
  ai_briefing: {
    id: "ai_briefing",
    titleKey: "aiBriefing",
    category: "action",
    defaultWidth: 12,
    defaultHeight: 2,
    requiredModule: "dashboard",
  },
  personal_tasks: {
    id: "personal_tasks",
    titleKey: "personalTasks",
    category: "action",
    defaultWidth: 6,
    defaultHeight: 2,
    requiredModule: "dashboard",
  },
  daily_tasks: {
    id: "daily_tasks",
    titleKey: "dailyTasks",
    category: "action",
    defaultWidth: 6,
    defaultHeight: 2,
    requiredModule: "dashboard",
  },
};

export const widgetCategories: { key: WidgetCategory; labelKey: string }[] = [
  { key: "kpi", labelKey: "kpiWidgets" },
  { key: "chart", labelKey: "chartWidgets" },
  { key: "action", labelKey: "actionWidgets" },
  { key: "list", labelKey: "listWidgets" },
  { key: "hr", labelKey: "hrWidgets" },
];

export const allWidgetIds = Object.keys(widgetRegistry);
