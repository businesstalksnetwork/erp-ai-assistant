import { useLanguage } from "@/i18n/LanguageContext";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { usePermissions } from "@/hooks/usePermissions";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingCart, Package, AlertCircle, Download, Sparkles, DollarSign } from "lucide-react";
import { exportToCsv } from "@/lib/exportCsv";
import { fmtNumCompact, fmtNumAuto } from "@/lib/utils";

import { FiscalReceiptStatusWidget } from "@/components/dashboard/FiscalReceiptStatusWidget";
import { WelcomeHeader } from "@/components/dashboard/WelcomeHeader";
import { MobileActionMenu } from "@/components/shared/MobileActionMenu";

export default function StoreDashboard() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { canAccess } = usePermissions();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const { data: todaySales = { count: 0, total: 0 }, isLoading: salesLoading } = useQuery({
    queryKey: ["dashboard-today-sales", tenantId],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase.from("invoices").select("total").eq("tenant_id", tenantId!).eq("invoice_type", "sales").gte("invoice_date", today);
      const rows = data || [];
      return { count: rows.length, total: rows.reduce((s, r) => s + Number(r.total || 0), 0) };
    },
    enabled: !!tenantId, staleTime: 1000 * 60 * 2,
  });

  const { data: lowStockCount = 0 } = useQuery({
    queryKey: ["dashboard-low-stock", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("inventory_stock").select("id, quantity_on_hand, min_stock_level").eq("tenant_id", tenantId!).gt("min_stock_level", 0);
      if (!data) return 0;
      return data.filter((s) => Number(s.quantity_on_hand) < Number(s.min_stock_level)).length;
    },
    enabled: !!tenantId, staleTime: 1000 * 60 * 2,
  });

  const fmt = isMobile ? fmtNumCompact : fmtNumAuto;

  const kpis = [
    { label: t("todaySalesCount"), value: String(todaySales.count), icon: ShoppingCart, borderColor: "border-t-accent" },
    { label: t("todaySalesTotal"), value: `${fmt(todaySales.total)} RSD`, icon: DollarSign, borderColor: "border-t-primary" },
    { label: t("lowStockAlert"), value: String(lowStockCount), icon: lowStockCount > 0 ? AlertCircle : Package, borderColor: lowStockCount > 0 ? "border-t-destructive" : "border-t-muted" },
  ];

  const exportAction = () => {
    exportToCsv(
      [{ metric: t("todaySalesCount"), value: todaySales.count }, { metric: t("todaySalesTotal"), value: todaySales.total }, { metric: t("lowStockAlert"), value: lowStockCount }],
      [{ key: "metric", label: "Metric" }, { key: "value", label: "Value", formatter: (v) => String(v) }],
      "store_dashboard_summary"
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <WelcomeHeader />
        {isMobile ? (
          <MobileActionMenu actions={[{ label: t("exportCsv"), onClick: exportAction }]} />
        ) : (
          <Button variant="outline" size="sm" onClick={exportAction}><Download className="h-4 w-4 mr-2" />{t("exportCsv")}</Button>
        )}
      </div>

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        {salesLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="border-t-2 border-t-muted">
                <CardHeader className="flex flex-row items-center justify-between pb-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-8 w-8 rounded-md" /></CardHeader>
                <CardContent className="pt-0"><Skeleton className="h-7 w-32" /></CardContent>
              </Card>
            ))
          : kpis.map((kpi) => (
              <Card key={kpi.label} className={`border-t-2 ${kpi.borderColor}`}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{kpi.label}</CardTitle>
                  <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center"><kpi.icon className="h-4 w-4 text-muted-foreground" /></div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-base lg:text-xl xl:text-2xl font-bold tabular-nums text-foreground whitespace-nowrap">{kpi.value}</div>
                </CardContent>
              </Card>
            ))}
      </div>

      {tenantId && canAccess("pos") && <FiscalReceiptStatusWidget tenantId={tenantId} />}

      {lowStockCount > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />{t("lowStockAlert")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{lowStockCount} {t("lowStockAlert")}</span>
              <Button size="sm" variant="ghost" onClick={() => navigate("/inventory/stock")}>{t("view")}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-muted-foreground" />{t("quickActions")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`flex gap-2 ${isMobile ? "overflow-x-auto pb-2" : "flex-wrap"}`}>
            {canAccess("pos") && (
              <Button variant="outline" size="sm" className="whitespace-nowrap" onClick={() => navigate("/pos")}>
                <ShoppingCart className="h-4 w-4 mr-1.5" /> {t("pos")}
              </Button>
            )}
            <Button variant="outline" size="sm" className="whitespace-nowrap" onClick={() => navigate("/inventory/stock")}>
              <Package className="h-4 w-4 mr-1.5" /> {t("inventory")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
