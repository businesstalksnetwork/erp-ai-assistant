import React, { Suspense, useState, useEffect } from "react";
import erpAiLogo from "@/assets/erpAI.png";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AiContextSidebar } from "@/components/ai/AiContextSidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useKeyboardShortcuts, KeyboardShortcutsOverlay } from "@/hooks/useKeyboardShortcuts";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { TenantSelector } from "@/components/TenantSelector";
import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { GlobalSearch } from "@/components/layout/GlobalSearch";

import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard, Settings, Users, FileText, BookOpen, Calculator, CalendarDays, Receipt,
  BookText, BarChart3, Percent, Handshake, Package, Warehouse, ArrowLeftRight, UserCheck,
  Building, Clock, CalendarOff, Banknote, FileSignature, Target, TrendingUp, FileCheck,
  ShoppingCart, Layers, Factory, FolderOpen, Monitor, CreditCard, Activity, Truck,
  ClipboardCheck, FileInput, RotateCcw, Landmark, Timer, Coins, CheckSquare, DollarSign,
  ChevronDown, User, LogOut, FileSpreadsheet, ListChecks, ReceiptText, Lock, Search,
  Globe, Command, Plug, Moon, Briefcase, Shield, Heart, Calendar, Grid3X3,
  ScanBarcode, MapPin, RefreshCw, Brain, AlertTriangle, TrendingDown, Sparkles, HardDrive,
  Building2, List, FolderTree, Trash2, UserX, ShieldCheck, Plane, Download, ShieldAlert, UserMinus, TableProperties, Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface NavItem {
  key: string;
  url: string;
  icon: LucideIcon;
  section?: string;
}

const mainNav: (NavItem & { badge?: number })[] = [
  { key: "dashboard", url: "/dashboard", icon: LayoutDashboard },
];

const inventoryNav: NavItem[] = [
  { key: "products", url: "/inventory/products", icon: Package, section: "coreInventory" },
  { key: "productCategories", url: "/inventory/product-categories", icon: FolderTree },
  { key: "stockOverview", url: "/inventory/stock", icon: Warehouse },
  { key: "movementHistory", url: "/inventory/movements", icon: ArrowLeftRight },
  { key: "costLayers", url: "/inventory/cost-layers", icon: Coins },
  { key: "internalOrders", url: "/inventory/internal-orders", icon: ClipboardCheck, section: "internalLogistics" },
  { key: "internalTransfers", url: "/inventory/internal-transfers", icon: Truck },
  { key: "internalReceipts", url: "/inventory/internal-receipts", icon: FileInput },
  { key: "dispatchNotes", url: "/inventory/dispatch-notes", icon: Truck },
  { key: "pricingCenter", url: "/inventory/pricing-center", icon: DollarSign, section: "pricingOperations" },
  { key: "kalkulacija", url: "/inventory/kalkulacija", icon: Calculator },
  { key: "nivelacija", url: "/inventory/nivelacija", icon: TrendingUp },
  { key: "wmsDashboard", url: "/inventory/wms/dashboard", icon: LayoutDashboard, section: "wms" },
  { key: "wmsZones", url: "/inventory/wms/zones", icon: MapPin },
  { key: "wmsTasks", url: "/inventory/wms/tasks", icon: ClipboardCheck },
  { key: "wmsReceiving", url: "/inventory/wms/receiving", icon: Truck },
  { key: "wmsPicking", url: "/inventory/wms/picking", icon: ScanBarcode },
  { key: "wmsCycleCounts", url: "/inventory/wms/cycle-counts", icon: RefreshCw },
  { key: "wmsSlotting", url: "/inventory/wms/slotting", icon: Brain },
  
  { key: "wmsReturns", url: "/inventory/wms/returns", icon: RotateCcw },
  { key: "inventoryStockTake", url: "/inventory/stock-take", icon: ClipboardCheck, section: "inventoryControl" },
  { key: "inventoryWriteOffs", url: "/inventory/write-offs", icon: Trash2 },
];

