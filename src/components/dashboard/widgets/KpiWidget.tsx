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
  ShoppingCart, Package, AlertCircle, Briefcase, Clock, Factory, Warehouse,
  Receipt, CreditCard, CheckCircle, UserPlus, Target, Store, BarChart3, CalendarDays
} from "lucide-react";

const ICON_MAP: Record<string, any> = {
  revenue: TrendingUp,
  revenue_yesterday: TrendingUp,
  revenue_7days: TrendingUp,
  revenue_30days: TrendingUp,
  expenses: TrendingDown,
  profit: DollarSign,
  cash_balance: Wallet,
  invoices: FileText,
  invoices_issued: Receipt,
  invoices_unpaid: AlertCircle,
  invoices_overdue: AlertCircle,
  invoices_paid: CheckCircle,
  employees: Users,
  outstanding: AlertCircle,
  opportunities: Briefcase,
  new_customers: UserPlus,
  active_leads: Target,
  leave_pending: Clock,
  leave_balance: CalendarDays,
  attendance: Users,
  today_sales: ShoppingCart,
  transactions: ShoppingCart,
  low_stock: Package,
  production: Factory,
  inventory: Warehouse,
  pending_receipts: Package,
  purchase_orders: FileText,
  retail_revenue: Store,
  retail_revenue_yesterday: Store,
  retail_revenue_7days: Store,
  retail_transactions: CreditCard,
  pos_sessions_active: Store,
  avg_basket: BarChart3,
  warehouse_count: Warehouse,
  products_active: Package,
};

const BORDER_MAP: Record<string, string> = {
  revenue: "border-t-accent",
  revenue_yesterday: "border-t-accent",
  revenue_7days: "border-t-accent",
  revenue_30days: "border-t-accent",
  expenses: "border-t-destructive",
  profit: "border-t-primary",
  cash_balance: "border-t-primary",
  invoices: "border-t-primary",
  invoices_issued: "border-t-primary",
  invoices_unpaid: "border-t-destructive",
  invoices_overdue: "border-t-destructive",
  invoices_paid: "border-t-accent",
  employees: "border-t-accent",
  outstanding: "border-t-destructive",
  today_sales: "border-t-accent",
  low_stock: "border-t-destructive",
  retail_revenue: "border-t-accent",
  retail_revenue_yesterday: "border-t-accent",
  retail_revenue_7days: "border-t-accent",
  retail_transactions: "border-t-primary",
  pos_sessions_active: "border-t-primary",
  avg_basket: "border-t-primary",
  default: "border-t-muted",
};

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function monthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

interface Props {
  metricKey: string;
  locationId?: string;
}

