import { useParams, useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Package, ClipboardList, DollarSign, AlertTriangle } from "lucide-react";
import { useState } from "react";

export default function ProductionOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [wasteOpen, setWasteOpen] = useState(false);
  const [wasteForm, setWasteForm] = useState({ product_id: "", quantity: 0, reason: "" });

  const { data: order, isLoading } = useQuery({
    queryKey: ["production_order", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("production_orders")
        .select("*, products(name, default_purchase_price), bom_templates(name)")
        .eq("id", id!)
        .single();
      return data;
    },
    enabled: !!id,
  });

  const { data: bomLines = [] } = useQuery({
    queryKey: ["bom_lines", order?.bom_template_id],
    queryFn: async () => {
      if (!order?.bom_template_id) return [];
      const { data } = await supabase
        .from("bom_lines")
        .select("*, products(name, default_purchase_price)")
        .eq("bom_template_id", order.bom_template_id)
        .order("sort_order");
      return data || [];
    },
    enabled: !!order?.bom_template_id,
  });

  const { data: movements = [] } = useQuery({
    queryKey: ["production_movements", order?.order_number],
    queryFn: async () => {
      if (!order?.order_number || !tenantId) return [];
      const { data } = await supabase
        .from("inventory_movements")
        .select("*, products(name), warehouses(name)")
        .eq("tenant_id", tenantId)
        .like("reference", `%${order.order_number}%`)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!order?.order_number && !!tenantId,
  });

  const { data: waste = [] } = useQuery({
    queryKey: ["production_waste", id],
    queryFn: async () => {
      if (!id || !tenantId) return [];
      const { data } = await supabase
        .from("production_waste")
        .select("*, products(name)")
        .eq("production_order_id", id)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!id && !!tenantId,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("products").select("id, name").eq("tenant_id", tenantId).eq("is_active", true);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const addWasteMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !id) throw new Error("Missing data");
      await supabase.from("production_waste").insert({
        tenant_id: tenantId,
        production_order_id: id,
        product_id: wasteForm.product_id,
        quantity: wasteForm.quantity,
        reason: wasteForm.reason || null,
        recorded_by: user?.id || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production_waste", id] });
      setWasteOpen(false);
      setWasteForm({ product_id: "", quantity: 0, reason: "" });
      toast({ title: t("success") });
    },
  });

  if (isLoading) return <div className="p-6">{t("loading")}</div>;
  if (!order) return <div className="p-6">{t("error")}</div>;

  // Cost calculations
  const plannedCost = bomLines.reduce((sum: number, bl: any) => {
    return sum + (bl.quantity || 0) * Number(order.quantity) * (bl.products?.default_purchase_price || 0);
  }, 0);

  const totalWaste = waste.reduce((sum: number, w: any) => sum + Number(w.quantity), 0);

  const statusColor = (s: string) => {
    switch (s) {
      case "completed": return "default";
      case "in_progress": return "secondary";
      case "cancelled": return "destructive";
      default: return "outline";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/production/orders")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{order.order_number || order.id.substring(0, 8)}</h1>
          <p className="text-muted-foreground">{order.products?.name || t("productionOrders")}</p>
        </div>
        <Badge variant={statusColor(order.status)} className="ml-auto">{t(order.status as any)}</Badge>
      </div>

      {/* Header cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Package className="h-4 w-4" />{t("quantity")}</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{order.completed_quantity || 0} / {order.quantity}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4" />{t("plannedCost")}</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{plannedCost.toLocaleString("sr-RS", { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ClipboardList className="h-4 w-4" />{t("plannedStart")}</CardTitle></CardHeader>
          <CardContent>
            <p className="text-lg">{order.planned_start || "-"}</p>
            <p className="text-xs text-muted-foreground">{t("plannedEnd")}: {order.planned_end || "-"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{t("waste")}</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalWaste}</p>
          </CardContent>
        </Card>
      </div>

      {/* BOM Materials */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("materials")} ({t("bomTemplate")}: {order.bom_templates?.name || "-"})</CardTitle>
        </CardHeader>
        <CardContent>
          {bomLines.length === 0 ? (
            <p className="text-muted-foreground">{t("noResults")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("product")}</TableHead>
                  <TableHead className="text-right">{t("quantity")}</TableHead>
                  <TableHead className="text-right">{t("total")}</TableHead>
                  <TableHead className="text-right">{t("purchasePrice")}</TableHead>
                  <TableHead className="text-right">{t("totalCost")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bomLines.map((bl: any) => {
                  const totalQty = bl.quantity * Number(order.quantity);
                  const cost = totalQty * (bl.products?.default_purchase_price || 0);
                  return (
                    <TableRow key={bl.id}>
                      <TableCell>{bl.products?.name || "-"}</TableCell>
                      <TableCell className="text-right">{bl.quantity} × {order.quantity}</TableCell>
                      <TableCell className="text-right font-medium">{totalQty}</TableCell>
                      <TableCell className="text-right">{bl.products?.default_purchase_price || 0}</TableCell>
                      <TableCell className="text-right font-medium">{cost.toLocaleString("sr-RS", { minimumFractionDigits: 2 })}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Inventory Movements */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("movementHistory")}</CardTitle>
        </CardHeader>
        <CardContent>
          {movements.length === 0 ? (
            <p className="text-muted-foreground">{t("noResults")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead>{t("product")}</TableHead>
                  <TableHead>{t("warehouse")}</TableHead>
                  <TableHead>{t("type")}</TableHead>
                  <TableHead className="text-right">{t("quantity")}</TableHead>
                  <TableHead>{t("notes")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-sm">{new Date(m.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>{m.products?.name || "-"}</TableCell>
                    <TableCell>{m.warehouses?.name || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={m.movement_type === "in" ? "default" : "destructive"}>{m.movement_type}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{m.quantity}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{m.notes || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Waste/Scrap */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">{t("waste")}</CardTitle>
          {(order.status === "in_progress" || order.status === "planned") && (
            <Button size="sm" variant="outline" onClick={() => setWasteOpen(true)}>
              <Plus className="h-3 w-3 mr-1" />{t("recordWaste")}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {waste.length === 0 ? (
            <p className="text-muted-foreground">{t("noResults")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead>{t("product")}</TableHead>
                  <TableHead className="text-right">{t("quantity")}</TableHead>
                  <TableHead>{t("reason")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {waste.map((w: any) => (
                  <TableRow key={w.id}>
                    <TableCell className="text-sm">{new Date(w.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>{w.products?.name || "-"}</TableCell>
                    <TableCell className="text-right">{w.quantity}</TableCell>
                    <TableCell className="text-sm">{w.reason || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Record Waste Dialog */}
      <Dialog open={wasteOpen} onOpenChange={setWasteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("recordWaste")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("product")}</Label>
              <Select value={wasteForm.product_id} onValueChange={v => setWasteForm({ ...wasteForm, product_id: v })}>
                <SelectTrigger><SelectValue placeholder={t("selectProduct")} /></SelectTrigger>
                <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>{t("quantity")}</Label><Input type="number" value={wasteForm.quantity} onChange={e => setWasteForm({ ...wasteForm, quantity: Number(e.target.value) })} /></div>
            <div><Label>{t("reason")}</Label><Textarea value={wasteForm.reason} onChange={e => setWasteForm({ ...wasteForm, reason: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button onClick={() => addWasteMutation.mutate()} disabled={!wasteForm.product_id || wasteForm.quantity <= 0}>
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