const accountingNav: NavItem[] = [
  { key: "chartOfAccounts", url: "/accounting/chart-of-accounts", icon: BookOpen, section: "bookkeeping" },
  { key: "journalEntries", url: "/accounting/journal", icon: Calculator },
  { key: "generalLedger", url: "/accounting/ledger", icon: BookText },
  { key: "bankAccounts", url: "/accounting/bank-accounts", icon: Landmark },
  { key: "recurringJournals", url: "/accounting/recurring-journals", icon: RefreshCw },
  { key: "invoices", url: "/accounting/invoices", icon: Receipt, section: "invoicingPayments" },
  { key: "proformaInvoices", url: "/accounting/proforma-invoices", icon: FileText },
  { key: "creditDebitNotes", url: "/accounting/credit-debit-notes", icon: BookOpen },
  { key: "recurringInvoices", url: "/accounting/recurring-invoices", icon: RefreshCw },
  { key: "bankStatements", url: "/accounting/bank-statements", icon: FileSpreadsheet },
  { key: "cashRegister", url: "/accounting/cash-register", icon: CreditCard },
  { key: "fxCashRegister", url: "/accounting/fx-cash-register", icon: Globe },
  { key: "openItems", url: "/accounting/open-items", icon: ListChecks },
  { key: "iosBalanceConfirmation", url: "/accounting/ios", icon: CheckSquare },
  { key: "expensesOverview", url: "/accounting/expenses", icon: TrendingDown },
  { key: "kompenzacija", url: "/accounting/kompenzacija", icon: ArrowLeftRight },
  { key: "fixedAssets", url: "/accounting/fixed-assets", icon: Landmark, section: "assetsAccruals" },
  { key: "deferrals", url: "/accounting/deferrals", icon: Timer },
  { key: "loans", url: "/accounting/loans", icon: Coins },
  { key: "fxRevaluation", url: "/accounting/fx-revaluation", icon: DollarSign },
  { key: "costCenterPL", url: "/accounting/reports/cost-center-pl", icon: BarChart3 },
  { key: "pdvPeriods", url: "/accounting/pdv", icon: ReceiptText, section: "taxClosing" },
  { key: "invoiceRegister", url: "/accounting/invoice-register", icon: FileText },
  { key: "fiscalPeriods", url: "/accounting/fiscal-periods", icon: CalendarDays },
  { key: "citTaxReturn", url: "/accounting/cit-return", icon: FileText },
  { key: "withholdingTax", url: "/accounting/withholding-tax", icon: Percent },
  { key: "yearEndClosing", url: "/accounting/year-end", icon: Lock },
  { key: "cashFlowStatement", url: "/accounting/cash-flow-statement", icon: ArrowLeftRight },
  { key: "complianceChecker", url: "/accounting/compliance", icon: ShieldCheck },
  { key: "intercompanyTransactions", url: "/accounting/intercompany", icon: ArrowLeftRight, section: "consolidation" },
  { key: "consolidatedStatements", url: "/accounting/reports/consolidated", icon: Layers },
  { key: "transferPricing", url: "/accounting/transfer-pricing", icon: DollarSign },
  { key: "reports", url: "/accounting/reports", icon: BarChart3, section: "reporting" },
  { key: "multiPeriodReports", url: "/accounting/reports/multi-period", icon: BarChart3 },
  { key: "statistickiAneks", url: "/accounting/statisticki-aneks", icon: FileSpreadsheet },
  { key: "kpoBook", url: "/accounting/kpo-book", icon: BookText },
  { key: "kepKnjiga", url: "/accounting/kep", icon: BookText },
  { key: "pk1Book", url: "/accounting/reports/pk1-book", icon: BookText },
  { key: "ppppo", url: "/accounting/reports/ppp-po", icon: FileSpreadsheet },
  { key: "odO", url: "/accounting/reports/od-o", icon: FileText },
  { key: "m4Report", url: "/accounting/reports/m4", icon: FileSpreadsheet },
  { key: "zpppdv", url: "/accounting/reports/zpppdv", icon: FileText },
  { key: "reportSnapshots", url: "/accounting/report-snapshots", icon: FileText },
  { key: "revenueContracts", url: "/accounting/revenue-contracts", icon: TrendingUp, section: "ifrsModules" },
];