export function KpiWidget({ metricKey, locationId }: Props) {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const isMobile = useIsMobile();
  const fmt = isMobile ? fmtNumCompact : fmtNumAuto;

  // Use shared query key for KPI summary metrics so React Query deduplicates
  const kpiSummaryMetrics = ["revenue", "expenses", "profit", "cash_balance"];
  const queryKey = kpiSummaryMetrics.includes(metricKey)
    ? ["dashboard-kpi-summary", tenantId, metricKey]
    : ["kpi-widget", metricKey, tenantId, locationId];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];

      switch (metricKey) {
        case "revenue":
        case "expenses":
        case "profit":
        case "cash_balance": {
          // All share the same RPC — React Query deduplicates by queryKey
          const { data: d } = await supabase.rpc("dashboard_kpi_summary", { _tenant_id: tenantId! });
          const row = (d as any)?.[0] ?? {};
          if (metricKey === "profit") {
            return { value: Number(row.revenue ?? 0) - Number(row.expenses ?? 0), suffix: "RSD" };
          }
          if (metricKey === "cash_balance") {
            return { value: Number(row.cash_balance ?? row.revenue ?? 0) - Number(row.expenses ?? 0), suffix: "RSD" };
          }
          return { value: Number(row[metricKey] ?? 0), suffix: "RSD" };
        }
        case "revenue_yesterday": {
          const yesterday = daysAgo(1);
          const { data: inv } = await supabase.from("invoices").select("total").eq("tenant_id", tenantId!).eq("invoice_type", "sales").gte("invoice_date", yesterday).lt("invoice_date", today);
          const total = (inv || []).reduce((s, r) => s + Number(r.total || 0), 0);
          return { value: total, suffix: "RSD" };
        }
        case "revenue_7days": {
          const from = daysAgo(7);
          const { data: inv } = await supabase.from("invoices").select("total").eq("tenant_id", tenantId!).eq("invoice_type", "sales").gte("invoice_date", from);
          const total = (inv || []).reduce((s, r) => s + Number(r.total || 0), 0);
          return { value: total, suffix: "RSD" };
        }
        case "revenue_30days": {
          const from = daysAgo(30);
          const { data: inv } = await supabase.from("invoices").select("total").eq("tenant_id", tenantId!).eq("invoice_type", "sales").gte("invoice_date", from);
          const total = (inv || []).reduce((s, r) => s + Number(r.total || 0), 0);
          return { value: total, suffix: "RSD" };
        }
        case "leave_balance": {
          const year = new Date().getFullYear();
          const { data: bal } = await supabase
            .from("annual_leave_balances")
            .select("entitled_days, used_days, carried_over_days, pending_days")
            .eq("tenant_id", tenantId!)
            .eq("year", year);
          if (!bal || bal.length === 0) return { value: 0 };
          const totals = bal.reduce(
            (acc, r) => ({
              entitled: acc.entitled + Number(r.entitled_days || 0) + Number(r.carried_over_days || 0),
              used: acc.used + Number(r.used_days || 0) + Number(r.pending_days || 0),
            }),
            { entitled: 0, used: 0 }
          );
          return { value: totals.entitled - totals.used };
        }
        case "invoices": {
          const { count } = await supabase.from("invoices").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!);
          return { value: count || 0 };
        }
        case "invoices_issued": {
          const { count } = await supabase.from("invoices").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!).eq("status", "sent");
          return { value: count || 0 };
        }
        case "invoices_unpaid": {
          const { count } = await supabase.from("invoices").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!).in("status", ["sent", "overdue"]);
          return { value: count || 0 };
        }
        case "invoices_overdue": {
          const { count } = await supabase.from("invoices").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!).eq("status", "overdue");
          return { value: count || 0 };
        }
        case "invoices_paid": {
          const { count } = await supabase.from("invoices").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!).eq("status", "paid");
          return { value: count || 0 };
        }
        case "employees": {
          const { count } = await supabase.from("employees").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!).eq("status", "active");
          return { value: count || 0 };
        }
        case "outstanding": {
          const { count } = await supabase.from("invoices").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!).in("status", ["draft", "sent"]).lt("due_date", today);
          return { value: count || 0 };
        }
        case "opportunities": {
          const { count } = await supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!).neq("stage", "won").neq("stage", "lost");
          return { value: count || 0 };
        }
        case "new_customers": {
          const ms = monthStart();
          const { count } = await supabase.from("partners").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!).eq("type", "customer").gte("created_at", ms);
          return { value: count || 0 };
        }
        case "active_leads": {
          const { count } = await supabase.from("leads").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!).neq("status", "converted").neq("status", "lost");
          return { value: count || 0 };
        }
        case "leave_pending": {
          const { count } = await supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!).eq("status", "pending");
          return { value: count || 0 };
        }
        case "attendance": {
          try {
            const { count } = await supabase.from("attendance_records").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!).eq("date", today).eq("status", "present");
            return { value: count || 0 };
          } catch {
            return { value: 0 };
          }
        }
        case "today_sales": {
          const { data: inv } = await supabase.from("invoices").select("total").eq("tenant_id", tenantId!).eq("invoice_type", "sales").gte("invoice_date", today);
          const total = (inv || []).reduce((s, r) => s + Number(r.total || 0), 0);
          return { value: total, suffix: "RSD" };
        }
        case "transactions": {
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
        case "purchase_orders": {
          const { count } = await supabase.from("purchase_orders").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!).in("status", ["draft", "confirmed"]);
          return { value: count || 0 };
        }
        // ── Retail / POS (with optional location filter) ──
        case "retail_revenue": {
          let q = supabase.from("pos_transactions").select("total").eq("tenant_id", tenantId!).eq("receipt_type", "sale").gte("created_at", today);
          if (locationId) q = q.eq("location_id", locationId);
          const { data: txns } = await q;
          const total = (txns || []).reduce((s, r) => s + Number(r.total || 0), 0);
          return { value: total, suffix: "RSD" };
        }
        case "retail_revenue_yesterday": {
          const yesterday = daysAgo(1);
          let q = supabase.from("pos_transactions").select("total").eq("tenant_id", tenantId!).eq("receipt_type", "sale").gte("created_at", yesterday).lt("created_at", today);
          if (locationId) q = q.eq("location_id", locationId);
          const { data: txns } = await q;
          const total = (txns || []).reduce((s, r) => s + Number(r.total || 0), 0);
          return { value: total, suffix: "RSD" };
        }
        case "retail_revenue_7days": {
          const from = daysAgo(7);
          let q = supabase.from("pos_transactions").select("total").eq("tenant_id", tenantId!).eq("receipt_type", "sale").gte("created_at", from);
          if (locationId) q = q.eq("location_id", locationId);
          const { data: txns } = await q;
          const total = (txns || []).reduce((s, r) => s + Number(r.total || 0), 0);
          return { value: total, suffix: "RSD" };
        }
        case "retail_transactions": {
          let q = supabase.from("pos_transactions").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!).eq("receipt_type", "sale").gte("created_at", today);
          if (locationId) q = q.eq("location_id", locationId);
          const { count } = await q;
          return { value: count || 0 };
        }
        case "pos_sessions_active": {
          let q = supabase.from("pos_sessions").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!).filter("closed_at", "is", "null");
          if (locationId) q = q.eq("location_id", locationId);
          const { count } = await q;
          return { value: count || 0 };
        }
        case "avg_basket": {
          let q = supabase.from("pos_transactions").select("total").eq("tenant_id", tenantId!).eq("receipt_type", "sale").gte("created_at", today);
          if (locationId) q = q.eq("location_id", locationId);
          const { data: txns } = await q;
          if (!txns || txns.length === 0) return { value: 0, suffix: "RSD" };
          const avg = txns.reduce((s, r) => s + Number(r.total || 0), 0) / txns.length;
          return { value: Math.round(avg), suffix: "RSD" };
        }
        case "warehouse_count": {
          const { count } = await supabase.from("warehouses").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!).eq("is_active", true);
          return { value: count || 0 };
        }
        case "products_active": {
          const { count } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!).eq("is_active", true);
          return { value: count || 0 };
        }
        default:
          return { value: 0 };
      }
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 3,
  });

  // Fetch location name if filtered
  const { data: locationName } = useQuery({
    queryKey: ["location-name", locationId],
    queryFn: async () => {
      const { data } = await supabase.from("locations").select("name").eq("id", locationId!).single();
      return data?.name || "";
    },
    enabled: !!locationId,
    staleTime: 1000 * 60 * 30,
  });

  const Icon = ICON_MAP[metricKey] || DollarSign;
  const border = BORDER_MAP[metricKey] || BORDER_MAP.default;
  const baseLabel = t(metricKey as any) || metricKey;
  const label = locationName ? `${baseLabel} · ${locationName}` : baseLabel;

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
