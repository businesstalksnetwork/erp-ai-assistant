import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, CheckCircle, Loader2 } from "lucide-react";

const STATUSES = ["draft", "planned", "in_progress", "completed", "cancelled"] as const;

export default function ProductionOrders() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ product_id: "", bom_template_id: "", quantity: 1, status: "draft" as string, planned_start: "", planned_end: "", notes: "" });
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [completeOrder, setCompleteOrder] = useState<any>(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["production_orders", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("production_orders").select("*, products(name), bom_templates(name)").eq("tenant_id", tenantId).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
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

  const { data: boms = [] } = useQuery({
    queryKey: ["bom_templates", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("bom_templates").select("id, name").eq("tenant_id", tenantId).eq("is_active", true);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("warehouses").select("id, name").eq("tenant_id", tenantId).eq("is_active", true);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("No tenant");
      const payload = {
        tenant_id: tenantId,
        product_id: form.product_id || null,
        bom_template_id: form.bom_template_id || null,
        quantity: form.quantity,
        status: form.status,
        planned_start: form.planned_start || null,
        planned_end: form.planned_end || null,
        notes: form.notes || null,
        created_by: user?.id || null,
      };
      if (editId) {
        await supabase.from("production_orders").update(payload).eq("id", editId);
      } else {
        await supabase.from("production_orders").insert(payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production_orders"] });
      setOpen(false);
      toast({ title: t("success") });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      if (!completeOrder || !selectedWarehouse || !tenantId) throw new Error("Missing data");
      
      // Fetch BOM lines if BOM template is set
      if (completeOrder.bom_template_id) {
        const { data: bomLines } = await supabase
          .from("bom_lines")
          .select("material_product_id, quantity")
          .eq("bom_template_id", completeOrder.bom_template_id);
        
        if (bomLines) {
          // Consume materials (negative adjustment)
          for (const line of bomLines) {
            const consumeQty = line.quantity * completeOrder.quantity;
            await supabase.rpc("adjust_inventory_stock", {
              p_tenant_id: tenantId,
              p_product_id: line.material_product_id,
              p_warehouse_id: selectedWarehouse,
              p_quantity: -consumeQty,
              p_movement_type: "out",
              p_reference: `Production Order ${completeOrder.id}`,
              p_notes: "Material consumption",
              p_created_by: user?.id || null,
            });
          }
        }
      }

      // Add finished goods (positive adjustment)
      if (completeOrder.product_id) {
        await supabase.rpc("adjust_inventory_stock", {
          p_tenant_id: tenantId,
          p_product_id: completeOrder.product_id,
          p_warehouse_id: selectedWarehouse,
          p_quantity: completeOrder.quantity,
          p_movement_type: "in",
          p_reference: `Production Order ${completeOrder.id}`,
          p_notes: "Finished goods output",
          p_created_by: user?.id || null,
        });
      }

      // Update production order status
      await supabase.from("production_orders").update({
        status: "completed",
        actual_end: new Date().toISOString().split("T")[0],
      }).eq("id", completeOrder.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production_orders"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setCompleteDialogOpen(false);
      setCompleteOrder(null);
      setSelectedWarehouse("");
      toast({ title: t("materialsConsumed") });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const openCreate = () => { setEditId(null); setForm({ product_id: "", bom_template_id: "", quantity: 1, status: "draft", planned_start: "", planned_end: "", notes: "" }); setOpen(true); };
  const openEdit = (o: any) => {
    setEditId(o.id);
    setForm({ product_id: o.product_id || "", bom_template_id: o.bom_template_id || "", quantity: Number(o.quantity), status: o.status, planned_start: o.planned_start || "", planned_end: o.planned_end || "", notes: o.notes || "" });
    setOpen(true);
  };

  const openComplete = (o: any) => {
    setCompleteOrder(o);
    setSelectedWarehouse("");
    setCompleteDialogOpen(true);
  };

  const statusColor = (s: string) => {
    switch (s) { case "completed": return "default"; case "in_progress": return "secondary"; case "cancelled": return "destructive"; default: return "outline"; }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("productionOrders")}</h1>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />{t("add")}</Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("product")}</TableHead>
            <TableHead>{t("bomTemplate")}</TableHead>
            <TableHead>{t("quantity")}</TableHead>
            <TableHead>{t("status")}</TableHead>
            <TableHead>{t("plannedStart")}</TableHead>
            <TableHead>{t("plannedEnd")}</TableHead>
            <TableHead>{t("actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={7}>{t("loading")}</TableCell></TableRow>
          ) : orders.map((o: any) => (
            <TableRow key={o.id}>
              <TableCell>{o.products?.name || "-"}</TableCell>
              <TableCell>{o.bom_templates?.name || "-"}</TableCell>
              <TableCell>{o.quantity}</TableCell>
              <TableCell><Badge variant={statusColor(o.status)}>{t(o.status as any)}</Badge></TableCell>
              <TableCell>{o.planned_start || "-"}</TableCell>
              <TableCell>{o.planned_end || "-"}</TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => openEdit(o)}><Pencil className="h-3 w-3" /></Button>
                  {(o.status === "in_progress" || o.status === "planned") && (
                    <Button size="sm" variant="outline" onClick={() => openComplete(o)}>
                      <CheckCircle className="h-3 w-3 mr-1" />{t("completeAndConsume")}
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Edit/Create Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editId ? t("edit") : t("add")} {t("productionOrders")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("product")}</Label>
              <Select value={form.product_id} onValueChange={v => setForm({ ...form, product_id: v })}>
                <SelectTrigger><SelectValue placeholder={t("selectProduct")} /></SelectTrigger>
                <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("bomTemplate")}</Label>
              <Select value={form.bom_template_id} onValueChange={v => setForm({ ...form, bom_template_id: v })}>
                <SelectTrigger><SelectValue placeholder={t("selectProduct")} /></SelectTrigger>
                <SelectContent>{boms.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>{t("quantity")}</Label><Input type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: Number(e.target.value) })} /></div>
            <div>
              <Label>{t("status")}</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{t(s as any)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t("plannedStart")}</Label><Input type="date" value={form.planned_start} onChange={e => setForm({ ...form, planned_start: e.target.value })} /></div>
              <div><Label>{t("plannedEnd")}</Label><Input type="date" value={form.planned_end} onChange={e => setForm({ ...form, planned_end: e.target.value })} /></div>
            </div>
            <div><Label>{t("notes")}</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={() => saveMutation.mutate()}>{t("save")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete & Consume Dialog */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("completeAndConsume")}</DialogTitle>
            <DialogDescription>{t("selectWarehouseForProduction")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("warehouse")} *</Label>
              <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                <SelectTrigger><SelectValue placeholder={t("selectWarehouse")} /></SelectTrigger>
                <SelectContent>
                  {warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {completeOrder && (
              <div className="text-sm text-muted-foreground space-y-1">
                <p>{t("product")}: {completeOrder.products?.name || "-"}</p>
                <p>{t("quantity")}: {completeOrder.quantity}</p>
                <p>{t("bomTemplate")}: {completeOrder.bom_templates?.name || "-"}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteDialogOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => completeMutation.mutate()} disabled={!selectedWarehouse || completeMutation.isPending}>
              {completeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
