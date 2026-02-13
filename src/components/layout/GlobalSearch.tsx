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
  MapPin, ScanBarcode, RefreshCw, Brain, Layers, Search,
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
    { label: t("partners"), path: "/crm/partners", icon: Handshake, group: "crm", module: "crm" },

    // Sales
    { label: t("quotes"), path: "/sales/quotes", icon: FileCheck, group: "salesModule", module: "sales" },
    { label: t("salesOrders"), path: "/sales/sales-orders", icon: ShoppingCart, group: "salesModule", module: "sales" },
    { label: t("salesChannels"), path: "/sales/sales-channels", icon: Grid3X3, group: "salesModule", module: "sales" },
    { label: t("salespeople"), path: "/sales/salespeople", icon: UserCheck, group: "salesModule", module: "sales" },
    { label: t("salesPerformance"), path: "/sales/sales-performance", icon: BarChart3, group: "salesModule", module: "sales" },
    { label: t("retailPrices"), path: "/sales/retail-prices", icon: Receipt, group: "salesModule", module: "sales" },

    // Purchasing
    { label: t("purchaseOrders"), path: "/purchasing/orders", icon: Truck, group: "purchasing", module: "purchasing" },
    { label: t("goodsReceipts"), path: "/purchasing/goods-receipts", icon: ClipboardCheck, group: "purchasing", module: "purchasing" },
    { label: t("supplierInvoices"), path: "/purchasing/supplier-invoices", icon: FileInput, group: "purchasing", module: "purchasing" },

    // Inventory
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
    { label: t("wmsZones"), path: "/inventory/wms/zones", icon: MapPin, group: "inventory", module: "inventory" },
    { label: t("wmsTasks"), path: "/inventory/wms/tasks", icon: ClipboardCheck, group: "inventory", module: "inventory" },
    { label: t("wmsReceiving"), path: "/inventory/wms/receiving", icon: Truck, group: "inventory", module: "inventory" },
    { label: t("wmsPicking"), path: "/inventory/wms/picking", icon: ScanBarcode, group: "inventory", module: "inventory" },
    { label: t("wmsCycleCounts"), path: "/inventory/wms/cycle-counts", icon: RefreshCw, group: "inventory", module: "inventory" },
    { label: t("wmsSlotting"), path: "/inventory/wms/slotting", icon: Brain, group: "inventory", module: "inventory" },

    // Production
    { label: t("bomTemplates"), path: "/production/bom", icon: Layers, group: "production", module: "production" },
    { label: t("productionOrders"), path: "/production/orders", icon: Factory, group: "production", module: "production" },

    // Accounting
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

    // HR
    { label: t("employees"), path: "/hr/employees", icon: UserCheck, group: "hr", module: "hr" },
    { label: t("contracts"), path: "/hr/contracts", icon: FileSignature, group: "hr", module: "hr" },
    { label: t("departments"), path: "/hr/departments", icon: Building, group: "hr", module: "hr" },
    { label: t("positionTemplates"), path: "/hr/position-templates", icon: Briefcase, group: "hr", module: "hr" },
    { label: t("workLogs"), path: "/hr/work-logs", icon: Clock, group: "hr", module: "hr" },
    { label: t("overtimeHours"), path: "/hr/overtime", icon: Timer, group: "hr", module: "hr" },
    { label: t("nightWork"), path: "/hr/night-work", icon: Moon, group: "hr", module: "hr" },
    { label: t("annualLeaveBalance"), path: "/hr/annual-leave", icon: CalendarOff, group: "hr", module: "hr" },
    { label: t("holidays"), path: "/hr/holidays", icon: Calendar, group: "hr", module: "hr" },
    { label: t("attendance"), path: "/hr/attendance", icon: Clock, group: "hr", module: "hr" },
    { label: t("leaveRequests"), path: "/hr/leave-requests", icon: CalendarOff, group: "hr", module: "hr" },
    { label: t("deductionsModule"), path: "/hr/deductions", icon: Coins, group: "hr", module: "hr" },
    { label: t("allowance"), path: "/hr/allowances", icon: Banknote, group: "hr", module: "hr" },
    { label: t("salaryHistory"), path: "/hr/salaries", icon: Banknote, group: "hr", module: "hr" },
    { label: t("externalWorkers"), path: "/hr/external-workers", icon: Users, group: "hr", module: "hr" },
    { label: t("insuranceRecords"), path: "/hr/insurance", icon: Shield, group: "hr", module: "hr" },
    { label: t("payroll"), path: "/hr/payroll", icon: Banknote, group: "hr", module: "hr" },
    { label: t("eBolovanje"), path: "/hr/ebolovanje", icon: Heart, group: "hr", module: "hr" },
    { label: t("hrReports"), path: "/hr/reports", icon: BarChart3, group: "hr", module: "hr" },

    // POS
    { label: t("posTerminal"), path: "/pos/terminal", icon: Monitor, group: "pos", module: "pos" },
    { label: t("posSessions"), path: "/pos/sessions", icon: CreditCard, group: "pos", module: "pos" },
    { label: t("fiscalDevices"), path: "/pos/fiscal-devices", icon: Receipt, group: "pos", module: "pos" },
    { label: t("dailyReport"), path: "/pos/daily-report", icon: FileText, group: "pos", module: "pos" },

    // Web Sales
    { label: t("webSettings"), path: "/web/settings", icon: Globe, group: "webSales", module: "web" },
    { label: t("webPrices"), path: "/web/prices", icon: Receipt, group: "webSales", module: "web" },

    // Documents
    { label: t("dmsRegistry"), path: "/documents", icon: FolderOpen, group: "documents", module: "documents" },
    { label: t("dmsArchiveBook"), path: "/documents/archive-book", icon: BookOpen, group: "documents", module: "documents" },
    { label: t("dmsArchiving"), path: "/documents/archiving", icon: FileText, group: "documents", module: "documents" },
    { label: t("dmsProjects"), path: "/documents/projects", icon: Layers, group: "documents", module: "documents" },
    { label: t("dmsBrowser"), path: "/documents/browser", icon: Search, group: "documents", module: "documents" },
    { label: t("dmsReports"), path: "/documents/reports", icon: BarChart3, group: "documents", module: "documents" },
    { label: t("dmsSettings"), path: "/documents/settings", icon: Settings, group: "documents", module: "documents" },

    // Returns
    { label: t("returns"), path: "/returns", icon: RotateCcw, group: "returns", module: "returns" },

    // Settings
    { label: t("companySettings"), path: "/settings", icon: Settings, group: "settings", module: "settings" },
    { label: t("taxRates"), path: "/settings/tax-rates", icon: Percent, group: "settings", module: "settings" },
    { label: t("users"), path: "/settings/users", icon: Users, group: "settings", module: "settings" },
    { label: t("approvalWorkflows"), path: "/settings/approvals", icon: CheckSquare, group: "settings", module: "settings" },
    { label: t("pendingApprovalsPage"), path: "/settings/pending-approvals", icon: ClipboardCheck, group: "settings", module: "settings" },
    { label: t("currencies"), path: "/settings/currencies", icon: DollarSign, group: "settings", module: "settings" },
    { label: t("integrations"), path: "/settings/integrations", icon: Plug, group: "settings", module: "settings" },
    { label: t("auditLog"), path: "/settings/audit-log", icon: FileText, group: "settings", module: "settings" },
    { label: t("eventMonitor"), path: "/settings/events", icon: Activity, group: "settings", module: "settings" },
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
