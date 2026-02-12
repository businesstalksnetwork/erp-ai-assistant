import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Search, AlertTriangle, Plus, Minus } from "lucide-react";

export default function InventoryStock() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("__all__");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [adjustDialog, setAdjustDialog] = useState<{ stockId: string; productId: string; warehouseId: string; productName: string } | null>(null);
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustNotes, setAdjustNotes] = useState("");

  const { data: stock = [] } = useQuery({
    queryKey: ["inventory-stock", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_stock")
        .select("*, products(name, sku, unit_of_measure), warehouses(name)")
        .eq("tenant_id", tenantId!)
        .order("updated_at", { ascending: false });
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
        p_tenant_id: tenantId!,
        p_product_id: adjustDialog.productId,
        p_warehouse_id: adjustDialog.warehouseId,
        p_quantity: adjustQty,
        p_movement_type: "adjustment",
        p_notes: adjustNotes || null,
        p_created_by: user?.id || null,
        p_reference: null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory-stock"] });
      qc.invalidateQueries({ queryKey: ["inventory-movements"] });
      toast({ title: t("success") });
      setAdjustDialog(null);
      setAdjustQty(0);
      setAdjustNotes("");
    },
    onError: (err: any) => toast({ title: t("error"), description: err.message, variant: "destructive" }),
  });

  const filtered = stock.filter((s) => {
    const productName = (s.products as any)?.name || "";
    const sku = (s.products as any)?.sku || "";
    if (!`${productName} ${sku}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (warehouseFilter !== "__all__" && s.warehouse_id !== warehouseFilter) return false;
    if (lowStockOnly && Number(s.quantity_on_hand) >= Number(s.min_stock_level)) return false;
    return true;
  });

  const fmtNum = (n: number) => n.toLocaleString("sr-RS", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("stockOverview")}</h1>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
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
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("product")}</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>{t("warehouse")}</TableHead>
                <TableHead className="text-right">{t("onHand")}</TableHead>
                <TableHead className="text-right">{t("reserved")}</TableHead>
                <TableHead className="text-right">{t("available")}</TableHead>
                <TableHead className="text-right">{t("minLevel")}</TableHead>
                <TableHead className="text-right">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => {
                const onHand = Number(s.quantity_on_hand);
                const reserved = Number(s.quantity_reserved);
                const available = onHand - reserved;
                const minLevel = Number(s.min_stock_level);
                const isLow = minLevel > 0 && onHand < minLevel;
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{(s.products as any)?.name}</TableCell>
                    <TableCell>{(s.products as any)?.sku || "—"}</TableCell>
                    <TableCell>{(s.warehouses as any)?.name}</TableCell>
                    <TableCell className="text-right font-mono">{fmtNum(onHand)}</TableCell>
                    <TableCell className="text-right font-mono">{fmtNum(reserved)}</TableCell>
                    <TableCell className="text-right font-mono">{fmtNum(available)}</TableCell>
                    <TableCell className="text-right">
                      {isLow ? (
                        <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> {fmtNum(minLevel)}</Badge>
                      ) : fmtNum(minLevel)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setAdjustDialog({
                        stockId: s.id, productId: s.product_id, warehouseId: s.warehouse_id,
                        productName: (s.products as any)?.name || "",
                      })}>
                        {t("adjust")}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!adjustDialog} onOpenChange={() => setAdjustDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("adjustStock")} — {adjustDialog?.productName}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div>
              <Label>{t("quantity")} ({t("adjustmentHint")})</Label>
              <Input type="number" value={adjustQty} onChange={(e) => setAdjustQty(Number(e.target.value))} />
            </div>
            <div>
              <Label>{t("notes")}</Label>
              <Input value={adjustNotes} onChange={(e) => setAdjustNotes(e.target.value)} />
            </div>
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
