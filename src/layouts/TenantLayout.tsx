import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { usePermissions } from "@/hooks/usePermissions";
import { AiAssistantPanel } from "@/components/ai/AiAssistantPanel";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { TenantSelector } from "@/components/TenantSelector";
import { LanguageToggle } from "@/components/LanguageToggle";
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
  SidebarGroupLabel,
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
  ScanBarcode, MapPin, RefreshCw, Brain,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface NavItem {
  key: string;
  url: string;
  icon: LucideIcon;
}

const mainNav: NavItem[] = [
  { key: "dashboard", url: "/dashboard", icon: LayoutDashboard },
];

const inventoryNav: NavItem[] = [
  { key: "products", url: "/inventory/products", icon: Package },
  { key: "stockOverview", url: "/inventory/stock", icon: Warehouse },
  { key: "movementHistory", url: "/inventory/movements", icon: ArrowLeftRight },
  { key: "internalOrders", url: "/inventory/internal-orders", icon: ClipboardCheck },
  { key: "internalTransfers", url: "/inventory/internal-transfers", icon: Truck },
  { key: "internalReceipts", url: "/inventory/internal-receipts", icon: FileInput },
  { key: "kalkulacija", url: "/inventory/kalkulacija", icon: Calculator },
  { key: "nivelacija", url: "/inventory/nivelacija", icon: TrendingUp },
  { key: "dispatchNotes", url: "/inventory/dispatch-notes", icon: Truck },
  { key: "costLayers", url: "/inventory/cost-layers", icon: Coins },
  { key: "wmsZones", url: "/inventory/wms/zones", icon: MapPin },
  { key: "wmsTasks", url: "/inventory/wms/tasks", icon: ClipboardCheck },
  { key: "wmsReceiving", url: "/inventory/wms/receiving", icon: Truck },
  { key: "wmsPicking", url: "/inventory/wms/picking", icon: ScanBarcode },
  { key: "wmsCycleCounts", url: "/inventory/wms/cycle-counts", icon: RefreshCw },
  { key: "wmsSlotting", url: "/inventory/wms/slotting", icon: Brain },
];

const accountingNav: NavItem[] = [
  { key: "chartOfAccounts", url: "/accounting/chart-of-accounts", icon: BookOpen },
  { key: "journalEntries", url: "/accounting/journal", icon: Calculator },
  { key: "invoices", url: "/accounting/invoices", icon: Receipt },
  { key: "bankStatements", url: "/accounting/bank-statements", icon: FileSpreadsheet },
  { key: "openItems", url: "/accounting/open-items", icon: ListChecks },
  { key: "pdvPeriods", url: "/accounting/pdv", icon: ReceiptText },
  { key: "fiscalPeriods", url: "/accounting/fiscal-periods", icon: CalendarDays },
  { key: "yearEndClosing", url: "/accounting/year-end", icon: Lock },
  { key: "generalLedger", url: "/accounting/ledger", icon: BookText },
  { key: "fixedAssets", url: "/accounting/fixed-assets", icon: Landmark },
  { key: "deferrals", url: "/accounting/deferrals", icon: Timer },
  { key: "loans", url: "/accounting/loans", icon: Coins },
  { key: "fxRevaluation", url: "/accounting/fx-revaluation", icon: DollarSign },
  { key: "kompenzacija", url: "/accounting/kompenzacija", icon: ArrowLeftRight },
  { key: "reports", url: "/accounting/reports", icon: BarChart3 },
];

const crmNav: NavItem[] = [
  { key: "crmDashboard", url: "/crm", icon: LayoutDashboard },
  { key: "companies", url: "/crm/companies", icon: Building },
  { key: "contacts", url: "/crm/contacts", icon: Users },
  { key: "leads", url: "/crm/leads", icon: Target },
  { key: "opportunities", url: "/crm/opportunities", icon: TrendingUp },
  { key: "meetings", url: "/crm/meetings", icon: CalendarDays },
  { key: "partners", url: "/crm/partners", icon: Handshake },
];

