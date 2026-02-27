import type { ModuleGroup } from "@/config/rolePermissions";

export type WidgetCategory = "kpi" | "chart" | "action" | "list" | "hr" | "retail";

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
  // ── KPI widgets — Accounting ──
  kpi_revenue: {
    id: "kpi_revenue",
    titleKey: "revenue",
    category: "kpi",
    defaultWidth: 3,
    defaultHeight: 1,
    requiredModule: "accounting",
  },
  kpi_revenue_yesterday: {
    id: "kpi_revenue_yesterday",
    titleKey: "revenueYesterday",
    category: "kpi",
    defaultWidth: 3,
    defaultHeight: 1,
    requiredModule: "accounting",
  },
  kpi_revenue_7days: {
    id: "kpi_revenue_7days",
    titleKey: "revenueLast7Days",
    category: "kpi",
    defaultWidth: 3,
    defaultHeight: 1,
    requiredModule: "accounting",
  },
  kpi_revenue_30days: {
    id: "kpi_revenue_30days",
    titleKey: "revenueLast30Days",
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
  kpi_profit: {
    id: "kpi_profit",
    titleKey: "profit",
    category: "kpi",
    defaultWidth: 3,
    defaultHeight: 1,
    requiredModule: "accounting",
  },
  kpi_cash_balance: {
    id: "kpi_cash_balance",
    titleKey: "cashBalance",
    category: "kpi",
    defaultWidth: 3,
    defaultHeight: 1,
    requiredModule: "accounting",
  },
  kpi_outstanding: {
    id: "kpi_outstanding",
    titleKey: "outstanding",
    category: "kpi",
    defaultWidth: 3,
    defaultHeight: 1,
    requiredModule: "accounting",
  },

  // ── KPI widgets — Sales / Invoices ──
  kpi_invoices: {
    id: "kpi_invoices",
    titleKey: "invoices",
    category: "kpi",
    defaultWidth: 3,
    defaultHeight: 1,
    requiredModule: "sales",
  },
  kpi_invoices_issued: {
    id: "kpi_invoices_issued",
    titleKey: "issuedInvoices",
    category: "kpi",
    defaultWidth: 3,
    defaultHeight: 1,
    requiredModule: "sales",
  },
  kpi_invoices_unpaid: {
    id: "kpi_invoices_unpaid",
    titleKey: "unpaidInvoices",
    category: "kpi",
    defaultWidth: 3,
    defaultHeight: 1,
    requiredModule: "sales",
  },
  kpi_invoices_overdue: {
    id: "kpi_invoices_overdue",
    titleKey: "overdueInvoices",
    category: "kpi",
    defaultWidth: 3,
    defaultHeight: 1,
    requiredModule: "sales",
  },
  kpi_invoices_paid: {
    id: "kpi_invoices_paid",
    titleKey: "paidInvoices",
    category: "kpi",
    defaultWidth: 3,
    defaultHeight: 1,
    requiredModule: "sales",
  },

  // ── KPI widgets — HR ──
  kpi_employees: {
    id: "kpi_employees",
    titleKey: "employees",
    category: "kpi",
    defaultWidth: 3,
    defaultHeight: 1,
    requiredModule: "hr",
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

  // ── KPI widgets — CRM ──
  kpi_opportunities: {
    id: "kpi_opportunities",
    titleKey: "opportunities",
    category: "kpi",
    defaultWidth: 3,
    defaultHeight: 1,
    requiredModule: "crm",
  },
  kpi_new_customers: {
    id: "kpi_new_customers",
    titleKey: "newCustomers",
    category: "kpi",
    defaultWidth: 3,
    defaultHeight: 1,
    requiredModule: "crm",
  },
  kpi_active_leads: {
    id: "kpi_active_leads",
    titleKey: "activeLeads",
    category: "kpi",
    defaultWidth: 3,
    defaultHeight: 1,
    requiredModule: "crm",
  },

  // ── KPI widgets — Purchasing ──
  kpi_purchase_orders: {
    id: "kpi_purchase_orders",
    titleKey: "purchaseOrders",
    category: "kpi",
    defaultWidth: 3,
    defaultHeight: 1,
    requiredModule: "purchasing",
  },
  kpi_pending_receipts: {
    id: "kpi_pending_receipts",
    titleKey: "pendingReceipts",
    category: "kpi",
    defaultWidth: 4,
    defaultHeight: 1,
    requiredModule: "purchasing",
  },

  // ── KPI widgets — POS / Today ──
  kpi_today_sales: {
    id: "kpi_today_sales",
    titleKey: "todaySales",
    category: "kpi",
    defaultWidth: 3,
    defaultHeight: 1,
    requiredModule: "pos",
  },
  kpi_transactions: {
    id: "kpi_transactions",
    titleKey: "transactions",
    category: "kpi",
    defaultWidth: 3,
    defaultHeight: 1,
    requiredModule: "pos",
  },

  // ── KPI widgets — Inventory / Production ──
  kpi_low_stock: {
    id: "kpi_low_stock",
    titleKey: "lowStock",
    category: "kpi",
    defaultWidth: 3,
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
  kpi_warehouse_count: {
    id: "kpi_warehouse_count",
    titleKey: "warehouseCount",
    category: "kpi",
    defaultWidth: 3,
    defaultHeight: 1,
    requiredModule: "inventory",
  },
  kpi_products_active: {
    id: "kpi_products_active",
    titleKey: "activeProducts",
    category: "kpi",
    defaultWidth: 3,
    defaultHeight: 1,
    requiredModule: "inventory",
  },

  // ── Retail / Maloprodaja KPI widgets ──
  kpi_retail_revenue: {
    id: "kpi_retail_revenue",
    titleKey: "retailRevenue",
    category: "retail",
    defaultWidth: 3,
    defaultHeight: 1,
    requiredModule: "pos",
  },
  kpi_retail_revenue_yesterday: {
    id: "kpi_retail_revenue_yesterday",
    titleKey: "retailRevenueYesterday",
    category: "retail",
    defaultWidth: 3,
    defaultHeight: 1,
    requiredModule: "pos",
  },
  kpi_retail_revenue_7days: {
    id: "kpi_retail_revenue_7days",
    titleKey: "retailRevenueLast7Days",
    category: "retail",
    defaultWidth: 3,
    defaultHeight: 1,
    requiredModule: "pos",
  },
  kpi_retail_transactions: {
    id: "kpi_retail_transactions",
    titleKey: "retailTransactions",
    category: "retail",
    defaultWidth: 3,
    defaultHeight: 1,
    requiredModule: "pos",
  },
  kpi_pos_sessions_active: {
    id: "kpi_pos_sessions_active",
    titleKey: "activePosSessions",
    category: "retail",
    defaultWidth: 3,
    defaultHeight: 1,
    requiredModule: "pos",
  },
  kpi_avg_basket: {
    id: "kpi_avg_basket",
    titleKey: "averageBasket",
    category: "retail",
    defaultWidth: 3,
    defaultHeight: 1,
    requiredModule: "pos",
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

  // ── Service widgets ──
  kpi_service_open: {
    id: "kpi_service_open",
    titleKey: "openServiceOrders",
    category: "kpi",
    defaultWidth: 3,
    defaultHeight: 1,
    requiredModule: "service",
  },
  kpi_service_urgent: {
    id: "kpi_service_urgent",
    titleKey: "urgentServiceOrders",
    category: "kpi",
    defaultWidth: 3,
    defaultHeight: 1,
    requiredModule: "service",
  },
  service_overview: {
    id: "service_overview",
    titleKey: "serviceOverview",
    category: "action",
    defaultWidth: 6,
    defaultHeight: 2,
    requiredModule: "service",
  },
  technician_workload: {
    id: "technician_workload",
    titleKey: "technicianWorkload",
    category: "chart",
    defaultWidth: 6,
    defaultHeight: 2,
    requiredModule: "service",
  },
};

export const widgetCategories: { key: WidgetCategory; labelKey: string }[] = [
  { key: "kpi", labelKey: "kpiWidgets" },
  { key: "retail", labelKey: "retailWidgets" },
  { key: "chart", labelKey: "chartWidgets" },
  { key: "action", labelKey: "actionWidgets" },
  { key: "list", labelKey: "listWidgets" },
  { key: "hr", labelKey: "hrWidgets" },
];

export const allWidgetIds = Object.keys(widgetRegistry);

/** Available width options for widget resize */
export const WIDGET_WIDTH_OPTIONS = [
  { cols: 3, label: "1/4" },
  { cols: 4, label: "1/3" },
  { cols: 6, label: "1/2" },
  { cols: 12, label: "Full" },
] as const;
