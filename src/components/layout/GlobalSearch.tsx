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
  Settings, BarChart3, Handshake, FileCheck, ShoppingCart, Truck, RotateCcw,
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
    { label: t("dashboard"), path: "/dashboard", icon: LayoutDashboard, group: "navigation" },
    // CRM
    { label: `${t("crm")} — ${t("dashboard")}`, path: "/crm", icon: LayoutDashboard, group: "crm", module: "crm" },
    { label: t("contacts"), path: "/crm/contacts", icon: Users, group: "crm", module: "crm" },
    { label: t("companies"), path: "/crm/companies", icon: Building, group: "crm", module: "crm" },
    { label: t("leads"), path: "/crm/leads", icon: Target, group: "crm", module: "crm" },
    { label: t("opportunities"), path: "/crm/opportunities", icon: TrendingUp, group: "crm", module: "crm" },
    { label: t("meetings"), path: "/crm/meetings", icon: CalendarDays, group: "crm", module: "crm" },
    { label: t("partners"), path: "/crm/partners", icon: Handshake, group: "crm", module: "crm" },
    { label: t("quotes"), path: "/crm/quotes", icon: FileCheck, group: "crm", module: "crm" },
    { label: t("salesOrders"), path: "/crm/sales-orders", icon: ShoppingCart, group: "crm", module: "crm" },
    // Accounting
    { label: t("chartOfAccounts"), path: "/accounting/chart-of-accounts", icon: BookOpen, group: "accounting", module: "accounting" },
    { label: t("journalEntries"), path: "/accounting/journal", icon: Calculator, group: "accounting", module: "accounting" },
    { label: t("invoices"), path: "/accounting/invoices", icon: Receipt, group: "accounting", module: "accounting" },
    { label: t("reports"), path: "/accounting/reports", icon: BarChart3, group: "accounting", module: "accounting" },
    // Inventory
    { label: t("products"), path: "/inventory/products", icon: Package, group: "inventory", module: "inventory" },
    { label: t("stockOverview"), path: "/inventory/stock", icon: Warehouse, group: "inventory", module: "inventory" },
    // HR
    { label: t("employees"), path: "/hr/employees", icon: UserCheck, group: "hr", module: "hr" },
    { label: t("payroll"), path: "/hr/payroll", icon: Banknote, group: "hr", module: "hr" },
    // Purchasing
    { label: t("purchaseOrders"), path: "/purchasing/orders", icon: Truck, group: "purchasing", module: "purchasing" },
    // Production
    { label: t("productionOrders"), path: "/production/orders", icon: Factory, group: "production", module: "production" },
    // Documents
    { label: t("dmsRegistry"), path: "/documents", icon: FolderOpen, group: "documents", module: "documents" },
    // POS
    { label: t("posTerminal"), path: "/pos/terminal", icon: Monitor, group: "pos", module: "pos" },
    // Returns
    { label: t("returns"), path: "/returns", icon: RotateCcw, group: "returns", module: "returns" },
    // Settings
    { label: t("companySettings"), path: "/settings", icon: Settings, group: "settings", module: "settings" },
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
