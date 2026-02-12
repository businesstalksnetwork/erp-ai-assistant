import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { usePermissions } from "@/hooks/usePermissions";
import { AiAssistantPanel } from "@/components/ai/AiAssistantPanel";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { LanguageToggle } from "@/components/LanguageToggle";
import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
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
  LogOut,
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
  PieChart,
  Timer,
  Coins,
  CheckSquare,
  DollarSign,
} from "lucide-react";

const mainNav = [
  { key: "dashboard" as const, url: "/dashboard", icon: LayoutDashboard },
];

const inventoryNav = [
  { key: "products" as const, url: "/inventory/products", icon: Package },
  { key: "stockOverview" as const, url: "/inventory/stock", icon: Warehouse },
  { key: "movementHistory" as const, url: "/inventory/movements", icon: ArrowLeftRight },
];

const accountingNav = [
  { key: "chartOfAccounts" as const, url: "/accounting/chart-of-accounts", icon: BookOpen },
  { key: "journalEntries" as const, url: "/accounting/journal", icon: Calculator },
  { key: "invoices" as const, url: "/accounting/invoices", icon: Receipt },
  { key: "fiscalPeriods" as const, url: "/accounting/fiscal-periods", icon: CalendarDays },
  { key: "generalLedger" as const, url: "/accounting/ledger", icon: BookText },
  { key: "fixedAssets" as const, url: "/accounting/fixed-assets", icon: Landmark },
  { key: "deferrals" as const, url: "/accounting/deferrals", icon: Timer },
  { key: "loans" as const, url: "/accounting/loans", icon: Coins },
  { key: "reports" as const, url: "/accounting/reports", icon: BarChart3 },
];

const crmNav = [
  { key: "partners" as const, url: "/crm/partners", icon: Handshake },
  { key: "leads" as const, url: "/crm/leads", icon: Target },
  { key: "opportunities" as const, url: "/crm/opportunities", icon: TrendingUp },
  { key: "quotes" as const, url: "/crm/quotes", icon: FileCheck },
  { key: "salesOrders" as const, url: "/crm/sales-orders", icon: ShoppingCart },
];

const purchasingNav = [
  { key: "purchaseOrders" as const, url: "/purchasing/orders", icon: Truck },
  { key: "goodsReceipts" as const, url: "/purchasing/goods-receipts", icon: ClipboardCheck },
  { key: "supplierInvoices" as const, url: "/purchasing/supplier-invoices", icon: FileInput },
];

const returnsNav = [
  { key: "returns" as const, url: "/returns", icon: RotateCcw },
];

const hrNav = [
  { key: "employees" as const, url: "/hr/employees", icon: UserCheck },
  { key: "contracts" as const, url: "/hr/contracts", icon: FileSignature },
  { key: "departments" as const, url: "/hr/departments", icon: Building },
  { key: "attendance" as const, url: "/hr/attendance", icon: Clock },
  { key: "leaveRequests" as const, url: "/hr/leave-requests", icon: CalendarOff },
  { key: "payroll" as const, url: "/hr/payroll", icon: Banknote },
];

const productionNav = [
  { key: "bomTemplates" as const, url: "/production/bom", icon: Layers },
  { key: "productionOrders" as const, url: "/production/orders", icon: Factory },
];

const documentsNav = [
  { key: "documents" as const, url: "/documents", icon: FolderOpen },
];

const posNav = [
  { key: "posTerminal" as const, url: "/pos/terminal", icon: Monitor },
  { key: "posSessions" as const, url: "/pos/sessions", icon: CreditCard },
];

const settingsNav = [
  { key: "companySettings" as const, url: "/settings", icon: Settings },
  { key: "taxRates" as const, url: "/settings/tax-rates", icon: Percent },
  { key: "users" as const, url: "/settings/users", icon: Users },
  { key: "approvalWorkflows" as const, url: "/settings/approvals", icon: CheckSquare },
  { key: "currencies" as const, url: "/settings/currencies", icon: DollarSign },
  { key: "auditLog" as const, url: "/settings/audit-log", icon: FileText },
  { key: "eventMonitor" as const, url: "/settings/events", icon: Activity },
];

