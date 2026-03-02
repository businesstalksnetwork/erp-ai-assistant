import { lazy, Suspense, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Search, AlertTriangle, Warehouse, Loader2 } from "lucide-react";
import { ExportButton } from "@/components/ExportButton";
import { AiModuleInsights } from "@/components/shared/AiModuleInsights";
import { AiAnalyticsNarrative } from "@/components/ai/AiAnalyticsNarrative";
import { PageHeader } from "@/components/shared/PageHeader";
import { MobileFilterBar } from "@/components/shared/MobileFilterBar";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/shared/ResponsiveTable";

const InventoryHealthContent = lazy(() => import("@/pages/tenant/InventoryHealth"));
const Loading = () => <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

export default function InventoryStock() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlFilter = searchParams.get("filter");
  const activeTab = searchParams.get("tab") || "stock";
  const [search, setSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("__all__");
  const [lowStockOnly, setLowStockOnly] = useState(urlFilter === "low_stock" || urlFilter === "zero_stock");
  const [zeroStockOnly, setZeroStockOnly] = useState(urlFilter === "zero_stock");
  const [adjustDialog, setAdjustDialog] = useState<{ stockId: string; productId: string; warehouseId: string; productName: string } | null>(null);
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustNotes, setAdjustNotes] = useState("");

  const { data: stock = [] } = useQuery({
    queryKey: ["inventory-stock", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("inventory_stock").select("*, products(name, sku, unit_of_measure), warehouses(name)").eq("tenant_id", tenantId!).order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: costLayers = [] } = useQuery({
    queryKey: ["cost-layers-for-stock", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("inventory_cost_layers").select("product_id, warehouse_id, quantity_remaining, unit_cost").eq("tenant_id", tenantId!).gt("quantity_remaining", 0);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("warehouses").select("id, name").eq("tenant_id", tenantId!).eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const adjustMutation = useMutation({
    mutationFn: async () => {
      if (!adjustDialog || adjustQty === 0) return;
      const { error } = await supabase.rpc("adjust_inventory_stock", {
        p_tenant_id: tenantId!, p_product_id: adjustDialog.productId,
        p_warehouse_id: adjustDialog.warehouseId, p_quantity: adjustQty,
        p_movement_type: "adjustment", p_notes: adjustNotes || null,
        p_created_by: user?.id || null, p_reference: null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory-stock"] });
      qc.invalidateQueries({ queryKey: ["inventory-movements"] });
      toast({ title: t("success") });
      setAdjustDialog(null); setAdjustQty(0); setAdjustNotes("");
    },
    onError: (err: any) => toast({ title: t("error"), description: err.message, variant: "destructive" }),
  });

  const filtered = stock.filter((s) => {
    const productName = (s.products as any)?.name || "";
    const sku = (s.products as any)?.sku || "";
    if (!`${productName} ${sku}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (warehouseFilter !== "__all__" && s.warehouse_id !== warehouseFilter) return false;
    if (zeroStockOnly && Number(s.quantity_on_hand) > 0) return false;
    if (lowStockOnly && !zeroStockOnly && Number(s.quantity_on_hand) >= Number(s.min_stock_level)) return false;
    return true;
  });

  const fmtNum = (n: number) => n.toLocaleString("sr-RS", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  const getAvgCost = (productId: string, warehouseId: string) => {
    const layers = costLayers.filter(l => l.product_id === productId && l.warehouse_id === warehouseId);
    if (layers.length === 0) return 0;
    const totalQty = layers.reduce((s, l) => s + Number(l.quantity_remaining), 0);
    const totalVal = layers.reduce((s, l) => s + Number(l.quantity_remaining) * Number(l.unit_cost), 0);
    return totalQty > 0 ? totalVal / totalQty : 0;
  };

  const columns: ResponsiveColumn<any>[] = [
    { key: "product", label: t("product"), primary: true, render: (s) => (s.products as any)?.name },
    { key: "sku", label: "SKU", hideOnMobile: true, render: (s) => (s.products as any)?.sku || "—" },
    { key: "warehouse", label: t("warehouse"), render: (s) => (
      <a href={`/inventory/warehouses/${s.warehouse_id}`} className="text-primary hover:underline">{(s.warehouses as any)?.name}</a>
    )},
    { key: "on_hand", label: t("onHand"), align: "right" as const, render: (s) => fmtNum(Number(s.quantity_on_hand)) },
    { key: "reserved", label: t("reserved"), align: "right" as const, hideOnMobile: true, render: (s) => fmtNum(Number(s.quantity_reserved)) },
    { key: "available", label: t("available"), align: "right" as const, hideOnMobile: true, render: (s) => fmtNum(Number(s.quantity_on_hand) - Number(s.quantity_reserved)) },
    { key: "min_level", label: t("minLevel"), align: "right" as const, hideOnMobile: true, render: (s) => {
      const onHand = Number(s.quantity_on_hand);
      const minLevel = Number(s.min_stock_level);
      const isLow = minLevel > 0 && onHand < minLevel;
      return isLow ? <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> {fmtNum(minLevel)}</Badge> : fmtNum(minLevel);
    }},
    { key: "avg_cost", label: t("avgCost"), align: "right" as const, hideOnMobile: true, render: (s) => {
      const avgCost = getAvgCost(s.product_id, s.warehouse_id);
      return avgCost > 0 ? fmtNum(avgCost) : "—";
    }},
    { key: "total_value", label: t("totalValue"), align: "right" as const, hideOnMobile: true, render: (s) => {
      const avgCost = getAvgCost(s.product_id, s.warehouse_id);
      const totalVal = Number(s.quantity_on_hand) * avgCost;
      return totalVal > 0 ? fmtNum(totalVal) : "—";
    }},
    { key: "actions", label: t("actions"), showInCard: false, align: "right" as const, render: (s) => (
      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setAdjustDialog({
        stockId: s.id, productId: s.product_id, warehouseId: s.warehouse_id,
        productName: (s.products as any)?.name || "",
      }); }}>
        {t("adjust")}
      </Button>
    )},
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("stockOverview")} icon={Warehouse}
        actions={
          <ExportButton
            data={filtered.map((s) => ({
              product: (s.products as any)?.name || "", sku: (s.products as any)?.sku || "",
              warehouse: (s.warehouses as any)?.name || "", on_hand: Number(s.quantity_on_hand),
              reserved: Number(s.quantity_reserved), available: Number(s.quantity_on_hand) - Number(s.quantity_reserved),
              min_level: Number(s.min_stock_level),
            }))}
            columns={[
              { key: "product", label: t("product") }, { key: "sku", label: "SKU" },
              { key: "warehouse", label: t("warehouse") }, { key: "on_hand", label: t("onHand") },
              { key: "reserved", label: t("reserved") }, { key: "available", label: t("available") },
              { key: "min_level", label: t("minLevel") },
            ]}
            filename="inventory_stock"
          />
        }
      />

      <Tabs value={activeTab} onValueChange={(v) => setSearchParams({ tab: v })}>
        <TabsList>
          <TabsTrigger value="stock">{t("stockOverview")}</TabsTrigger>
          <TabsTrigger value="health">{t("inventoryHealth")}</TabsTrigger>
        </TabsList>

        <TabsContent value="stock">
          {tenantId && <AiModuleInsights tenantId={tenantId} module="inventory" />}

          {tenantId && (() => {
            const lowStockItems = filtered.filter(s => {
              const onHand = Number(s.quantity_on_hand);
              const minLevel = Number(s.min_stock_level);
              return minLevel > 0 && onHand < minLevel;
            });
            const zeroStockItems = filtered.filter(s => Number(s.quantity_on_hand) <= 0);
            if (lowStockItems.length === 0 && zeroStockItems.length === 0) return null;
            return (
              <AiAnalyticsNarrative tenantId={tenantId} contextType="dashboard" data={{
                lowStockCount: lowStockItems.length, zeroStockCount: zeroStockItems.length,
                totalSKUs: stock.length,
                topLowStock: lowStockItems.slice(0, 5).map(s => ({
                  name: (s.products as any)?.name, sku: (s.products as any)?.sku,
                  onHand: Number(s.quantity_on_hand), minLevel: Number(s.min_stock_level),
                })),
              }} />
            );
          })()}

          <MobileFilterBar
            search={
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
            }
            filters={
              <>
                <div className="w-48">
                  <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">{t("allWarehouses")}</SelectItem>
                      {warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="low-stock" checked={lowStockOnly} onCheckedChange={(v) => setLowStockOnly(!!v)} />
                  <label htmlFor="low-stock" className="text-sm">{t("lowStockOnly")}</label>
                </div>
              </>
            }
          />

          <ResponsiveTable data={filtered} columns={columns} keyExtractor={(s) => s.id} mobileMode="scroll" emptyMessage={t("noResults")} />
        </TabsContent>

        <TabsContent value="health">
          <Suspense fallback={<Loading />}><InventoryHealthContent /></Suspense>
        </TabsContent>
      </Tabs>

      <Dialog open={!!adjustDialog} onOpenChange={() => setAdjustDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("adjustStock")} — {adjustDialog?.productName}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div><Label>{t("quantity")} ({t("adjustmentHint")})</Label><Input type="number" value={adjustQty} onChange={(e) => setAdjustQty(Number(e.target.value))} /></div>
            <div><Label>{t("notes")}</Label><Input value={adjustNotes} onChange={(e) => setAdjustNotes(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustDialog(null)}>{t("cancel")}</Button>
            <Button onClick={() => adjustMutation.mutate()} disabled={adjustQty === 0 || adjustMutation.isPending}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
