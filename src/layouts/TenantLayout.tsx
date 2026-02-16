import React, { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { usePermissions } from "@/hooks/usePermissions";
import { AiAssistantPanel } from "@/components/ai/AiAssistantPanel";
import { AiContextSidebar } from "@/components/ai/AiContextSidebar";
import { useIsMobile } from "@/hooks/use-mobile";
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
  ScanBarcode, MapPin, RefreshCw, Brain, AlertTriangle, TrendingDown, Sparkles,
  ChevronRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface NavItem {
  key: string;
  url: string;
  icon: LucideIcon;
  section?: string;
}

const mainNav: NavItem[] = [
  { key: "dashboard", url: "/dashboard", icon: LayoutDashboard },
];

const inventoryNav: NavItem[] = [
  { key: "products", url: "/inventory/products", icon: Package, section: "coreInventory" },
  { key: "stockOverview", url: "/inventory/stock", icon: Warehouse },
  { key: "movementHistory", url: "/inventory/movements", icon: ArrowLeftRight },
  { key: "costLayers", url: "/inventory/cost-layers", icon: Coins },
  { key: "internalOrders", url: "/inventory/internal-orders", icon: ClipboardCheck, section: "internalLogistics" },
  { key: "internalTransfers", url: "/inventory/internal-transfers", icon: Truck },
  { key: "internalReceipts", url: "/inventory/internal-receipts", icon: FileInput },
  { key: "dispatchNotes", url: "/inventory/dispatch-notes", icon: Truck },
  { key: "kalkulacija", url: "/inventory/kalkulacija", icon: Calculator, section: "pricingOperations" },
  { key: "nivelacija", url: "/inventory/nivelacija", icon: TrendingUp },
  { key: "wmsDashboard", url: "/inventory/wms/dashboard", icon: LayoutDashboard, section: "wms" },
  { key: "wmsZones", url: "/inventory/wms/zones", icon: MapPin },
  { key: "wmsTasks", url: "/inventory/wms/tasks", icon: ClipboardCheck },
  { key: "wmsReceiving", url: "/inventory/wms/receiving", icon: Truck },
  { key: "wmsPicking", url: "/inventory/wms/picking", icon: ScanBarcode },
  { key: "wmsCycleCounts", url: "/inventory/wms/cycle-counts", icon: RefreshCw },
  { key: "wmsSlotting", url: "/inventory/wms/slotting", icon: Brain },
];

const accountingNav: NavItem[] = [
  { key: "chartOfAccounts", url: "/accounting/chart-of-accounts", icon: BookOpen, section: "bookkeeping" },
  { key: "journalEntries", url: "/accounting/journal", icon: Calculator },
  { key: "generalLedger", url: "/accounting/ledger", icon: BookText },
  { key: "invoices", url: "/accounting/invoices", icon: Receipt, section: "invoicingPayments" },
  { key: "bankStatements", url: "/accounting/bank-statements", icon: FileSpreadsheet },
  { key: "openItems", url: "/accounting/open-items", icon: ListChecks },
  { key: "expensesOverview", url: "/accounting/expenses", icon: TrendingDown },
  { key: "kompenzacija", url: "/accounting/kompenzacija", icon: ArrowLeftRight },
  { key: "fixedAssets", url: "/accounting/fixed-assets", icon: Landmark, section: "assetsAccruals" },
  { key: "deferrals", url: "/accounting/deferrals", icon: Timer },
  { key: "loans", url: "/accounting/loans", icon: Coins },
  { key: "fxRevaluation", url: "/accounting/fx-revaluation", icon: DollarSign },
  { key: "pdvPeriods", url: "/accounting/pdv", icon: ReceiptText, section: "taxClosing" },
  { key: "fiscalPeriods", url: "/accounting/fiscal-periods", icon: CalendarDays },
  { key: "yearEndClosing", url: "/accounting/year-end", icon: Lock },
  { key: "reports", url: "/accounting/reports", icon: BarChart3 },
];

const analyticsNav: NavItem[] = [
  { key: "analyticsDashboard", url: "/analytics", icon: BarChart3, section: "analyticsOverview" },
  { key: "workingCapitalStress", url: "/analytics/working-capital", icon: Activity, section: "financialHealth" },
  { key: "financialRatios", url: "/analytics/ratios", icon: Activity },
  { key: "profitabilityAnalysis", url: "/analytics/profitability", icon: TrendingUp },
  { key: "marginBridge", url: "/analytics/margin-bridge", icon: TrendingUp },
  { key: "customerRiskScoring", url: "/analytics/customer-risk", icon: AlertTriangle, section: "riskCompliance" },
  { key: "supplierDependency", url: "/analytics/supplier-risk", icon: Truck },
  { key: "vatCashTrap", url: "/analytics/vat-trap", icon: AlertTriangle },
  { key: "earlyWarningSystem", url: "/analytics/early-warning", icon: AlertTriangle },
  { key: "inventoryHealth", url: "/analytics/inventory-health", icon: Package, section: "operationsAnalytics" },
  { key: "payrollBenchmark", url: "/analytics/payroll-benchmark", icon: Banknote },
  { key: "cashFlowForecast", url: "/analytics/cashflow-forecast", icon: DollarSign, section: "forecasting" },
  { key: "budgetVsActuals", url: "/analytics/budget", icon: Target },
  { key: "breakEvenAnalysis", url: "/analytics/break-even", icon: Calculator, section: "strategicPlanning" },
  { key: "businessPlanning", url: "/analytics/planning", icon: Briefcase },
];

const crmNav: NavItem[] = [
  { key: "crmDashboard", url: "/crm", icon: LayoutDashboard, section: "overview" },
  { key: "companies", url: "/crm/companies", icon: Building, section: "records" },
  { key: "contacts", url: "/crm/contacts", icon: Users },
  { key: "leads", url: "/crm/leads", icon: Target },
  { key: "opportunities", url: "/crm/opportunities", icon: TrendingUp },
  { key: "meetings", url: "/crm/meetings", icon: CalendarDays },
  { key: "partners", url: "/crm/partners", icon: Handshake },
];

const salesNav: NavItem[] = [
  { key: "quotes", url: "/sales/quotes", icon: FileCheck, section: "salesDocuments" },
  { key: "salesOrders", url: "/sales/sales-orders", icon: ShoppingCart },
  { key: "salesChannels", url: "/sales/sales-channels", icon: Grid3X3, section: "performancePricing" },
  { key: "salespeople", url: "/sales/salespeople", icon: UserCheck },
  { key: "salesPerformance", url: "/sales/sales-performance", icon: BarChart3 },
  { key: "retailPrices", url: "/sales/retail-prices", icon: Receipt },
];

const webNav: NavItem[] = [
  { key: "webSettings", url: "/web/settings", icon: Globe },
  { key: "webPrices", url: "/web/prices", icon: Receipt },
];

const purchasingNav: NavItem[] = [
  { key: "purchaseOrders", url: "/purchasing/orders", icon: Truck },
  { key: "goodsReceipts", url: "/purchasing/goods-receipts", icon: ClipboardCheck },
  { key: "supplierInvoices", url: "/purchasing/supplier-invoices", icon: FileInput },
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
  { key: "overtimeHours", url: "/hr/overtime", icon: Timer },
  { key: "nightWork", url: "/hr/night-work", icon: Moon },
  { key: "attendance", url: "/hr/attendance", icon: Clock },
  { key: "annualLeaveBalance", url: "/hr/annual-leave", icon: CalendarOff, section: "leave" },
  { key: "holidays", url: "/hr/holidays", icon: Calendar },
  { key: "leaveRequests", url: "/hr/leave-requests", icon: CalendarOff },
  { key: "deductionsModule", url: "/hr/deductions", icon: Coins, section: "compensation" },
  { key: "allowance", url: "/hr/allowances", icon: Banknote },
  { key: "salaryHistory", url: "/hr/salaries", icon: Banknote },
  { key: "payroll", url: "/hr/payroll", icon: Banknote },
  { key: "externalWorkers", url: "/hr/external-workers", icon: Users, section: "other" },
  { key: "insuranceRecords", url: "/hr/insurance", icon: Shield },
  { key: "eBolovanje", url: "/hr/ebolovanje", icon: Heart },
  { key: "hrReports", url: "/hr/reports", icon: BarChart3 },
];

const productionNav: NavItem[] = [
  { key: "bomTemplates", url: "/production/bom", icon: Layers, section: "existingSection" },
  { key: "productionOrders", url: "/production/orders", icon: Factory },
  { key: "aiPlanningDashboard", url: "/production/ai-planning", icon: Brain, section: "aiPlanningSection" },
  { key: "aiSchedule", url: "/production/ai-planning/schedule", icon: CalendarDays },
  { key: "bottleneckPrediction", url: "/production/ai-planning/bottlenecks", icon: AlertTriangle },
  { key: "capacitySimulation", url: "/production/ai-planning/scenarios", icon: BarChart3 },
  { key: "productionCalendar", url: "/production/ai-planning/calendar", icon: Calendar },
];

const documentsNav: NavItem[] = [
  { key: "dmsRegistry", url: "/documents", icon: FolderOpen, section: "registry" },
  { key: "dmsArchiveBook", url: "/documents/archive-book", icon: BookOpen },
  { key: "dmsArchiving", url: "/documents/archiving", icon: FileText },
  { key: "dmsProjects", url: "/documents/projects", icon: Layers, section: "management" },
  { key: "dmsBrowser", url: "/documents/browser", icon: Search },
  { key: "dmsReports", url: "/documents/reports", icon: BarChart3 },
  { key: "dmsSettings", url: "/documents/settings", icon: Settings },
];

const posNav: NavItem[] = [
  { key: "posTerminal", url: "/pos/terminal", icon: Monitor, section: "terminal" },
  { key: "posSessions", url: "/pos/sessions", icon: CreditCard, section: "administration" },
  { key: "fiscalDevices", url: "/pos/fiscal-devices", icon: Receipt },
  { key: "dailyReport", url: "/pos/daily-report", icon: FileText },
];

const settingsNav: NavItem[] = [
  { key: "companySettings", url: "/settings", icon: Settings, section: "settingsGeneral" },
  { key: "taxRates", url: "/settings/tax-rates", icon: Percent },
  { key: "currencies", url: "/settings/currencies", icon: DollarSign },
  { key: "users", url: "/settings/users", icon: Users, section: "accessControl" },
  { key: "approvalWorkflows", url: "/settings/approvals", icon: CheckSquare },
  { key: "pendingApprovalsPage", url: "/settings/pending-approvals", icon: ClipboardCheck },
  { key: "integrations", url: "/settings/integrations", icon: Plug, section: "system" },
  { key: "auditLog", url: "/settings/audit-log", icon: FileText },
  { key: "eventMonitor", url: "/settings/events", icon: Activity },
];

function CollapsibleNavGroup({
  label,
  items,
  currentPath,
  t,
  accentColor,
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
        <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-[10px] font-semibold text-sidebar-foreground/50 uppercase tracking-widest hover:text-sidebar-foreground transition-colors group">
          <span className="flex items-center gap-2">
            {Icon && <Icon className={`h-3.5 w-3.5 ${accentColor ? accentColor.replace('bg-', 'text-') : ''}`} />}
            {!Icon && accentColor && <span className={`h-1.5 w-1.5 rounded-full ${accentColor}`} />}
            {label}
          </span>
          <ChevronDown className="h-3 w-3 transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const itemActive = currentPath === item.url || (item.url !== "/dashboard" && currentPath.startsWith(item.url + "/"));
                return (
                  <React.Fragment key={item.key}>
                    {item.section && (
                      <li className="px-3 pt-3 pb-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/30">
                          {t(item.section as any)}
                        </span>
                      </li>
                    )}
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
                          className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-all border-l-2 border-transparent ${
                            itemActive
                              ? "bg-primary/10 text-primary font-medium border-l-primary shadow-sm"
                              : "hover:bg-sidebar-accent"
                          }`}
                          activeClassName="bg-primary/10 text-primary font-medium border-l-primary shadow-sm"
                        >
                          <item.icon className={`h-4 w-4 flex-shrink-0 ${itemActive ? "text-primary" : "opacity-60"}`} />
                          <span className="truncate">{t(item.key as any)}</span>
                          {itemActive && <ChevronRight className="h-3 w-3 ml-auto opacity-50" />}
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
}

export default function TenantLayout() {
  const { t, locale, setLocale } = useLanguage();
  const { signOut, user, isSuperAdmin } = useAuth();
  const { canAccess } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;
  const isMobile = useIsMobile();
  const [aiSidebarOpen, setAiSidebarOpen] = useState(false);

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
  const userRole = user?.user_metadata?.role || "user";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <Sidebar className="border-r border-sidebar-border w-64">
          {/* Logo + Search trigger */}
          <div className="p-4 border-b border-sidebar-border space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center shadow-sm">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <h2 className="text-lg font-bold text-sidebar-foreground tracking-tight">ERP-AI</h2>
            </div>
            <button
              onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
              className="flex w-full items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent/30 px-3 py-1.5 text-xs text-sidebar-foreground/50 hover:bg-sidebar-accent hover:border-sidebar-foreground/20 transition-all"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="flex-1 text-left">{t("search")}</span>
              <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-sidebar-border bg-sidebar-background px-1.5 text-[10px] font-medium text-sidebar-foreground/40">
                <Command className="h-2.5 w-2.5" />K
              </kbd>
            </button>
          </div>

          <SidebarContent className="flex-1 overflow-y-auto custom-scrollbar py-1">
            {/* Dashboard */}
            <SidebarGroup className="py-1">
              <SidebarGroupContent>
                <SidebarMenu>
                  {mainNav.map((item) => {
                    const itemActive = currentPath === item.url;
                    return (
                      <SidebarMenuItem key={item.key}>
                        <SidebarMenuButton asChild>
                          <NavLink
                            to={item.url}
                            end
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all border-l-2 border-transparent ${
                              itemActive
                                ? "bg-primary/10 text-primary font-medium border-l-primary shadow-sm"
                                : "hover:bg-sidebar-accent"
                            }`}
                            activeClassName="bg-primary/10 text-primary font-medium border-l-primary shadow-sm"
                          >
                            <item.icon className={`h-4 w-4 flex-shrink-0 ${itemActive ? "text-primary" : ""}`} />
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
              <CollapsibleNavGroup label={t("crm")} items={crmNav} currentPath={currentPath} t={t} accentColor="bg-blue-500" icon={Users} />
            )}
            {canAccess("sales") && (
              <CollapsibleNavGroup label={t("salesModule")} items={salesNav} currentPath={currentPath} t={t} accentColor="bg-amber-500" icon={ShoppingCart} />
            )}
            {canAccess("pos") && (
              <CollapsibleNavGroup label={t("pos")} items={posNav} currentPath={currentPath} t={t} accentColor="bg-teal-500" icon={Monitor} />
            )}
            {canAccess("web") && (
              <CollapsibleNavGroup label={t("webSales")} items={webNav} currentPath={currentPath} t={t} accentColor="bg-indigo-500" icon={Globe} />
            )}
            {canAccess("inventory") && (
              <CollapsibleNavGroup label={t("inventory")} items={inventoryNav} currentPath={currentPath} t={t} accentColor="bg-yellow-500" icon={Package} />
            )}
            {canAccess("purchasing") && (
              <CollapsibleNavGroup label={t("purchasing")} items={purchasingNav} currentPath={currentPath} t={t} accentColor="bg-violet-500" icon={Truck} />
            )}
            {canAccess("production") && (
              <CollapsibleNavGroup label={t("production")} items={productionNav} currentPath={currentPath} t={t} accentColor="bg-cyan-500" icon={Factory} />
            )}
            {canAccess("returns") && (
              <CollapsibleNavGroup label={t("returns")} items={returnsNav} currentPath={currentPath} t={t} accentColor="bg-rose-400" icon={RotateCcw} />
            )}
            {canAccess("analytics") && (
              <CollapsibleNavGroup label={t("analytics")} items={analyticsNav} currentPath={currentPath} t={t} accentColor="bg-orange-500" icon={BarChart3} />
            )}
            {canAccess("accounting") && (
              <CollapsibleNavGroup label={t("accounting")} items={accountingNav} currentPath={currentPath} t={t} accentColor="bg-emerald-500" icon={Calculator} />
            )}
            {canAccess("hr") && (
              <CollapsibleNavGroup label={t("hr")} items={hrNav} currentPath={currentPath} t={t} accentColor="bg-purple-500" icon={UserCheck} />
            )}
            {canAccess("documents") && (
              <CollapsibleNavGroup label={t("documents")} items={documentsNav} currentPath={currentPath} t={t} accentColor="bg-pink-500" icon={FolderOpen} />
            )}
          </SidebarContent>

          {/* User profile + Settings pinned to bottom */}
          <SidebarFooter className="border-t border-sidebar-border p-0">
            {canAccess("settings") && (
              <CollapsibleNavGroup
                label={t("settings")}
                items={settingsNav.filter((item) => {
                  if (item.url === "/settings") return true;
                  if (item.url === "/settings/users") return canAccess("settings-users");
                  if (item.url === "/settings/approvals") return canAccess("settings-approvals");
                  if (item.url === "/settings/business-rules") return canAccess("settings-business-rules");
                  if (item.url === "/settings/tax-rates") return canAccess("settings-tax-rates");
                  if (item.url === "/settings/currencies") return canAccess("settings-currencies");
                  if (item.url === "/settings/audit-log") return canAccess("settings-audit-log");
                  if (item.url === "/settings/events") return canAccess("settings-events");
                  if (item.url === "/settings/integrations") return canAccess("settings-integrations");
                  return true;
                })}
                currentPath={currentPath}
                t={t}
                accentColor="bg-slate-400"
                icon={Settings}
              />
            )}
          </SidebarFooter>
        </Sidebar>

        <div className="flex-1 flex flex-col h-screen">
          <header className="h-11 border-b border-border/50 flex items-center justify-between px-4 bg-background/80 backdrop-blur-lg sticky top-0 z-10 shadow-[0_1px_3px_0_hsl(var(--foreground)/0.04)]">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <Separator orientation="vertical" className="h-4" />
              <Breadcrumbs />
            </div>
            <div className="flex items-center gap-1.5">
              {isMobile && (
                <Button
                  variant={aiSidebarOpen ? "secondary" : "ghost"}
                  size="icon"
                  className="h-8 w-8"
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
                  <button className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted transition-colors">
                    <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold flex-shrink-0">
                      {userInitials}
                    </div>
                    <span className="hidden sm:block text-sm font-medium truncate max-w-[120px]">{userName}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="bottom" align="end" className="w-56">
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
          <div className="flex-1 flex overflow-hidden">
            <main className="flex-1 p-4 lg:p-6 overflow-auto animate-in fade-in duration-300">
              <div className="max-w-screen-2xl mx-auto">
                <Outlet />
              </div>
            </main>
            {!isMobile && (
              <AiContextSidebar open={aiSidebarOpen} onToggle={() => setAiSidebarOpen(prev => !prev)} />
            )}
          </div>
        </div>
        <GlobalSearch />
        {isMobile && <AiAssistantPanel />}
      </div>
    </SidebarProvider>
  );
}
