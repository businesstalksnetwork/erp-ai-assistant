import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
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
  { key: "reports" as const, url: "/accounting/reports", icon: BarChart3 },
];

const crmNav = [
  { key: "partners" as const, url: "/crm/partners", icon: Handshake },
];

const hrNav = [
  { key: "employees" as const, url: "/hr/employees", icon: UserCheck },
  { key: "contracts" as const, url: "/hr/contracts", icon: FileSignature },
  { key: "departments" as const, url: "/hr/departments", icon: Building },
  { key: "attendance" as const, url: "/hr/attendance", icon: Clock },
  { key: "leaveRequests" as const, url: "/hr/leave-requests", icon: CalendarOff },
  { key: "payroll" as const, url: "/hr/payroll", icon: Banknote },
];

const settingsNav = [
  { key: "companySettings" as const, url: "/settings", icon: Settings },
  { key: "taxRates" as const, url: "/settings/tax-rates", icon: Percent },
  { key: "users" as const, url: "/settings/users", icon: Users },
  { key: "auditLog" as const, url: "/settings/audit-log", icon: FileText },
];

export default function TenantLayout() {
  const { t } = useLanguage();
  const { signOut, user } = useAuth();
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
            <SidebarGroup>
              <SidebarGroupLabel>{t("crm")}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {crmNav.map((item) => (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
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
            <SidebarGroup>
              <SidebarGroupLabel>{t("hr")}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {hrNav.map((item) => (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
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
            <SidebarGroup>
              <SidebarGroupLabel>{t("inventory")}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {inventoryNav.map((item) => (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
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
            <SidebarGroup>
              <SidebarGroupLabel>{t("accounting")}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {accountingNav.map((item) => (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
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
            <SidebarGroup>
              <SidebarGroupLabel>{t("settings")}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {settingsNav.map((item) => (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
                          end={item.url === "/settings"}
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
              <LanguageToggle />
            </div>
          </header>
          <main className="flex-1 p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
