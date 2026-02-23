import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { LanguageToggle } from "@/components/LanguageToggle";
import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
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
  LayoutDashboard, Building2, Puzzle, Users, Activity, Plug, LogOut, BarChart3,
} from "lucide-react";

const superAdminNav = [
  { key: "dashboard" as const, url: "/super-admin/dashboard", icon: LayoutDashboard },
  { key: "tenants" as const, url: "/super-admin/tenants", icon: Building2 },
  { key: "modules" as const, url: "/super-admin/modules", icon: Puzzle },
  { key: "users" as const, url: "/super-admin/users", icon: Users },
  { key: "monitoring" as const, url: "/super-admin/monitoring", icon: Activity },
  { key: "integrations" as const, url: "/super-admin/integrations", icon: Plug },
  { key: "analytics" as const, url: "/super-admin/analytics", icon: BarChart3 },
];

export default function SuperAdminLayout() {
  const { t } = useLanguage();
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <Sidebar className="border-r border-sidebar-border w-60">
          <div className="p-4 border-b border-sidebar-border/60">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-sidebar-primary/15 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-sidebar-primary" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-sidebar-foreground tracking-tight">ERP-AI</h2>
                <span className="text-[10px] text-sidebar-foreground/40">{t("superAdmin")}</span>
              </div>
            </div>
          </div>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel className="text-[11px] font-medium tracking-wide text-sidebar-foreground/40">Platform</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {superAdminNav.map((item) => (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
                          className="flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                          activeClassName="bg-sidebar-primary/10 text-sidebar-primary font-medium"
                        >
                          <item.icon className="h-4 w-4 opacity-50" />
                          <span>{t(item.key)}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <div className="mt-auto p-3 border-t border-sidebar-border/60">
            <Button variant="ghost" size="sm" onClick={handleLogout} className="w-full justify-start gap-2 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent">
              <LogOut className="h-4 w-4" />
              {t("logout")}
            </Button>
          </div>
        </Sidebar>

        <div className="flex-1 flex flex-col min-h-screen">
          <header className="h-12 border-b border-border flex items-center justify-between px-4 bg-background sticky top-0 z-10">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>
                {t("dashboard")} ERP
              </Button>
              <LanguageToggle />
            </div>
          </header>
          <main className="flex-1 p-4 lg:p-6 overflow-auto bg-background">
            <div className="max-w-screen-2xl mx-auto">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