const analyticsNav: NavItem[] = [
  { key: "analyticsDashboard", url: "/analytics", icon: BarChart3, section: "analyticsOverview" },
  { key: "aiBriefing", url: "/ai/briefing", icon: Brain },
  { key: "workingCapitalStress", url: "/analytics/working-capital", icon: Activity, section: "financialHealth" },
  { key: "financialRatios", url: "/analytics/ratios", icon: Activity },
  { key: "profitabilityAnalysis", url: "/analytics/profitability", icon: TrendingUp },
  { key: "marginBridge", url: "/analytics/margin-bridge", icon: TrendingUp },
  { key: "customerRiskScoring", url: "/analytics/customer-risk", icon: AlertTriangle, section: "riskCompliance" },
  { key: "supplierDependency", url: "/analytics/supplier-risk", icon: Truck },
  { key: "supplierEvaluation", url: "/analytics/supplier-evaluation", icon: ClipboardCheck },
  { key: "vatCashTrap", url: "/analytics/vat-trap", icon: AlertTriangle },
  { key: "earlyWarningSystem", url: "/analytics/early-warning", icon: AlertTriangle },
  { key: "inventoryHealth", url: "/analytics/inventory-health", icon: Package, section: "operationsAnalytics" },
  { key: "demandForecasting", url: "/analytics/demand-forecast", icon: TrendingUp },
  { key: "payrollBenchmark", url: "/analytics/payroll-benchmark", icon: Banknote },
  { key: "cashFlowForecast", url: "/analytics/cashflow-forecast", icon: DollarSign, section: "forecasting" },
  { key: "budgetVsActuals", url: "/analytics/budget", icon: Target },
  { key: "breakEvenAnalysis", url: "/analytics/break-even", icon: Calculator, section: "strategicPlanning" },
  { key: "businessPlanning", url: "/analytics/planning", icon: Briefcase },
  { key: "dataQualityDashboard", url: "/analytics/data-quality", icon: ShieldCheck },
  { key: "pivotAnalytics", url: "/analytics/pivot", icon: TableProperties },
];

const crmNav: NavItem[] = [
  { key: "crmDashboard", url: "/crm", icon: LayoutDashboard, section: "overview" },
  { key: "companies", url: "/crm/companies", icon: Building, section: "records" },
  { key: "contacts", url: "/crm/contacts", icon: Users },
  { key: "leads", url: "/crm/leads", icon: Target },
  { key: "opportunities", url: "/crm/opportunities", icon: TrendingUp },
  { key: "meetings", url: "/crm/meetings", icon: CalendarDays },
];

const salesNav: NavItem[] = [
  { key: "quotes", url: "/sales/quotes", icon: FileCheck, section: "salesDocuments" },
  { key: "salesOrders", url: "/sales/sales-orders", icon: ShoppingCart },
  { key: "salesChannels", url: "/sales/sales-channels", icon: Grid3X3, section: "performancePricing" },
  { key: "salespeople", url: "/sales/salespeople", icon: UserCheck },
  { key: "salesPerformance", url: "/sales/sales-performance", icon: BarChart3 },
  { key: "webSettings", url: "/sales/web-settings", icon: Globe, section: "webSales" },
];

const purchasingNav: NavItem[] = [
  { key: "purchaseOrders", url: "/purchasing/orders", icon: Truck },
  { key: "goodsReceipts", url: "/purchasing/goods-receipts", icon: ClipboardCheck },
  { key: "supplierInvoices", url: "/purchasing/supplier-invoices", icon: FileInput },
  { key: "incomingEfakture", url: "/purchasing/incoming-efakture", icon: FileText },
];

const returnsNav: NavItem[] = [
  { key: "returns", url: "/returns", icon: RotateCcw },
];

const hrNav: NavItem[] = [
  { key: "employees", url: "/hr/employees", icon: UserCheck, section: "organization" },
  { key: "contracts", url: "/hr/contracts", icon: FileSignature },
  { key: "departments", url: "/hr/departments", icon: Building },
  { key: "positionTemplates", url: "/hr/position-templates", icon: Briefcase },
  { key: "workLogs", url: "/hr/work-logs", icon: Clock, section: "workingTime" },
  { key: "specialHours", url: "/hr/special-hours", icon: Timer },
  { key: "attendance", url: "/hr/attendance", icon: Clock },
  { key: "annualLeaveBalance", url: "/hr/annual-leave", icon: CalendarOff, section: "leave" },
  { key: "holidays", url: "/hr/holidays", icon: Calendar },
  { key: "leaveRequests", url: "/hr/leave-requests", icon: CalendarOff },
  { key: "leavePolicies", url: "/hr/leave-policies", icon: Shield },
  { key: "leaveAnalytics", url: "/hr/leave-analytics", icon: BarChart3 },
  { key: "deductionsModule", url: "/hr/deductions", icon: Coins, section: "compensation" },
  { key: "allowance", url: "/hr/allowances", icon: Banknote },
  { key: "salaryHistory", url: "/hr/salaries", icon: Banknote },
  { key: "payroll", url: "/hr/payroll", icon: Banknote },
  { key: "payrollBankReconciliation", url: "/hr/payroll/bank-reconciliation", icon: ArrowLeftRight },
  { key: "nonEmploymentIncome", url: "/hr/non-employment-income", icon: FileText },
  { key: "pppdReview", url: "/hr/payroll/pppd", icon: FileSpreadsheet },
  { key: "externalWorkers", url: "/hr/external-workers", icon: Users, section: "other" },
  { key: "insuranceRecords", url: "/hr/insurance", icon: Shield },
  { key: "eBolovanje", url: "/hr/ebolovanje", icon: Heart },
  { key: "hrReports", url: "/hr/reports", icon: BarChart3 },
  { key: "travelOrders", url: "/hr/travel-orders", icon: Plane, section: "travelExpenses" },
  { key: "employeeDataExport", url: "/hr/employee-data-export", icon: Download },
  { key: "onboardingChecklists", url: "/hr/onboarding-checklists", icon: ListChecks },
  { key: "severance", url: "/hr/severance", icon: UserMinus },
];