const salesNav: NavItem[] = [
  { key: "quotes", url: "/sales/quotes", icon: FileCheck },
  { key: "salesOrders", url: "/sales/sales-orders", icon: ShoppingCart },
  { key: "salesChannels", url: "/sales/sales-channels", icon: Grid3X3 },
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
  { key: "employees", url: "/hr/employees", icon: UserCheck },
  { key: "contracts", url: "/hr/contracts", icon: FileSignature },
  { key: "departments", url: "/hr/departments", icon: Building },
  { key: "positionTemplates", url: "/hr/position-templates", icon: Briefcase },
  { key: "workLogs", url: "/hr/work-logs", icon: Clock },
  { key: "overtimeHours", url: "/hr/overtime", icon: Timer },
  { key: "nightWork", url: "/hr/night-work", icon: Moon },
  { key: "annualLeaveBalance", url: "/hr/annual-leave", icon: CalendarOff },
  { key: "holidays", url: "/hr/holidays", icon: Calendar },
  { key: "leaveRequests", url: "/hr/leave-requests", icon: CalendarOff },
  { key: "deductionsModule", url: "/hr/deductions", icon: Coins },
  { key: "allowance", url: "/hr/allowances", icon: Banknote },
  { key: "salaryHistory", url: "/hr/salaries", icon: Banknote },
  { key: "externalWorkers", url: "/hr/external-workers", icon: Users },
  { key: "insuranceRecords", url: "/hr/insurance", icon: Shield },
  { key: "payroll", url: "/hr/payroll", icon: Banknote },
  { key: "eBolovanje", url: "/hr/ebolovanje", icon: Heart },
  { key: "hrReports", url: "/hr/reports", icon: BarChart3 },
];

const productionNav: NavItem[] = [
  { key: "bomTemplates", url: "/production/bom", icon: Layers },
  { key: "productionOrders", url: "/production/orders", icon: Factory },
];

const documentsNav: NavItem[] = [
  { key: "dmsRegistry", url: "/documents", icon: FolderOpen },
  { key: "dmsArchiveBook", url: "/documents/archive-book", icon: BookOpen },
  { key: "dmsArchiving", url: "/documents/archiving", icon: FileText },
  { key: "dmsProjects", url: "/documents/projects", icon: Layers },
  { key: "dmsBrowser", url: "/documents/browser", icon: Search },
  { key: "dmsReports", url: "/documents/reports", icon: BarChart3 },
  { key: "dmsSettings", url: "/documents/settings", icon: Settings },
];

const posNav: NavItem[] = [
  { key: "posTerminal", url: "/pos/terminal", icon: Monitor },
  { key: "posSessions", url: "/pos/sessions", icon: CreditCard },
  { key: "fiscalDevices", url: "/pos/fiscal-devices", icon: Receipt },
  { key: "dailyReport", url: "/pos/daily-report", icon: FileText },
];

const settingsNav: NavItem[] = [
  { key: "companySettings", url: "/settings", icon: Settings },
  { key: "taxRates", url: "/settings/tax-rates", icon: Percent },
  { key: "users", url: "/settings/users", icon: Users },
  { key: "approvalWorkflows", url: "/settings/approvals", icon: CheckSquare },
  { key: "pendingApprovalsPage", url: "/settings/pending-approvals", icon: ClipboardCheck },
  { key: "currencies", url: "/settings/currencies", icon: DollarSign },
  { key: "integrations", url: "/settings/integrations", icon: Plug },
  { key: "auditLog", url: "/settings/audit-log", icon: FileText },
  { key: "eventMonitor", url: "/settings/events", icon: Activity },
];

