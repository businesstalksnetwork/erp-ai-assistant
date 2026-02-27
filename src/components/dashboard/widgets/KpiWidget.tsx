import { useLanguage } from "@/i18n/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtNumCompact, fmtNumAuto } from "@/lib/utils";
import {
  TrendingUp, TrendingDown, DollarSign, Wallet, FileText, Users,
  ShoppingCart, Package, AlertCircle, Briefcase, Clock, Factory, Warehouse
} from "lucide-react";

const ICON_MAP: Record<string, any> = {
  revenue: TrendingUp,
  expenses: TrendingDown,
  profit: DollarSign,
  cash_balance: Wallet,
  invoices: FileText,
  employees: Users,
  outstanding: AlertCircle,
  opportunities: Briefcase,
  leave_pending: Clock,
  attendance: Users,
  today_sales: ShoppingCart,
  transactions: ShoppingCart,
  low_stock: Package,
  production: Factory,
  inventory: Warehouse,
  pending_receipts: Package,
};

const BORDER_MAP: Record<string, string> = {
  revenue: "border-t-accent",
  expenses: "border-t-destructive",
  profit: "border-t-primary",
  invoices: "border-t-primary",
  employees: "border-t-accent",
  outstanding: "border-t-destructive",
  today_sales: "border-t-accent",
  low_stock: "border-t-destructive",
  default: "border-t-muted",
};

interface Props {
  metricKey: string; // e.g. "revenue", "expenses", etc.
}

export function KpiWidget({ metricKey }: Props) {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const isMobile = useIsMobile();
  const fmt = isMobile ? fmtNumCompact : fmtNumAuto;

  const { data, isLoading } = useQuery({
    queryKey: ["kpi-widget", metricKey, tenantId],
    queryFn: async () => {
      switch (metricKey) {
        case "revenue":
        case "expenses": {
          const { data: d } = await supabase.rpc("dashboard_kpi_summary", { _tenant_id: tenantId! });
          const row = (d as any)?.[0] ?? {};
          return { value: Number(row[metricKey] ?? 0), suffix: "RSD" };
        }
        case "invoices": {
          const { count } = await supabase.from("invoices").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!);
          return { value: count || 0 };
        }
        case "employees": {
          const { count } = await supabase.from("employees").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!).eq("status", "active");
          return { value: count || 0 };
        }
        case "outstanding": {
          const today = new Date().toISOString().split("T")[0];
          const { count } = await supabase.from("invoices").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!).in("status", ["draft", "sent"]).lt("due_date", today);
          return { value: count || 0 };
        }
        case "opportunities": {
          const { count } = await supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!).neq("stage", "won").neq("stage", "lost");
          return { value: count || 0 };
        }
        case "leave_pending": {
          const { count } = await supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!).eq("status", "pending");
          return { value: count || 0 };
        }
        case "attendance": {
          const today = new Date().toISOString().split("T")[0];
          const { count } = await supabase.from("attendance_records").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!).eq("date", today).eq("status", "present");
          return { value: count || 0 };
        }
        case "today_sales": {
          const today = new Date().toISOString().split("T")[0];
          const { data: inv } = await supabase.from("invoices").select("total").eq("tenant_id", tenantId!).eq("invoice_type", "sales").gte("invoice_date", today);
          const total = (inv || []).reduce((s, r) => s + Number(r.total || 0), 0);
          return { value: total, suffix: "RSD" };
        }
        case "transactions": {
          const today = new Date().toISOString().split("T")[0];
          const { count } = await supabase.from("invoices").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!).eq("invoice_type", "sales").gte("invoice_date", today);
          return { value: count || 0 };
        }
        case "low_stock": {
          const { data: d } = await supabase.from("inventory_stock").select("id, quantity_on_hand, min_stock_level").eq("tenant_id", tenantId!).gt("min_stock_level", 0);
          const cnt = (d || []).filter((s) => Number(s.quantity_on_hand) < Number(s.min_stock_level)).length;
          return { value: cnt };
        }
        case "production": {
          const { count } = await supabase.from("production_orders").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!).eq("status", "in_progress");
          return { value: count || 0 };
        }
        case "inventory": {
          const { count } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!).eq("is_active", true);
          return { value: count || 0 };
        }
        case "pending_receipts": {
          const { count } = await supabase.from("purchase_orders").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!).eq("status", "confirmed");
          return { value: count || 0 };
        }
        default:
          return { value: 0 };
      }
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 3,
  });

  const Icon = ICON_MAP[metricKey] || DollarSign;
  const border = BORDER_MAP[metricKey] || BORDER_MAP.default;
  const label = t(metricKey as any) || metricKey;

  if (isLoading) {
    return (
      <Card className={`border-t-2 border-t-muted h-full`}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <Skeleton className="h-3 w-20" /><Skeleton className="h-8 w-8 rounded-md" />
        </CardHeader>
        <CardContent className="pt-0"><Skeleton className="h-7 w-32" /></CardContent>
      </Card>
    );
  }

  const displayValue = data?.suffix
    ? `${fmt(data.value)} ${data.suffix}`
    : String(data?.value ?? 0);

  return (
    <Card className={`border-t-2 ${border} h-full`}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</CardTitle>
        <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-base lg:text-xl xl:text-2xl font-bold tabular-nums text-foreground whitespace-nowrap">
          {displayValue}
        </div>
      </CardContent>
    </Card>
  );
}