const productionNav: NavItem[] = [
  { key: "bomTemplates", url: "/production/bom", icon: Layers, section: "existingSection" },
  { key: "productionOrders", url: "/production/orders", icon: Factory },
  { key: "aiPlanningDashboard", url: "/production/ai-planning", icon: Brain, section: "aiPlanningSection" },
  { key: "aiSchedule", url: "/production/ai-planning/schedule", icon: CalendarDays },
  { key: "capacitySimulation", url: "/production/ai-planning/scenarios", icon: BarChart3 },
  { key: "productionKanban", url: "/production/kanban", icon: LayoutDashboard, section: "shopFloor" },
  { key: "productionGantt", url: "/production/gantt", icon: CalendarDays },
  { key: "qualityControl", url: "/production/quality", icon: ClipboardCheck },
  { key: "productionMaintenance", url: "/production/maintenance", icon: Settings },
  { key: "mrpEngine", url: "/production/mrp", icon: Calculator, section: "planning" },
  { key: "costVarianceAnalysis", url: "/production/cost-variance", icon: TrendingDown, section: "reporting" },
];

const documentsNav: NavItem[] = [
  { key: "dmsRegistry", url: "/documents", icon: FolderOpen, section: "registry" },
  { key: "dmsArchiveBook", url: "/documents/archive-book", icon: BookOpen },
  { key: "dmsArchiving", url: "/documents/archiving", icon: FileText },
  { key: "dmsProjects", url: "/documents/projects", icon: Layers, section: "management" },
  { key: "erpDrive", url: "/drive", icon: HardDrive, section: "fileManagement" },
  { key: "dmsSettings", url: "/documents/settings", icon: Settings, section: "dmsConfiguration" },
];

const assetsNav: NavItem[] = [
  { key: "assetsHub", url: "/assets", icon: LayoutDashboard, section: "assetsOverview" },
  { key: "assetsRegistry", url: "/assets/registry", icon: List },
  { key: "assetsCategories", url: "/assets/categories", icon: FolderTree },
  { key: "assetsLocationsTitle", url: "/assets/locations", icon: MapPin },
  { key: "assetsDepreciation", url: "/assets/depreciation", icon: Calculator, section: "assetsAccounting" },
  { key: "assetsDisposals", url: "/assets/disposals", icon: Trash2 },
  { key: "assetsRevalImpairment", url: "/assets/revaluations", icon: TrendingUp },
  { key: "assetsReports", url: "/assets/reports", icon: FileSpreadsheet },
  { key: "assetsAssignments", url: "/assets/assignments", icon: UserCheck, section: "assetsOperations" },
  { key: "reversDocuments", url: "/assets/reverses", icon: FileSignature },
  { key: "offboardingTitle", url: "/assets/offboarding", icon: UserX },
  { key: "assetsInventoryCount", url: "/assets/inventory-count", icon: ClipboardCheck },
  { key: "fleetDashboard", url: "/assets/fleet", icon: Truck, section: "fleetManagement" },
  { key: "fleetVehicles", url: "/assets/fleet/vehicles", icon: Truck },
  { key: "fleetFuel", url: "/assets/fleet/fuel", icon: Activity },
  { key: "fleetService", url: "/assets/fleet/service", icon: Settings },
  { key: "fleetRegistrations", url: "/assets/fleet/registrations", icon: FileText },
  { key: "fleetInsurance", url: "/assets/fleet/insurance", icon: Shield },
  { key: "leaseContracts", url: "/assets/leases", icon: FileSignature, section: "leaseAccounting" },
  { key: "leaseDisclosure", url: "/assets/leases/disclosure", icon: FileSpreadsheet },
];

