import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Layers } from "lucide-react";
import { fmtNum } from "@/lib/utils";

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
  

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("costLayers")}</h1>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("product")}</TableHead>
                <TableHead>{t("warehouse")}</TableHead>
                <TableHead>{t("layerDate")}</TableHead>
                <TableHead className="text-right">{t("qtyRemaining")}</TableHead>
                <TableHead className="text-right">{t("unitCost")}</TableHead>
                <TableHead className="text-right">{t("totalValue")}</TableHead>
                <TableHead>{t("reference")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(l => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{(l.products as any)?.name}</TableCell>
                  <TableCell>{(l.warehouses as any)?.name}</TableCell>
                  <TableCell>{l.layer_date}</TableCell>
                  <TableCell className="text-right font-mono">{fmtNum(Number(l.quantity_remaining))}</TableCell>
                  <TableCell className="text-right font-mono">{fmtNum(Number(l.unit_cost))}</TableCell>
                  <TableCell className="text-right font-mono">{fmtNum(Number(l.quantity_remaining) * Number(l.unit_cost))}</TableCell>
                  <TableCell>{l.reference || "—"}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
