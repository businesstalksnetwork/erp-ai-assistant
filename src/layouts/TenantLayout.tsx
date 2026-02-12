import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { usePermissions } from "@/hooks/usePermissions";
import { AiAssistantPanel } from "@/components/ai/AiAssistantPanel";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { LanguageToggle } from "@/components/LanguageToggle";
import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
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
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Settings,
  Users,
  FileText,
  BookOpen,
  Calculator,
  CalendarDays,
  Receipt,
  BookText,
  BarChart3,
  Percent,
  Handshake,
  Package,
  Warehouse,
  ArrowLeftRight,
  UserCheck,
  Building,
  Clock,
  CalendarOff,
  Banknote,
  FileSignature,
  Target,
  TrendingUp,
  FileCheck,
  ShoppingCart,
  Layers,
  Factory,
  FolderOpen,
  Monitor,
  CreditCard,
  Activity,
  Truck,
  ClipboardCheck,
  FileInput,
  RotateCcw,
  Landmark,
  Timer,
  Coins,
  CheckSquare,
  DollarSign,
  ChevronDown,
  User,
  LogOut,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

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
];

const accountingNav: NavItem[] = [
  { key: "chartOfAccounts", url: "/accounting/chart-of-accounts", icon: BookOpen },
  { key: "journalEntries", url: "/accounting/journal", icon: Calculator },
  { key: "invoices", url: "/accounting/invoices", icon: Receipt },
  { key: "fiscalPeriods", url: "/accounting/fiscal-periods", icon: CalendarDays },
  { key: "generalLedger", url: "/accounting/ledger", icon: BookText },
  { key: "fixedAssets", url: "/accounting/fixed-assets", icon: Landmark },
  { key: "deferrals", url: "/accounting/deferrals", icon: Timer },
  { key: "loans", url: "/accounting/loans", icon: Coins },
  { key: "reports", url: "/accounting/reports", icon: BarChart3 },
];

const crmNav: NavItem[] = [
  { key: "partners", url: "/crm/partners", icon: Handshake },
  { key: "leads", url: "/crm/leads", icon: Target },
  { key: "opportunities", url: "/crm/opportunities", icon: TrendingUp },
  { key: "quotes", url: "/crm/quotes", icon: FileCheck },
  { key: "salesOrders", url: "/crm/sales-orders", icon: ShoppingCart },
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
  { key: "attendance", url: "/hr/attendance", icon: Clock },
  { key: "leaveRequests", url: "/hr/leave-requests", icon: CalendarOff },
  { key: "payroll", url: "/hr/payroll", icon: Banknote },
];

const productionNav: NavItem[] = [
  { key: "bomTemplates", url: "/production/bom", icon: Layers },
  { key: "productionOrders", url: "/production/orders", icon: Factory },
];

const documentsNav: NavItem[] = [
  { key: "documents", url: "/documents", icon: FolderOpen },
];

const posNav: NavItem[] = [
  { key: "posTerminal", url: "/pos/terminal", icon: Monitor },
  { key: "posSessions", url: "/pos/sessions", icon: CreditCard },
];

const settingsNav: NavItem[] = [
  { key: "companySettings", url: "/settings", icon: Settings },
  { key: "taxRates", url: "/settings/tax-rates", icon: Percent },
  { key: "users", url: "/settings/users", icon: Users },
  { key: "approvalWorkflows", url: "/settings/approvals", icon: CheckSquare },
  { key: "currencies", url: "/settings/currencies", icon: DollarSign },
  { key: "auditLog", url: "/settings/audit-log", icon: FileText },
  { key: "eventMonitor", url: "/settings/events", icon: Activity },
];

function CollapsibleNavGroup({
  label,
  items,
  currentPath,
  t,
}: {
  label: string;
  items: NavItem[];
  currentPath: string;
  t: (key: any) => string;
}) {
  const isActive = items.some((item) => currentPath.startsWith(item.url));

  return (
    <SidebarGroup>
      <Collapsible defaultOpen={isActive}>
        <CollapsibleTrigger className="flex w-full items-center justify-between px-2 py-1.5 text-xs font-medium text-sidebar-foreground/70 uppercase tracking-wider hover:text-sidebar-foreground transition-colors group">
          <span>{label}</span>
          <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{t(item.key as any)}</span>
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
  const { t } = useLanguage();
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
      return name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return (user?.email?.[0] || "U").toUpperCase();
  })();

  const userName = user?.user_metadata?.full_name || user?.email || "";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <Sidebar className="border-r border-sidebar-border">
          <div className="p-4 border-b border-sidebar-border">
            <h2 className="text-lg font-bold text-sidebar-foreground">ERP-AI</h2>
          </div>
          <SidebarContent>
            {/* Dashboard - always visible, not collapsible */}
            <SidebarGroup>
              <SidebarGroupLabel>{t("dashboard")}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {mainNav.map((item) => (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
                          end
                          className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-sidebar-accent"
                          activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                        >
                          <item.icon className="h-4 w-4" />
                          <span>{t(item.key as any)}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {canAccess("crm") && (
              <CollapsibleNavGroup label={t("crm")} items={crmNav} currentPath={currentPath} t={t} />
            )}
            {canAccess("purchasing") && (
              <CollapsibleNavGroup label={t("purchasing")} items={purchasingNav} currentPath={currentPath} t={t} />
            )}
            {canAccess("returns") && (
              <CollapsibleNavGroup label={t("returns")} items={returnsNav} currentPath={currentPath} t={t} />
            )}
            {canAccess("hr") && (
              <CollapsibleNavGroup label={t("hr")} items={hrNav} currentPath={currentPath} t={t} />
            )}
            {canAccess("inventory") && (
              <CollapsibleNavGroup label={t("inventory")} items={inventoryNav} currentPath={currentPath} t={t} />
            )}
            {canAccess("accounting") && (
              <CollapsibleNavGroup label={t("accounting")} items={accountingNav} currentPath={currentPath} t={t} />
            )}
            {canAccess("production") && (
              <CollapsibleNavGroup label={t("production")} items={productionNav} currentPath={currentPath} t={t} />
            )}
            {canAccess("documents") && (
              <CollapsibleNavGroup label={t("documents")} items={documentsNav} currentPath={currentPath} t={t} />
            )}
            {canAccess("pos") && (
              <CollapsibleNavGroup label={t("pos")} items={posNav} currentPath={currentPath} t={t} />
            )}
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
              />
            )}
          </SidebarContent>
        </Sidebar>

        <div className="flex-1 flex flex-col min-h-screen">
          <header className="h-14 border-b flex items-center justify-between px-4 bg-card">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              {isSuperAdmin && (
                <Button variant="outline" size="sm" onClick={() => navigate("/super-admin/dashboard")}>
                  {t("superAdmin")}
                </Button>
              )}
              <NotificationBell />
              <LanguageToggle />

              {/* User dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">
                      {userInitials}
                    </div>
                    <span className="hidden md:inline text-sm max-w-[120px] truncate">{userName}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => navigate("/profile")}>
                    <User className="mr-2 h-4 w-4" />
                    {t("myAccount")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    {t("logout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main className="flex-1 p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
        <AiAssistantPanel />
      </div>
    </SidebarProvider>
  );
}