function CollapsibleNavGroup({
  label,
  items,
  currentPath,
  t,
  accentColor,
}: {
  label: string;
  items: NavItem[];
  currentPath: string;
  t: (key: any) => string;
  accentColor?: string;
}) {
  const isActive = items.some((item) => currentPath.startsWith(item.url));

  return (
    <SidebarGroup className="py-0">
      <Collapsible defaultOpen={isActive}>
        <CollapsibleTrigger className="flex w-full items-center justify-between px-2 py-1.5 text-[11px] font-semibold text-sidebar-foreground/60 uppercase tracking-widest hover:text-sidebar-foreground transition-colors group">
          <span className="flex items-center gap-2">
            {accentColor && <span className={`h-1.5 w-1.5 rounded-full ${accentColor}`} />}
            {label}
          </span>
          <ChevronDown className="h-3 w-3 transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm hover:bg-sidebar-accent transition-colors"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{t(item.key as any)}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
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
      <div className="min-h-screen flex w-full">
        <Sidebar className="border-r border-sidebar-border">
          {/* Logo + Search trigger */}
          <div className="p-4 border-b border-sidebar-border space-y-3">
            <h2 className="text-lg font-bold text-sidebar-foreground tracking-tight">ERP-AI</h2>
            <button
              onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
              className="flex w-full items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/50 px-3 py-1.5 text-xs text-sidebar-foreground/60 hover:bg-sidebar-accent transition-colors"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="flex-1 text-left">{t("search")}</span>
              <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-sidebar-border bg-sidebar-background px-1.5 text-[10px] font-medium text-sidebar-foreground/50">
                <Command className="h-2.5 w-2.5" />K
              </kbd>
            </button>
          </div>

          <SidebarContent className="flex-1 overflow-y-auto">
            {/* Dashboard */}
            <SidebarGroup className="py-1">
              <SidebarGroupContent>
                <SidebarMenu>
                  {mainNav.map((item) => (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
                          end
                          className="flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm hover:bg-sidebar-accent transition-colors"
                          activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                        >
                          <item.icon className="h-4 w-4 flex-shrink-0" />
                          <span>{t(item.key as any)}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {canAccess("crm") && (
              <CollapsibleNavGroup label={t("crm")} items={crmNav} currentPath={currentPath} t={t} accentColor="bg-blue-500" />
            )}
            {canAccess("sales") && (
              <CollapsibleNavGroup label={t("salesModule")} items={salesNav} currentPath={currentPath} t={t} accentColor="bg-amber-500" />
            )}
            {canAccess("purchasing") && (
              <CollapsibleNavGroup label={t("purchasing")} items={purchasingNav} currentPath={currentPath} t={t} accentColor="bg-violet-500" />
            )}
            {canAccess("inventory") && (
              <CollapsibleNavGroup label={t("inventory")} items={inventoryNav} currentPath={currentPath} t={t} accentColor="bg-yellow-500" />
            )}
            {canAccess("production") && (
              <CollapsibleNavGroup label={t("production")} items={productionNav} currentPath={currentPath} t={t} accentColor="bg-cyan-500" />
            )}
            {canAccess("accounting") && (
              <CollapsibleNavGroup label={t("accounting")} items={accountingNav} currentPath={currentPath} t={t} accentColor="bg-emerald-500" />
            )}
            {canAccess("hr") && (
              <CollapsibleNavGroup label={t("hr")} items={hrNav} currentPath={currentPath} t={t} accentColor="bg-purple-500" />
            )}
            {canAccess("pos") && (
              <CollapsibleNavGroup label={t("pos")} items={posNav} currentPath={currentPath} t={t} accentColor="bg-teal-500" />
            )}
            {canAccess("web") && (
              <CollapsibleNavGroup label={t("webSales")} items={webNav} currentPath={currentPath} t={t} accentColor="bg-indigo-500" />
            )}
            {canAccess("documents") && (
              <CollapsibleNavGroup label={t("documents")} items={documentsNav} currentPath={currentPath} t={t} accentColor="bg-pink-500" />
            )}
            {canAccess("returns") && (
              <CollapsibleNavGroup label={t("returns")} items={returnsNav} currentPath={currentPath} t={t} accentColor="bg-rose-400" />
            )}
          </SidebarContent>

          {/* Settings pinned to bottom */}
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
              />
            )}

          </SidebarFooter>
        </Sidebar>

        <div className="flex-1 flex flex-col min-h-screen">
          <header className="h-12 border-b flex items-center justify-between px-4 bg-card/80 backdrop-blur-sm sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <Separator orientation="vertical" className="h-5" />
              <Breadcrumbs />
            </div>
            <div className="flex items-center gap-1.5">
              <TenantSelector />
              <NotificationBell />
              <Separator orientation="vertical" className="h-5" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-accent transition-colors">
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
          <main className="flex-1 p-6 overflow-auto animate-in fade-in duration-300">
            <Outlet />
          </main>
        </div>
        <GlobalSearch />
        <AiAssistantPanel />
      </div>
    </SidebarProvider>
  );
}
