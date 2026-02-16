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
  LayoutDashboard,
  Building2,
  Puzzle,
  Users,
  Activity,
  Plug,
  LogOut,
} from "lucide-react";

const superAdminNav = [
  { key: "dashboard" as const, url: "/super-admin/dashboard", icon: LayoutDashboard },
  { key: "tenants" as const, url: "/super-admin/tenants", icon: Building2 },
  { key: "modules" as const, url: "/super-admin/modules", icon: Puzzle },
  { key: "users" as const, url: "/super-admin/users", icon: Users },
  { key: "monitoring" as const, url: "/super-admin/monitoring", icon: Activity },
  { key: "integrations" as const, url: "/super-admin/integrations", icon: Plug },
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
        <Sidebar className="border-r border-sidebar-border w-64">
          <div className="p-4 border-b border-sidebar-border">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-sidebar-primary/20 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-sidebar-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-sidebar-foreground tracking-tight">ERP-AI</h2>
                <span className="text-[10px] text-sidebar-foreground/50 uppercase tracking-widest">{t("superAdmin")}</span>
              </div>
            </div>
          </div>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-sidebar-foreground/40">Platform</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {superAdminNav.map((item) => (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
                          className="flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm hover:bg-sidebar-accent transition-colors border-l-2 border-transparent"
                          activeClassName="bg-sidebar-accent text-sidebar-primary font-medium border-l-primary"
                        >
                          <item.icon className="h-4 w-4 opacity-70" />
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
            <Button variant="ghost" size="sm" onClick={handleLogout} className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent">
              <LogOut className="h-4 w-4" />
              {t("logout")}
            </Button>
          </div>
        </Sidebar>

        <div className="flex-1 flex flex-col min-h-screen">
          <header className="h-11 border-b border-border/50 flex items-center justify-between px-4 bg-background/80 backdrop-blur-lg sticky top-0 z-10 shadow-sm">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>
                {t("dashboard")} ERP
              </Button>
              <LanguageToggle />
            </div>
          </header>
          <main className="flex-1 p-4 lg:p-6 overflow-auto">
            <div className="max-w-screen-2xl mx-auto">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