const serviceNav: NavItem[] = [
  { key: "serviceOrders", url: "/service/orders", icon: ClipboardCheck, section: "serviceManagement" },
  { key: "newServiceOrder", url: "/service/orders/new", icon: FileInput },
  { key: "myWorkOrders", url: "/service/my-work-orders", icon: UserCheck },
  { key: "deviceRegistry", url: "/service/devices", icon: HardDrive },
];

const posNav: NavItem[] = [
  { key: "posTerminal", url: "/pos/terminal", icon: Monitor, section: "terminal" },
  { key: "posSessions", url: "/pos/sessions", icon: CreditCard, section: "administration" },
  { key: "fiscalDevices", url: "/pos/fiscal-devices", icon: Receipt },
  { key: "dailyReport", url: "/pos/daily-report", icon: FileText },
];

const settingsNav: NavItem[] = [
  { key: "companySettings", url: "/settings", icon: Settings, section: "settingsOrganization" },
  { key: "tenantProfile", url: "/settings/tenant-profile", icon: Building },
  { key: "legalEntities", url: "/settings/legal-entities", icon: Building2 },
  { key: "orgCompanies", url: "/settings/org-companies", icon: Building2 },
  { key: "locations", url: "/settings/locations", icon: MapPin },
  { key: "warehouses", url: "/settings/warehouses", icon: Warehouse },
  { key: "costCenters", url: "/settings/cost-centers", icon: Coins },
  { key: "taxRates", url: "/settings/tax-rates", icon: Percent, section: "settingsFinance" },
  { key: "currencies", url: "/settings/currencies", icon: DollarSign },
  { key: "bankAccounts", url: "/settings/bank-accounts", icon: Landmark },
  { key: "postingRules", url: "/settings/posting-rules", icon: BookOpen },
  { key: "payrollParamsTitle", url: "/settings/payroll-parameters", icon: Calculator },
  { key: "users", url: "/settings/users", icon: Users, section: "settingsAccessWorkflows" },
  { key: "rolePermissions", url: "/settings/role-permissions", icon: Shield },
  { key: "approvalWorkflows", url: "/settings/approvals", icon: CheckSquare },
  { key: "pendingApprovalsPage", url: "/settings/pending-approvals", icon: ClipboardCheck },
  { key: "businessRules", url: "/settings/business-rules", icon: FileText },
  { key: "integrations", url: "/settings/integrations", icon: Plug, section: "settingsIntegrations" },
  { key: "integrationHealth", url: "/settings/integration-health", icon: Activity },
  { key: "partnerCategories", url: "/settings/partner-categories", icon: Handshake },
  { key: "opportunityStages", url: "/settings/opportunity-stages", icon: TrendingUp },
  { key: "discountApprovalRules", url: "/settings/discount-rules", icon: Percent },
  { key: "auditLog", url: "/settings/audit-log", icon: FileText, section: "settingsAuditData" },
  { key: "aiAuditLog", url: "/settings/ai-audit-log", icon: Shield },
  { key: "eventMonitor", url: "/settings/events", icon: Activity },
  { key: "dataProtection", url: "/settings/data-protection", icon: Shield },
  { key: "dataRetention", url: "/settings/data-retention", icon: Clock },
  { key: "securityIncidents", url: "/settings/security-incidents", icon: ShieldAlert },
  { key: "accountingArchitecture", url: "/settings/accounting-architecture", icon: Layers, section: "settingsAdvanced" },
  { key: "legacyImport", url: "/settings/legacy-import", icon: FileInput },
  { key: "dmsSettings", url: "/settings/dms", icon: FolderOpen },
  { key: "notificationCategorySettings", url: "/settings/notification-categories", icon: Activity },
];