export default function TenantLayout() {
  const { t } = useLanguage();
  const { signOut, user } = useAuth();
  const { canAccess } = usePermissions();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <Sidebar className="border-r border-sidebar-border">
          <div className="p-4 border-b border-sidebar-border">
            <h2 className="text-lg font-bold text-sidebar-foreground">ERP-AI</h2>
          </div>
          <SidebarContent>
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
                          <span>{t(item.key)}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            {canAccess("crm") && (
            <SidebarGroup>
              <SidebarGroupLabel>{t("crm")}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {crmNav.map((item) => (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton asChild>
                        <NavLink to={item.url} className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                          <item.icon className="h-4 w-4" /><span>{t(item.key)}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            )}
            {canAccess("purchasing") && (
            <SidebarGroup>
              <SidebarGroupLabel>{t("purchasing")}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {purchasingNav.map((item) => (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton asChild>
                        <NavLink to={item.url} className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                          <item.icon className="h-4 w-4" /><span>{t(item.key)}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            )}
            {canAccess("returns") && (
            <SidebarGroup>
              <SidebarGroupLabel>{t("returns")}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {returnsNav.map((item) => (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton asChild>
                        <NavLink to={item.url} className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                          <item.icon className="h-4 w-4" /><span>{t(item.key)}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            )}
            {canAccess("hr") && (
            <SidebarGroup>
              <SidebarGroupLabel>{t("hr")}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {hrNav.map((item) => (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton asChild>
                        <NavLink to={item.url} className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                          <item.icon className="h-4 w-4" /><span>{t(item.key)}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            )}
            {canAccess("inventory") && (
            <SidebarGroup>
              <SidebarGroupLabel>{t("inventory")}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {inventoryNav.map((item) => (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton asChild>
                        <NavLink to={item.url} className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                          <item.icon className="h-4 w-4" /><span>{t(item.key)}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            )}
            {canAccess("accounting") && (
            <SidebarGroup>
              <SidebarGroupLabel>{t("accounting")}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {accountingNav.map((item) => (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton asChild>
                        <NavLink to={item.url} className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                          <item.icon className="h-4 w-4" /><span>{t(item.key)}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            )}
            {canAccess("production") && (
            <SidebarGroup>
              <SidebarGroupLabel>{t("production")}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {productionNav.map((item) => (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton asChild>
                        <NavLink to={item.url} className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                          <item.icon className="h-4 w-4" /><span>{t(item.key)}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            )}
            {canAccess("documents") && (
            <SidebarGroup>
              <SidebarGroupLabel>{t("documents")}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {documentsNav.map((item) => (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton asChild>
                        <NavLink to={item.url} className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                          <item.icon className="h-4 w-4" /><span>{t(item.key)}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            )}
            {canAccess("pos") && (
            <SidebarGroup>
              <SidebarGroupLabel>{t("pos")}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {posNav.map((item) => (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton asChild>
                        <NavLink to={item.url} className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                          <item.icon className="h-4 w-4" /><span>{t(item.key)}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            )}
            {canAccess("settings") && (
            <SidebarGroup>
              <SidebarGroupLabel>{t("settings")}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {settingsNav.filter((item) => {
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
                  }).map((item) => (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton asChild>
                        <NavLink to={item.url} end={item.url === "/settings"} className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                          <item.icon className="h-4 w-4" /><span>{t(item.key)}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            )}
          </SidebarContent>
          <div className="mt-auto p-4 border-t border-sidebar-border">
            <Button variant="ghost" size="sm" onClick={handleLogout} className="w-full justify-start gap-2 text-sidebar-foreground">
              <LogOut className="h-4 w-4" />
              {t("logout")}
            </Button>
          </div>
        </Sidebar>

        <div className="flex-1 flex flex-col min-h-screen">
          <header className="h-14 border-b flex items-center justify-between px-4 bg-card">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <NotificationBell />
              <LanguageToggle />
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
