import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { usePermissions } from "@/hooks/usePermissions";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  LayoutDashboard, Users, Target, TrendingUp, Building, CalendarDays, Package, Warehouse,
  BookOpen, Calculator, Receipt, FileText, UserCheck, Banknote, Factory, FolderOpen, Monitor,
  Settings, BarChart3, Handshake, FileCheck, ShoppingCart, Truck, RotateCcw, ArrowLeftRight,
  FileSpreadsheet, ListChecks, ReceiptText, Lock, BookText, Landmark, Timer, Coins, DollarSign,
  CreditCard, Activity, ClipboardCheck, FileInput, Percent, CheckSquare, Plug, Clock,
  CalendarOff, Moon, Calendar, FileSignature, Shield, Heart, Briefcase, Globe, Grid3X3,
  MapPin, ScanBarcode, RefreshCw, Brain, Layers, Search, Building2, List, FolderTree,
  Car, Fuel, Wrench, FileKey, Scale, PieChart, AlertTriangle, Repeat, Archive, Trash2,
  HardDrive, GitBranch, Eye, Kanban, GanttChart, Cog, Import, Key, Database, Download,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface SearchItem {
  label: string;
  path: string;
  icon: LucideIcon;
  group: string;
  module?: string;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { canAccess } = usePermissions();

  const items: SearchItem[] = [
    // Dashboard
    { label: t("dashboard"), path: "/dashboard", icon: LayoutDashboard, group: "navigation" },

    // CRM
    { label: `${t("crm")} — ${t("dashboard")}`, path: "/crm", icon: LayoutDashboard, group: "crm", module: "crm" },
    { label: t("contacts"), path: "/crm/contacts", icon: Users, group: "crm", module: "crm" },
    { label: t("companies"), path: "/crm/companies", icon: Building, group: "crm", module: "crm" },
    { label: t("leads"), path: "/crm/leads", icon: Target, group: "crm", module: "crm" },
    { label: t("opportunities"), path: "/crm/opportunities", icon: TrendingUp, group: "crm", module: "crm" },
    { label: t("meetings"), path: "/crm/meetings", icon: CalendarDays, group: "crm", module: "crm" },
    { label: t("partners"), path: "/crm/companies", icon: Handshake, group: "crm", module: "crm" },
    { label: `${t("meetings")} — Calendar`, path: "/crm/meetings/calendar", icon: Calendar, group: "crm", module: "crm" },

    // Sales
    { label: `${t("salesModule") || "Sales"} — ${t("dashboard")}`, path: "/sales", icon: LayoutDashboard, group: "salesModule", module: "sales" },
    { label: t("quotes"), path: "/sales/quotes", icon: FileCheck, group: "salesModule", module: "sales" },
    { label: t("salesOrders"), path: "/sales/sales-orders", icon: ShoppingCart, group: "salesModule", module: "sales" },
    { label: t("salesChannels"), path: "/sales/sales-channels", icon: Grid3X3, group: "salesModule", module: "sales" },
    { label: t("salespeople"), path: "/sales/salespeople", icon: UserCheck, group: "salesModule", module: "sales" },
    { label: t("salesPerformance"), path: "/sales/sales-performance", icon: BarChart3, group: "salesModule", module: "sales" },
    { label: t("retailPrices"), path: "/inventory/pricing-center", icon: Receipt, group: "salesModule", module: "sales" },

    // Purchasing
    { label: `${t("purchasing") || "Purchasing"} — ${t("dashboard")}`, path: "/purchasing", icon: LayoutDashboard, group: "purchasing", module: "purchasing" },
    { label: t("purchaseOrders"), path: "/purchasing/orders", icon: Truck, group: "purchasing", module: "purchasing" },
    { label: t("goodsReceipts"), path: "/purchasing/goods-receipts", icon: ClipboardCheck, group: "purchasing", module: "purchasing" },
    { label: t("supplierInvoices"), path: "/purchasing/supplier-invoices", icon: FileInput, group: "purchasing", module: "purchasing" },
    { label: t("incomingEfakture") || "Incoming eFakture", path: "/purchasing/incoming-efakture", icon: FileKey, group: "purchasing", module: "purchasing" },

    // Inventory
    { label: `${t("inventory") || "Inventory"} — ${t("dashboard")}`, path: "/inventory", icon: LayoutDashboard, group: "inventory", module: "inventory" },
    { label: t("products"), path: "/inventory/products", icon: Package, group: "inventory", module: "inventory" },
    { label: t("stockOverview"), path: "/inventory/stock", icon: Warehouse, group: "inventory", module: "inventory" },
    { label: t("movementHistory"), path: "/inventory/movements", icon: ArrowLeftRight, group: "inventory", module: "inventory" },
    { label: t("internalOrders"), path: "/inventory/internal-orders", icon: ClipboardCheck, group: "inventory", module: "inventory" },
    { label: t("internalTransfers"), path: "/inventory/internal-transfers", icon: Truck, group: "inventory", module: "inventory" },
    { label: t("internalReceipts"), path: "/inventory/internal-receipts", icon: FileInput, group: "inventory", module: "inventory" },
    { label: t("kalkulacija"), path: "/inventory/kalkulacija", icon: Calculator, group: "inventory", module: "inventory" },
    { label: t("nivelacija"), path: "/inventory/nivelacija", icon: TrendingUp, group: "inventory", module: "inventory" },
    { label: t("dispatchNotes"), path: "/inventory/dispatch-notes", icon: Truck, group: "inventory", module: "inventory" },
    { label: t("costLayers"), path: "/inventory/cost-layers", icon: Coins, group: "inventory", module: "inventory" },
    // WMS
    { label: "WMS Dashboard", path: "/inventory/wms/dashboard", icon: LayoutDashboard, group: "inventory", module: "inventory" },
    { label: t("wmsZones"), path: "/inventory/wms/zones", icon: MapPin, group: "inventory", module: "inventory" },
    { label: t("wmsTasks"), path: "/inventory/wms/tasks", icon: ClipboardCheck, group: "inventory", module: "inventory" },
    { label: t("wmsReceiving"), path: "/inventory/wms/receiving", icon: Truck, group: "inventory", module: "inventory" },
    { label: t("wmsPicking"), path: "/inventory/wms/picking", icon: ScanBarcode, group: "inventory", module: "inventory" },
    { label: t("wmsCycleCounts"), path: "/inventory/wms/cycle-counts", icon: RefreshCw, group: "inventory", module: "inventory" },
    { label: t("wmsSlotting"), path: "/inventory/wms/slotting", icon: Brain, group: "inventory", module: "inventory" },
    { label: "WMS Labor", path: "/inventory/wms/dashboard", icon: Users, group: "inventory", module: "inventory" },
    { label: "WMS Returns", path: "/inventory/wms/returns", icon: RotateCcw, group: "inventory", module: "inventory" },

    // Production
    { label: `${t("production") || "Production"} — ${t("dashboard")}`, path: "/production", icon: LayoutDashboard, group: "production", module: "production" },
    { label: t("bomTemplates"), path: "/production/bom", icon: Layers, group: "production", module: "production" },
    { label: t("productionOrders"), path: "/production/orders", icon: Factory, group: "production", module: "production" },
    { label: "Kanban", path: "/production/kanban", icon: Kanban, group: "production", module: "production" },
    { label: "Gantt", path: "/production/gantt", icon: GanttChart, group: "production", module: "production" },
    { label: "Quality Control", path: "/production/quality", icon: CheckSquare, group: "production", module: "production" },
    { label: "Cost Variance", path: "/production/cost-variance", icon: Scale, group: "production", module: "production" },
    { label: "MRP Engine", path: "/production/mrp", icon: Cog, group: "production", module: "production" },
    { label: "Maintenance", path: "/production/maintenance", icon: Wrench, group: "production", module: "production" },
    { label: "AI Planning", path: "/production/ai-planning", icon: Brain, group: "production", module: "production" },

    // Accounting
    { label: `${t("accounting") || "Accounting"} — ${t("dashboard")}`, path: "/accounting", icon: LayoutDashboard, group: "accounting", module: "accounting" },
    { label: t("chartOfAccounts"), path: "/accounting/chart-of-accounts", icon: BookOpen, group: "accounting", module: "accounting" },
    { label: t("journalEntries"), path: "/accounting/journal", icon: Calculator, group: "accounting", module: "accounting" },
    { label: t("invoices"), path: "/accounting/invoices", icon: Receipt, group: "accounting", module: "accounting" },
    { label: t("bankStatements"), path: "/accounting/bank-statements", icon: FileSpreadsheet, group: "accounting", module: "accounting" },
    { label: t("openItems"), path: "/accounting/open-items", icon: ListChecks, group: "accounting", module: "accounting" },
    { label: t("pdvPeriods"), path: "/accounting/pdv", icon: ReceiptText, group: "accounting", module: "accounting" },
    { label: t("fiscalPeriods"), path: "/accounting/fiscal-periods", icon: CalendarDays, group: "accounting", module: "accounting" },
    { label: t("yearEndClosing"), path: "/accounting/year-end", icon: Lock, group: "accounting", module: "accounting" },
    { label: t("generalLedger"), path: "/accounting/ledger", icon: BookText, group: "accounting", module: "accounting" },
    { label: t("fixedAssets"), path: "/accounting/fixed-assets", icon: Landmark, group: "accounting", module: "accounting" },
    { label: t("deferrals"), path: "/accounting/deferrals", icon: Timer, group: "accounting", module: "accounting" },
    { label: t("loans"), path: "/accounting/loans", icon: Coins, group: "accounting", module: "accounting" },
    { label: t("fxRevaluation"), path: "/accounting/fx-revaluation", icon: DollarSign, group: "accounting", module: "accounting" },
    { label: t("kompenzacija"), path: "/accounting/kompenzacija", icon: ArrowLeftRight, group: "accounting", module: "accounting" },
    { label: t("reports"), path: "/accounting/reports", icon: BarChart3, group: "accounting", module: "accounting" },
    { label: "Expenses", path: "/accounting/expenses", icon: CreditCard, group: "accounting", module: "accounting" },
    { label: "Bank Accounts", path: "/accounting/bank-accounts", icon: Landmark, group: "accounting", module: "accounting" },
    { label: "IOS Confirmation", path: "/accounting/ios", icon: FileCheck, group: "accounting", module: "accounting" },
    { label: "Withholding Tax", path: "/accounting/withholding-tax", icon: Percent, group: "accounting", module: "accounting" },
    { label: "CIT Return", path: "/accounting/cit-return", icon: FileText, group: "accounting", module: "accounting" },
    { label: "Cash Register", path: "/accounting/cash-register", icon: CreditCard, group: "accounting", module: "accounting" },
    { label: "Intercompany", path: "/accounting/intercompany", icon: ArrowLeftRight, group: "accounting", module: "accounting" },
    { label: "Recurring Invoices", path: "/accounting/recurring-invoices", icon: Repeat, group: "accounting", module: "accounting" },
    { label: "Recurring Journals", path: "/accounting/recurring-journals", icon: Repeat, group: "accounting", module: "accounting" },
    { label: "Statistički Aneks", path: "/accounting/statisticki-aneks", icon: FileSpreadsheet, group: "accounting", module: "accounting" },
    { label: "KPO Book", path: "/accounting/kpo-book", icon: BookText, group: "accounting", module: "accounting" },
    { label: "Transfer Pricing", path: "/accounting/transfer-pricing", icon: Scale, group: "accounting", module: "accounting" },
    { label: "Report Snapshots", path: "/accounting/report-snapshots", icon: Archive, group: "accounting", module: "accounting" },
    { label: "Document Import", path: "/accounting/bank-statements", icon: Import, group: "accounting", module: "accounting" },
    { label: "Credit/Debit Notes", path: "/accounting/credit-debit-notes", icon: FileText, group: "accounting", module: "accounting" },
    { label: "Proforma Invoices", path: "/accounting/proforma-invoices", icon: FileCheck, group: "accounting", module: "accounting" },
    { label: "Invoice Register", path: "/accounting/invoice-register", icon: List, group: "accounting", module: "accounting" },
    { label: "Cash Flow Statement", path: "/accounting/cash-flow-statement", icon: DollarSign, group: "accounting", module: "accounting" },
    { label: "Compliance Dashboard", path: "/accounting/compliance", icon: Shield, group: "accounting", module: "accounting" },
    { label: "PK-1 Blagajna", path: "/accounting/reports/pk1-book", icon: BookText, group: "accounting", module: "accounting" },
    { label: "PPP-PO Godišnji", path: "/accounting/reports/ppp-po", icon: FileSpreadsheet, group: "accounting", module: "accounting" },
    { label: "OD-O Obračun", path: "/accounting/reports/od-o", icon: FileText, group: "accounting", module: "accounting" },
    { label: "M4 PIO Izveštaj", path: "/accounting/reports/m4", icon: FileSpreadsheet, group: "accounting", module: "accounting" },
    { label: "ZPPPDV Povraćaj PDV", path: "/accounting/reports/zpppdv", icon: FileText, group: "accounting", module: "accounting" },
    { label: "Devizna blagajna / FX Cash Register", path: "/accounting/fx-cash-register", icon: Globe, group: "accounting", module: "accounting" },
    { label: "Data Retention / Zadržavanje podataka", path: "/settings/data-retention", icon: Clock, group: "settings", module: "settings" },
    { label: "Security Incidents / Bezbednosni incidenti", path: "/settings/security-incidents", icon: Shield, group: "settings", module: "settings" },
    { label: "Notes to FS / Napomene uz FI", path: "/accounting/reports/notes-to-fs", icon: FileText, group: "accounting", module: "accounting" },
    { label: "IFRS Income Statement / Bilans uspeha IFRS", path: "/accounting/reports/ifrs-income-statement", icon: FileText, group: "accounting", module: "accounting" },
    { label: "IFRS Balance Sheet / Bilans stanja IFRS", path: "/accounting/reports/ifrs-balance-sheet", icon: FileText, group: "accounting", module: "accounting" },

    // Analytics
    { label: t("analyticsDashboard"), path: "/analytics", icon: BarChart3, group: "analytics", module: "analytics" },
    { label: t("financialRatios"), path: "/analytics/ratios", icon: Activity, group: "analytics", module: "analytics" },
    { label: t("profitabilityAnalysis"), path: "/analytics/profitability", icon: TrendingUp, group: "analytics", module: "analytics" },
    { label: t("cashFlowForecast"), path: "/analytics/cashflow-forecast", icon: DollarSign, group: "analytics", module: "analytics" },
    { label: t("budgetVsActuals"), path: "/analytics/budget", icon: Target, group: "analytics", module: "analytics" },
    { label: t("breakEvenAnalysis"), path: "/analytics/break-even", icon: Calculator, group: "analytics", module: "analytics" },
    { label: t("businessPlanning"), path: "/analytics/planning", icon: Briefcase, group: "analytics", module: "analytics" },
    { label: "Working Capital Stress", path: "/analytics/working-capital", icon: AlertTriangle, group: "analytics", module: "analytics" },
    { label: "Customer Risk Scoring", path: "/analytics/customer-risk", icon: Shield, group: "analytics", module: "analytics" },
    { label: "Supplier Risk", path: "/analytics/supplier-risk", icon: Truck, group: "analytics", module: "analytics" },
    { label: "Margin Bridge", path: "/analytics/margin-bridge", icon: PieChart, group: "analytics", module: "analytics" },
    { label: "Payroll Benchmark", path: "/analytics/payroll-benchmark", icon: Banknote, group: "analytics", module: "analytics" },
    { label: "VAT Cash Trap", path: "/analytics/vat-trap", icon: AlertTriangle, group: "analytics", module: "analytics" },
    { label: "Inventory Health", path: "/analytics/inventory-health", icon: Package, group: "analytics", module: "analytics" },
    { label: "Early Warning System", path: "/analytics/early-warning", icon: AlertTriangle, group: "analytics", module: "analytics" },

    // HR
    { label: `HR — ${t("dashboard")}`, path: "/hr", icon: LayoutDashboard, group: "hr", module: "hr" },
    { label: t("employees"), path: "/hr/employees", icon: UserCheck, group: "hr", module: "hr" },
    { label: t("contracts"), path: "/hr/contracts", icon: FileSignature, group: "hr", module: "hr" },
    { label: t("departments"), path: "/hr/departments", icon: Building, group: "hr", module: "hr" },
    { label: t("positionTemplates"), path: "/hr/position-templates", icon: Briefcase, group: "hr", module: "hr" },
    { label: t("workLogs"), path: "/hr/work-logs", icon: Clock, group: "hr", module: "hr" },
    { label: "Work Logs — Bulk", path: "/hr/work-logs?tab=bulk", icon: FileSpreadsheet, group: "hr", module: "hr" },
    { label: "Work Logs — Calendar", path: "/hr/work-logs?tab=calendar", icon: Calendar, group: "hr", module: "hr" },
    { label: t("overtimeHours"), path: "/hr/special-hours", icon: Timer, group: "hr", module: "hr" },
    { label: t("nightWork"), path: "/hr/special-hours", icon: Moon, group: "hr", module: "hr" },
    { label: t("annualLeaveBalance"), path: "/hr/annual-leave", icon: CalendarOff, group: "hr", module: "hr" },
    { label: t("holidays"), path: "/hr/holidays", icon: Calendar, group: "hr", module: "hr" },
    { label: t("attendance"), path: "/hr/attendance", icon: Clock, group: "hr", module: "hr" },
    { label: t("leaveRequests"), path: "/hr/leave-requests", icon: CalendarOff, group: "hr", module: "hr" },
    { label: t("leavePolicies" as any) || "Politike odsustva", path: "/hr/leave-policies", icon: Shield, group: "hr", module: "hr" },
    { label: t("deductionsModule"), path: "/hr/deductions", icon: Coins, group: "hr", module: "hr" },
    { label: t("allowance"), path: "/hr/allowances", icon: Banknote, group: "hr", module: "hr" },
    { label: t("salaryHistory"), path: "/hr/salaries", icon: Banknote, group: "hr", module: "hr" },
    { label: t("externalWorkers"), path: "/hr/external-workers", icon: Users, group: "hr", module: "hr" },
    { label: t("insuranceRecords"), path: "/hr/insurance", icon: Shield, group: "hr", module: "hr" },
    { label: t("payroll"), path: "/hr/payroll", icon: Banknote, group: "hr", module: "hr" },
    { label: "Payroll Categories", path: "/settings/payroll-parameters", icon: FolderTree, group: "hr", module: "hr" },
    { label: "Payment Types", path: "/settings/payroll-parameters", icon: CreditCard, group: "hr", module: "hr" },
    { label: "PPPD Review", path: "/hr/payroll/pppd", icon: FileText, group: "hr", module: "hr" },
    { label: t("eBolovanje"), path: "/hr/ebolovanje", icon: Heart, group: "hr", module: "hr" },
    { label: t("hrReports"), path: "/hr/reports", icon: BarChart3, group: "hr", module: "hr" },
    { label: "Non-Employment Income", path: "/hr/non-employment-income", icon: Coins, group: "hr", module: "hr" },
    { label: "Putni Nalozi", path: "/hr/travel-orders", icon: Briefcase, group: "hr", module: "hr" },
    { label: "Eksport podataka zaposlenog", path: "/hr/employee-data-export", icon: Download, group: "hr", module: "hr" },

    // POS
    { label: `POS — ${t("dashboard")}`, path: "/pos", icon: LayoutDashboard, group: "pos", module: "pos" },
    { label: t("posTerminal"), path: "/pos/terminal", icon: Monitor, group: "pos", module: "pos" },
    { label: t("posSessions"), path: "/pos/sessions", icon: CreditCard, group: "pos", module: "pos" },
    { label: t("fiscalDevices"), path: "/pos/fiscal-devices", icon: Receipt, group: "pos", module: "pos" },
    { label: t("dailyReport"), path: "/pos/daily-report", icon: FileText, group: "pos", module: "pos" },

    // Assets
    { label: t("assetsModule" as any), path: "/assets", icon: Building2, group: "assets", module: "assets" },
    { label: t("assetsRegistry" as any), path: "/assets/registry", icon: List, group: "assets", module: "assets" },
    { label: t("assetsCategories" as any), path: "/assets/categories", icon: FolderTree, group: "assets", module: "assets" },
    { label: "Asset Locations", path: "/assets/locations", icon: MapPin, group: "assets", module: "assets" },
    { label: "Asset Reports", path: "/assets/reports", icon: BarChart3, group: "assets", module: "assets" },
    { label: "Depreciation", path: "/assets/depreciation", icon: TrendingUp, group: "assets", module: "assets" },
    { label: "Disposals", path: "/assets/disposals", icon: Trash2, group: "assets", module: "assets" },
    { label: "Revaluations", path: "/assets/revaluations", icon: DollarSign, group: "assets", module: "assets" },
    { label: "Assignments", path: "/assets/assignments", icon: UserCheck, group: "assets", module: "assets" },
    { label: "Reverses", path: "/assets/reverses", icon: RotateCcw, group: "assets", module: "assets" },
    { label: "Inventory Count", path: "/assets/inventory-count", icon: ClipboardCheck, group: "assets", module: "assets" },
    { label: "Offboarding", path: "/assets/offboarding", icon: Users, group: "assets", module: "assets" },
    // Fleet
    { label: "Fleet Dashboard", path: "/assets/fleet", icon: Car, group: "fleet", module: "assets" },
    { label: "Fleet Vehicles", path: "/assets/fleet/vehicles", icon: Car, group: "fleet", module: "assets" },
    { label: "Fuel Log", path: "/assets/fleet/fuel", icon: Fuel, group: "fleet", module: "assets" },
    { label: "Service Orders", path: "/assets/fleet/service", icon: Wrench, group: "fleet", module: "assets" },
    { label: "Registrations", path: "/assets/fleet/registrations", icon: FileSignature, group: "fleet", module: "assets" },
    { label: "Fleet Insurance", path: "/assets/fleet/insurance", icon: Shield, group: "fleet", module: "assets" },
    // Leases
    { label: "Lease Contracts", path: "/assets/leases", icon: FileSignature, group: "assets", module: "assets" },

    // Web Sales
    { label: t("webSettings"), path: "/sales/web-settings", icon: Globe, group: "webSales", module: "web" },
    { label: t("webPrices"), path: "/inventory/pricing-center", icon: Receipt, group: "webSales", module: "web" },

    // Documents
    { label: t("dmsRegistry"), path: "/documents", icon: FolderOpen, group: "documents", module: "documents" },
    { label: t("dmsArchiveBook"), path: "/documents/archive-book", icon: BookOpen, group: "documents", module: "documents" },
    { label: t("dmsArchiving"), path: "/documents/archiving", icon: FileText, group: "documents", module: "documents" },
    { label: t("dmsProjects"), path: "/documents/projects", icon: Layers, group: "documents", module: "documents" },
    { label: t("dmsBrowser"), path: "/documents?tab=browser", icon: Search, group: "documents", module: "documents" },
    { label: t("dmsReports"), path: "/documents?tab=reports", icon: BarChart3, group: "documents", module: "documents" },
    { label: t("dmsSettings"), path: "/documents/settings", icon: Settings, group: "documents", module: "documents" },
    { label: "Drive", path: "/drive", icon: HardDrive, group: "documents", module: "documents" },

    // Returns
    { label: t("returns"), path: "/returns", icon: RotateCcw, group: "returns", module: "returns" },

    // AI
    { label: "AI Briefing", path: "/ai/briefing", icon: Brain, group: "analytics", module: "analytics" },
    { label: "Profile", path: "/profile", icon: Users, group: "navigation" },

    // Settings
    { label: t("companySettings"), path: "/settings", icon: Settings, group: "settings", module: "settings" },
    { label: t("tenantProfile") || "Company Profile", path: "/settings/tenant-profile", icon: Building, group: "settings", module: "settings" },
    { label: t("taxRates"), path: "/settings/tax-rates", icon: Percent, group: "settings", module: "settings" },
    { label: t("users"), path: "/settings/users", icon: Users, group: "settings", module: "settings" },
    { label: t("approvalWorkflows"), path: "/settings/approvals", icon: CheckSquare, group: "settings", module: "settings" },
    { label: t("pendingApprovalsPage"), path: "/settings/pending-approvals", icon: ClipboardCheck, group: "settings", module: "settings" },
    { label: t("currencies"), path: "/settings/currencies", icon: DollarSign, group: "settings", module: "settings" },
    { label: t("integrations"), path: "/settings/integrations", icon: Plug, group: "settings", module: "settings" },
    { label: t("auditLog"), path: "/settings/audit-log", icon: FileText, group: "settings", module: "settings" },
    { label: t("eventMonitor"), path: "/settings/events", icon: Activity, group: "settings", module: "settings" },
    { label: "Legal Entities", path: "/settings/legal-entities", icon: Building2, group: "settings", module: "settings" },
    { label: "Locations", path: "/settings/locations", icon: MapPin, group: "settings", module: "settings" },
    { label: "Warehouses", path: "/settings/warehouses", icon: Warehouse, group: "settings", module: "settings" },
    { label: "Cost Centers", path: "/settings/cost-centers", icon: PieChart, group: "settings", module: "settings" },
    { label: "Bank Accounts", path: "/settings/bank-accounts", icon: Landmark, group: "settings", module: "settings" },
    { label: "Posting Rules", path: "/settings/posting-rules", icon: GitBranch, group: "settings", module: "settings" },
    { label: "Accounting Architecture", path: "/settings/accounting-architecture", icon: Database, group: "settings", module: "settings" },
    { label: "Business Rules", path: "/settings/business-rules", icon: Cog, group: "settings", module: "settings" },
    { label: "Legacy Import", path: "/settings/legacy-import", icon: Import, group: "settings", module: "settings" },
    { label: "Payroll Parameters", path: "/settings/payroll-parameters", icon: Banknote, group: "settings", module: "settings" },
    { label: "AI Audit Log", path: "/settings/ai-audit-log", icon: Eye, group: "settings", module: "settings" },
    { label: "Partner Categories", path: "/settings/partner-categories", icon: FolderTree, group: "settings", module: "settings" },
    { label: "Opportunity Stages", path: "/settings/opportunity-stages", icon: Target, group: "settings", module: "settings" },
    { label: "Discount Rules", path: "/settings/discount-rules", icon: Percent, group: "settings", module: "settings" },
    { label: "Data Protection", path: "/settings/data-protection", icon: Key, group: "settings", module: "settings" },
    { label: "DMS Settings", path: "/settings/dms", icon: Settings, group: "settings", module: "settings" },
    { label: "Notification Categories", path: "/settings/notification-categories", icon: Activity, group: "settings", module: "settings" },
  ];

  const filtered = items.filter((item) => !item.module || canAccess(item.module as any));

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSelect = useCallback(
    (path: string) => {
      setOpen(false);
      navigate(path);
    },
    [navigate],
  );

  const groups = [...new Set(filtered.map((i) => i.group))];

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder={t("search")} />
      <CommandList>
        <CommandEmpty>{t("noResults")}</CommandEmpty>
        {groups.map((group) => (
          <CommandGroup key={group} heading={t(group as any) || group}>
            {filtered
              .filter((i) => i.group === group)
              .map((item) => (
                <CommandItem key={item.path} value={item.label} onSelect={() => handleSelect(item.path)}>
                  <item.icon className="mr-2 h-4 w-4" />
                  {item.label}
                </CommandItem>
              ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