const CollapsibleNavGroup = React.memo(function CollapsibleNavGroup({
  label,
  items,
  currentPath,
  t,
  icon: Icon,
}: {
  label: string;
  items: NavItem[];
  currentPath: string;
  t: (key: any) => string;
  accentColor?: string;
  icon?: LucideIcon;
}) {
  const isActive = items.some((item) => currentPath.startsWith(item.url));

  return (
    <SidebarGroup className="py-0">
      <Collapsible defaultOpen={isActive}>
        <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2.5 mt-2 text-[14px] font-semibold text-sidebar-foreground/90 tracking-wide hover:text-sidebar-foreground transition-colors group">
          <span className="flex items-center gap-2.5">
            {Icon && <Icon className="h-[18px] w-[18px] opacity-80" />}
            {label}
          </span>
          <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-180 opacity-50" />
        </CollapsibleTrigger>
        <CollapsibleContent className="bg-sidebar-accent/30 rounded-md mx-1 mb-1">
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const itemActive = currentPath === item.url || (item.url !== "/dashboard" && currentPath.startsWith(item.url + "/"));
                return (
                  <React.Fragment key={item.key}>
                    {item.section && (
                      <li className="px-3 pt-2.5 pb-0.5">
                        <span className="text-[11px] font-medium text-sidebar-foreground/40 tracking-wide">
                          {t(item.section as any)}
                        </span>
                      </li>
                    )}
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-[14px] transition-colors ${
                            itemActive
                              ? "bg-sidebar-primary/10 text-sidebar-primary font-medium"
                              : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                          }`}
                          activeClassName="bg-sidebar-primary/10 text-sidebar-primary font-medium"
                        >
                          <item.icon className={`h-4 w-4 flex-shrink-0 ${itemActive ? "text-sidebar-primary" : "opacity-50"}`} />
                          <span className="truncate">{t(item.key as any)}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </React.Fragment>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </Collapsible>
    </SidebarGroup>
  );
});

export default function TenantLayout() {
  const { t, locale, setLocale } = useLanguage();
  const { signOut, user, isSuperAdmin } = useAuth();
  const { canAccess } = usePermissions();
  const { tenantId } = useTenant();
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;
  const isMobile = useIsMobile();
  const [aiSidebarOpen, setAiSidebarOpen] = useState(false);
  const { showOverlay, setShowOverlay } = useKeyboardShortcuts();

  // Task 29: Critical insight badge count
  const { data: criticalInsightCount = 0 } = useQuery({
    queryKey: ["critical-insight-count", tenantId],
    queryFn: async () => {
      const { count } = await supabase
        .from("ai_insights_cache")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId!)
        .in("severity", ["critical", "warning"])
        .gt("expires_at", new Date().toISOString());
      return count || 0;
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    setAiSidebarOpen(!isMobile);
  }, []);

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const userInitials = (() => {
    const name = user?.user_metadata?.full_name || user?.email || "";
    if (user?.user_metadata?.full_name) {
      return name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
    }
    return (user?.email?.[0] || "U").toUpperCase();
  })();

  const userName = user?.user_metadata?.full_name || user?.email || "";

  return (
    <SidebarProvider>
      <div className="h-screen flex w-full overflow-hidden">
        <Sidebar className="border-r border-sidebar-border w-64">
          <div className="sidebar-grid-pattern relative flex flex-col h-full w-full overflow-hidden bg-gradient-to-b from-[hsl(225,50%,12%)] via-[hsl(225,55%,15%)] to-[hsl(230,45%,10%)]">
          {/* Subtle animated orbs */}
          <div className="absolute top-0 right-0 w-[200px] h-[200px] rounded-full bg-primary/10 blur-[80px] animate-[pulse_8s_ease-in-out_infinite] pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-[150px] h-[150px] rounded-full bg-[hsl(260,60%,30%)]/8 blur-[60px] animate-[pulse_10s_ease-in-out_infinite_2s] pointer-events-none" />
          {/* Logo */}
          <div className="pt-6 pb-8 px-4 border-b border-white/5 flex justify-center relative z-10">
            <img src={erpAiLogo} alt="ERP AI" className="max-w-[140px] h-auto" />
          </div>

          <SidebarContent className="flex-1 overflow-y-auto custom-scrollbar py-1.5">
            {/* Dashboard */}
            <SidebarGroup className="py-0.5">
              <SidebarGroupContent>
                <SidebarMenu>
                  {mainNav.map((item) => {
                    const itemActive = currentPath === item.url;
                    const badgeCount = item.key === "dashboard" ? criticalInsightCount : 0;
                    return (
                      <SidebarMenuItem key={item.key}>
                        <SidebarMenuButton asChild>
                          <NavLink
                            to={item.url}
                            end
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-[15px] font-medium transition-colors ${
                              itemActive
                                ? "bg-sidebar-primary/10 text-sidebar-primary font-medium"
                                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                            }`}
                            activeClassName="bg-sidebar-primary/10 text-sidebar-primary font-medium"
                          >
                            <div className="relative">
                              <item.icon className={`h-5 w-5 flex-shrink-0 ${itemActive ? "text-sidebar-primary" : "opacity-50"}`} />
                              {badgeCount > 0 && (
                                <span className="absolute -top-1 -right-1.5 h-3.5 min-w-[14px] rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center px-0.5">
                                  {badgeCount > 9 ? "9+" : badgeCount}
                                </span>
                              )}
                            </div>
                            <span>{t(item.key as any)}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {canAccess("crm") && (
              <CollapsibleNavGroup label={t("crm")} items={crmNav} currentPath={currentPath} t={t} icon={Users} />
            )}
            {canAccess("sales") && (
              <CollapsibleNavGroup label={t("salesModule")} items={salesNav} currentPath={currentPath} t={t} icon={ShoppingCart} />
            )}
            {canAccess("pos") && (
              <CollapsibleNavGroup label={t("pos")} items={posNav} currentPath={currentPath} t={t} icon={Monitor} />
            )}
            {canAccess("inventory") && (
              <CollapsibleNavGroup label={t("inventory")} items={inventoryNav} currentPath={currentPath} t={t} icon={Package} />
            )}
            {canAccess("purchasing") && (
              <CollapsibleNavGroup label={t("purchasing")} items={purchasingNav} currentPath={currentPath} t={t} icon={Truck} />
            )}
            {canAccess("production") && (
              <CollapsibleNavGroup label={t("production")} items={productionNav} currentPath={currentPath} t={t} icon={Factory} />
            )}
            {canAccess("returns") && (
              <CollapsibleNavGroup label={t("returns")} items={returnsNav} currentPath={currentPath} t={t} icon={RotateCcw} />
            )}
            {canAccess("service") && (
              <CollapsibleNavGroup label={t("serviceModule" as any)} items={serviceNav} currentPath={currentPath} t={t} icon={Wrench} />
            )}
            {canAccess("analytics") && (
              <CollapsibleNavGroup label={t("analytics")} items={analyticsNav} currentPath={currentPath} t={t} icon={BarChart3} />
            )}
            {canAccess("accounting") && (
              <CollapsibleNavGroup label={t("accounting")} items={accountingNav} currentPath={currentPath} t={t} icon={Calculator} />
            )}
            {canAccess("assets") && (
              <CollapsibleNavGroup label={t("assetsModule" as any)} items={assetsNav} currentPath={currentPath} t={t} icon={Building2} />
            )}
            {canAccess("hr") && (
              <CollapsibleNavGroup label={t("hr")} items={hrNav} currentPath={currentPath} t={t} icon={UserCheck} />
            )}
            {canAccess("documents") && (
              <CollapsibleNavGroup label={t("documentsAndDrive")} items={documentsNav} currentPath={currentPath} t={t} icon={FolderOpen} />
            )}
          </SidebarContent>

          {canAccess("settings") && (
            <SidebarFooter className="border-t border-sidebar-border p-0">
              <SidebarGroup className="py-0 flex flex-col-reverse">
                <Collapsible defaultOpen={settingsNav.some((item) => currentPath.startsWith(item.url))}>
                  <CollapsibleContent className="max-h-[40vh] overflow-y-auto bg-sidebar-accent/30 rounded-md mx-1 mb-1">
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {settingsNav.filter((item) => {
                          if (item.url === "/settings") return true;
                          if (item.url === "/settings/users") return canAccess("settings-users");
                          if (item.url === "/settings/role-permissions") return canAccess("settings-role-permissions");
                          if (item.url === "/settings/approvals") return canAccess("settings-approvals");
                          if (item.url === "/settings/business-rules") return canAccess("settings-business-rules");
                          if (item.url === "/settings/tax-rates") return canAccess("settings-tax-rates");
                          if (item.url === "/settings/currencies") return canAccess("settings-currencies");
                          if (item.url === "/settings/audit-log") return canAccess("settings-audit-log");
                          if (item.url === "/settings/events") return canAccess("settings-events");
                          if (item.url === "/settings/integrations") return canAccess("settings-integrations");
                          return true;
                        }).map((item) => {
                          const itemActive = currentPath === item.url || (item.url !== "/dashboard" && currentPath.startsWith(item.url + "/"));
                          return (
                            <React.Fragment key={item.key}>
                              {item.section && (
                                <li className="px-3 pt-2.5 pb-0.5">
                                  <span className="text-[11px] font-medium text-sidebar-foreground/40 tracking-wide">
                                    {t(item.section as any)}
                                  </span>
                                </li>
                              )}
                              <SidebarMenuItem>
                                <SidebarMenuButton asChild>
                                  <NavLink
                                    to={item.url}
                                    className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-[14px] transition-colors ${
                                      itemActive
                                        ? "bg-sidebar-primary/10 text-sidebar-primary font-medium"
                                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                                    }`}
                                    activeClassName="bg-sidebar-primary/10 text-sidebar-primary font-medium"
                                  >
                                    <item.icon className={`h-4 w-4 flex-shrink-0 ${itemActive ? "text-sidebar-primary" : "opacity-50"}`} />
                                    <span className="truncate">{t(item.key as any)}</span>
                                  </NavLink>
                                </SidebarMenuButton>
                              </SidebarMenuItem>
                            </React.Fragment>
                          );
                        })}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </CollapsibleContent>
                  <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2.5 text-[14px] font-semibold text-sidebar-foreground/90 tracking-wide hover:text-sidebar-foreground transition-colors group">
                    <span className="flex items-center gap-2.5">
                      <Settings className="h-[18px] w-[18px] opacity-80" />
                      {t("settings")}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-180 opacity-50" />
                  </CollapsibleTrigger>
                </Collapsible>
              </SidebarGroup>
            </SidebarFooter>
          )}
          </div>
        </Sidebar>

        <div className="flex-1 flex flex-col h-full min-h-0">
          <header className="h-12 border-b border-border flex items-center justify-between px-4 lg:px-6 bg-background shrink-0 z-10">
            <div className="flex items-center gap-2.5">
              <SidebarTrigger />
              <Separator orientation="vertical" className="h-4" />
              <Breadcrumbs />
            </div>
            <div className="flex items-center gap-1.5">
              {isMobile && (
                <Button
                  variant={aiSidebarOpen ? "secondary" : "ghost"}
                  size="icon-sm"
                  onClick={() => setAiSidebarOpen(prev => !prev)}
                  title="AI Copilot"
                >
                  <Sparkles className="h-4 w-4" />
                </Button>
              )}
              <TenantSelector />
              <NotificationBell />
              <Separator orientation="vertical" className="h-4" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-muted transition-colors">
                    <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium flex-shrink-0">
                      {userInitials}
                    </div>
                    <span className="hidden sm:block text-sm font-medium truncate max-w-[120px]">{userName}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="bottom" align="end" className="w-52">
                  <DropdownMenuItem onClick={() => navigate("/profile")}>
                    <User className="mr-2 h-4 w-4" />
                    {t("myAccount")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLocale(locale === "en" ? "sr" : "en")}>
                    <Globe className="mr-2 h-4 w-4" />
                    {locale === "en" ? "Srpski" : "English"}
                  </DropdownMenuItem>
                  {isSuperAdmin && (
                    <DropdownMenuItem onClick={() => navigate("/super-admin/dashboard")}>
                      <Settings className="mr-2 h-4 w-4" />
                      {t("superAdmin")}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    {t("logout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <div className="flex-1 flex overflow-hidden min-h-0">
            <main className="flex-1 p-4 lg:p-6 overflow-auto bg-background">
              <div className="max-w-screen-2xl mx-auto">
                <ErrorBoundary>
                  <Suspense fallback={<PageSkeleton />}>
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={currentPath}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                      >
                        <Outlet />
                      </motion.div>
                    </AnimatePresence>
                  </Suspense>
                </ErrorBoundary>
              </div>
            </main>
            {!isMobile && (
              <AiContextSidebar open={aiSidebarOpen} onToggle={() => setAiSidebarOpen(prev => !prev)} />
            )}
          </div>
        </div>
        <GlobalSearch />
        <KeyboardShortcutsOverlay open={showOverlay} onOpenChange={setShowOverlay} />
        {isMobile && aiSidebarOpen && (
              <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" onClick={() => setAiSidebarOpen(false)}>
                <div className="absolute right-0 top-0 h-full w-[300px] max-w-[85vw] overflow-hidden" onClick={e => e.stopPropagation()}>
                  <AiContextSidebar open={true} onToggle={() => setAiSidebarOpen(false)} />
                </div>
              </div>
            )}
      </div>
    </SidebarProvider>
  );
}
