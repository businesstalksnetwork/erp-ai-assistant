import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Layers } from "lucide-react";
import { fmtNum } from "@/lib/utils";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/shared/ResponsiveTable";

export default function InventoryCostLayers() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const [productFilter, setProductFilter] = useState("__all__");
  const [warehouseFilter, setWarehouseFilter] = useState("__all__");

  const { data: layers = [] } = useQuery({
    queryKey: ["cost-layers", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_cost_layers")
        .select("*, products(name, sku), warehouses(name)")
        .eq("tenant_id", tenantId!)
        .gt("quantity_remaining", 0)
        .order("layer_date", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-list-cl", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name").eq("tenant_id", tenantId!).eq("is_active", true).order("name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses-cl", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("warehouses").select("id, name").eq("tenant_id", tenantId!).eq("is_active", true).order("name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const filtered = layers.filter(l => {
    if (productFilter !== "__all__" && l.product_id !== productFilter) return false;
    if (warehouseFilter !== "__all__" && l.warehouse_id !== warehouseFilter) return false;
    return true;
  });

  const totalValue = filtered.reduce((s, l) => s + Number(l.quantity_remaining) * Number(l.unit_cost), 0);

  const columns: ResponsiveColumn<any>[] = [
    { key: "product", label: t("product"), primary: true, sortable: true, sortValue: (l) => (l.products as any)?.name || "", render: (l) => <span className="font-medium">{(l.products as any)?.name}</span> },
    { key: "warehouse", label: t("warehouse"), hideOnMobile: true, sortable: true, sortValue: (l) => (l.warehouses as any)?.name || "", render: (l) => (l.warehouses as any)?.name },
    { key: "layerDate", label: t("layerDate"), sortable: true, sortValue: (l) => l.layer_date, render: (l) => l.layer_date },
    { key: "qtyRemaining", label: t("qtyRemaining"), align: "right" as const, sortable: true, sortValue: (l) => Number(l.quantity_remaining), render: (l) => <span className="font-mono">{fmtNum(Number(l.quantity_remaining))}</span> },
    { key: "unitCost", label: t("unitCost"), align: "right" as const, sortable: true, sortValue: (l) => Number(l.unit_cost), render: (l) => <span className="font-mono">{fmtNum(Number(l.unit_cost))}</span> },
    { key: "totalValue", label: t("totalValue"), align: "right" as const, sortable: true, sortValue: (l) => Number(l.quantity_remaining) * Number(l.unit_cost), render: (l) => <span className="font-mono">{fmtNum(Number(l.quantity_remaining) * Number(l.unit_cost))}</span> },
    { key: "reference", label: t("reference"), hideOnMobile: true, render: (l) => l.reference || "—" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("costLayers")}</h1>
        <Badge variant="outline" className="text-base px-3 py-1">
          {t("totalValue")}: {fmtNum(totalValue)} RSD
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <div className="flex gap-4">
            <div className="w-56">
              <Select value={productFilter} onValueChange={setProductFilter}>
                <SelectTrigger><SelectValue placeholder={t("product")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t("allTypes")}</SelectItem>
                  {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                <SelectTrigger><SelectValue placeholder={t("warehouse")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t("allWarehouses")}</SelectItem>
                  {warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveTable
            data={filtered}
            columns={columns}
            keyExtractor={(l) => l.id}
            emptyMessage={t("noResults")}
            enableExport
            exportFilename="cost-layers"
            enableColumnToggle
          />
        </CardContent>
      </Card>
    </div>
  );
}
