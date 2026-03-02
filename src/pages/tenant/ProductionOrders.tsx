import { useState, useEffect } from "react";
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
import { Plus, Pencil, CheckCircle, Loader2, Play, X, Eye } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { fmtNum } from "@/lib/utils";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/shared/ResponsiveTable";
import { AiModuleInsights } from "@/components/shared/AiModuleInsights";

export default function ProductionOrders() {
  const { t, locale } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ product_id: "", bom_template_id: "", quantity: 1, priority: 3, planned_start: "", planned_end: "", notes: "", warehouse_id: "" });
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [completeOrder, setCompleteOrder] = useState<any>(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [quantityToComplete, setQuantityToComplete] = useState<number>(0);
  const [costInputs, setCostInputs] = useState({ material: 0, labor: 0, overhead: 0 });

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["production_orders", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase
        .from("production_orders")
        .select("*, products(name, default_purchase_price), bom_templates(name)")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
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
      const { data } = await supabase.from("bom_templates").select("id, name, product_id").eq("tenant_id", tenantId).eq("is_active", true);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: bomMaterialSummary = [] } = useQuery({
    queryKey: ["bom_lines_summary", form.bom_template_id],
    queryFn: async () => {
      if (!form.bom_template_id) return [];
      const { data } = await supabase
        .from("bom_lines")
        .select("quantity, unit, material_product_id, products(name, default_purchase_price)")
        .eq("bom_template_id", form.bom_template_id)
        .order("sort_order");
      return data || [];
    },
    enabled: !!form.bom_template_id && open,
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

  const { data: materialAvailability = [] } = useQuery({
    queryKey: ["material_availability", completeOrder?.bom_template_id, selectedWarehouse, completeOrder?.quantity],
    queryFn: async () => {
      if (!completeOrder?.bom_template_id || !selectedWarehouse) return [];
      const { data: bomLines } = await supabase
        .from("bom_lines")
        .select("material_product_id, quantity, products(name)")
        .eq("bom_template_id", completeOrder.bom_template_id);
      if (!bomLines) return [];

      const results = await Promise.all(
        bomLines.map(async (line: any) => {
          const required = line.quantity * quantityToComplete;
          const { data: stock } = await supabase
            .from("inventory_stock")
            .select("quantity_on_hand")
            .eq("product_id", line.material_product_id)
            .eq("warehouse_id", selectedWarehouse)
            .maybeSingle();
          const available = stock?.quantity_on_hand || 0;
          return { name: line.products?.name || "-", required, available, sufficient: available >= required };
        })
      );
      return results;
    },
    enabled: !!completeOrder?.bom_template_id && !!selectedWarehouse && quantityToComplete > 0,
  });

  const hasInsufficientMaterial = materialAvailability.some((m) => !m.sufficient);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("No tenant");
      const payload = {
        tenant_id: tenantId, product_id: form.product_id || null, bom_template_id: form.bom_template_id || null,
        quantity: form.quantity, priority: form.priority, status: "draft" as string,
        planned_start: form.planned_start || null, planned_end: form.planned_end || null,
        notes: form.notes || null, created_by: user?.id || null, warehouse_id: form.warehouse_id || null,
      };
      if (editId) {
        const { status: _, ...updatePayload } = payload;
        await supabase.from("production_orders").update(updatePayload).eq("id", editId);
      } else {
        await supabase.from("production_orders").insert(payload);
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["production_orders"] }); setOpen(false); toast({ title: t("success") }); },
  });

  const transitionMutation = useMutation({
    mutationFn: async ({ id, status, extra }: { id: string; status: string; extra?: Record<string, any> }) => {
      await supabase.from("production_orders").update({ status, ...extra }).eq("id", id);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["production_orders"] }); toast({ title: t("success") }); },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      if (!completeOrder || !selectedWarehouse) throw new Error("Missing data");
      const { data, error } = await supabase.rpc("complete_production_order", {
        p_tenant_id: tenantId!, p_order_id: completeOrder.id, p_actual_quantity: quantityToComplete,
        p_warehouse_id: selectedWarehouse,
      });
      if (error) throw error;

      // Save actual costs on the production order
      const totalCost = costInputs.material + costInputs.labor + costInputs.overhead;
      const unitCost = quantityToComplete > 0 ? Math.round(totalCost / quantityToComplete * 100) / 100 : 0;
      await supabase.from("production_orders").update({
        actual_material_cost: (Number(completeOrder.actual_material_cost) || 0) + costInputs.material,
        actual_labor_cost: (Number(completeOrder.actual_labor_cost) || 0) + costInputs.labor,
        actual_overhead_cost: (Number(completeOrder.actual_overhead_cost) || 0) + costInputs.overhead,
        unit_production_cost: unitCost,
      }).eq("id", completeOrder.id);

      // Insert purchase_prices for production cost tracking
      if (completeOrder.product_id && totalCost > 0) {
        await supabase.from("purchase_prices").insert({
          tenant_id: tenantId!,
          product_id: completeOrder.product_id,
          unit_cost: unitCost,
          currency: "RSD",
          purchase_date: new Date().toISOString().slice(0, 10),
          quantity: quantityToComplete,
          document_ref: completeOrder.order_number || completeOrder.id.substring(0, 8),
          document_type: "production" as const,
          document_id: completeOrder.id,
          warehouse_id: selectedWarehouse,
        });

        // Update product default_purchase_price
        await supabase.from("products").update({
          default_purchase_price: unitCost,
        }).eq("id", completeOrder.product_id);
      }

      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["production_orders"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setCompleteDialogOpen(false); setCompleteOrder(null); setSelectedWarehouse("");
      setCostInputs({ material: 0, labor: 0, overhead: 0 });
      toast({ title: data?.fully_completed ? t("wipJournalCreated") : t("materialsConsumed") });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  useEffect(() => {
    const bomParam = searchParams.get("bom");
    if (bomParam && boms.length > 0) {
      const selectedBom = boms.find((b: any) => b.id === bomParam);
      if (selectedBom) {
        setEditId(null);
        setForm({ product_id: selectedBom.product_id || "", bom_template_id: bomParam, quantity: 1, priority: 3, planned_start: "", planned_end: "", notes: "", warehouse_id: "" });
        setOpen(true);
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, boms]);

  const openCreate = () => { setEditId(null); setForm({ product_id: "", bom_template_id: "", quantity: 1, priority: 3, planned_start: "", planned_end: "", notes: "", warehouse_id: "" }); setOpen(true); };
  const openEdit = (o: any) => { if (o.status !== "draft") return; setEditId(o.id); setForm({ product_id: o.product_id || "", bom_template_id: o.bom_template_id || "", quantity: Number(o.quantity), priority: o.priority || 3, planned_start: o.planned_start || "", planned_end: o.planned_end || "", notes: o.notes || "", warehouse_id: o.warehouse_id || "" }); setOpen(true); };
  const openComplete = (o: any) => { setCompleteOrder(o); setSelectedWarehouse(""); setQuantityToComplete(Number(o.quantity) - Number(o.completed_quantity || 0)); setCostInputs({ material: 0, labor: 0, overhead: 0 }); setCompleteDialogOpen(true); };

  const statusColor = (s: string) => { switch (s) { case "completed": return "default"; case "in_progress": return "secondary"; case "cancelled": return "destructive"; default: return "outline"; } };

  const columns: ResponsiveColumn<any>[] = [
    { key: "order_number", label: t("orderNumber"), primary: true, sortable: true, sortValue: (o) => o.order_number || o.id, render: (o) => <span className="font-mono text-sm">{o.order_number || o.id.substring(0, 8)}</span> },
    { key: "product", label: t("product"), sortable: true, sortValue: (o) => o.products?.name || "", render: (o) => o.products?.name || "-" },
    { key: "bom", label: t("bomTemplate"), hideOnMobile: true, render: (o) => o.bom_templates?.name || "-" },
    { key: "quantity", label: t("quantity"), align: "right", sortable: true, sortValue: (o) => o.quantity, render: (o) => o.quantity },
    { key: "priority", label: locale === "sr" ? "Prioritet" : "Priority", hideOnMobile: true, sortable: true, sortValue: (o) => o.priority || 3, render: (o) => <Badge variant="outline">{o.priority || 3}</Badge> },
    { key: "completed", label: t("completed"), align: "right", hideOnMobile: true, render: (o) => o.completed_quantity || 0 },
    { key: "unit_cost", label: t("unitProductionCost"), align: "right", hideOnMobile: true, defaultVisible: false, render: (o) => o.unit_production_cost ? fmtNum(o.unit_production_cost) : "—" },
    { key: "status", label: t("status"), sortable: true, sortValue: (o) => o.status, render: (o) => <Badge variant={statusColor(o.status)}>{t(o.status as any)}</Badge> },
    { key: "planned_start", label: t("plannedStart"), hideOnMobile: true, defaultVisible: false, sortable: true, sortValue: (o) => o.planned_start || "", render: (o) => o.planned_start || "-" },
    { key: "actions", label: t("actions"), render: (o) => (
      <div className="flex gap-1 flex-wrap">
        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); navigate(`/production/orders/${o.id}`); }}><Eye className="h-3 w-3" /></Button>
        {o.status === "draft" && (
          <>
            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openEdit(o); }}><Pencil className="h-3 w-3" /></Button>
            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); transitionMutation.mutate({ id: o.id, status: "planned" }); }} disabled={!o.product_id || !o.bom_template_id}>{t("planned")}</Button>
          </>
        )}
        {o.status === "planned" && (
          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); transitionMutation.mutate({ id: o.id, status: "in_progress", extra: { actual_start: new Date().toISOString().split("T")[0] } }); }}>
            <Play className="h-3 w-3 mr-1" />{t("in_progress")}
          </Button>
        )}
        {(o.status === "in_progress" || o.status === "planned") && (
          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openComplete(o); }}><CheckCircle className="h-3 w-3 mr-1" />{t("completeAndConsume")}</Button>
        )}
        {o.status !== "completed" && o.status !== "cancelled" && (
          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); transitionMutation.mutate({ id: o.id, status: "cancelled" }); }}><X className="h-3 w-3" /></Button>
        )}
      </div>
    )},
  ];

  return (
    <div className="space-y-6">
      {tenantId && <AiModuleInsights tenantId={tenantId} module="production" compact />}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("productionOrders")}</h1>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />{t("add")}</Button>
      </div>

      <ResponsiveTable
        data={orders}
        columns={columns}
        keyExtractor={(o) => o.id}
        emptyMessage={t("noResults")}
        enableExport
        exportFilename="production_orders"
        enableColumnToggle
      />

      {/* Create/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
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
              <Select value={form.bom_template_id} onValueChange={v => {
                const selectedBom = boms.find((b: any) => b.id === v);
                setForm({ ...form, bom_template_id: v, product_id: selectedBom?.product_id || form.product_id });
              }}>
                <SelectTrigger><SelectValue placeholder={t("selectProduct")} /></SelectTrigger>
                <SelectContent>{boms.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {form.bom_template_id && bomMaterialSummary.length > 0 && (
              <div className="border rounded-md p-3 bg-muted/30 space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">{t("materialSummary")}</Label>
                {bomMaterialSummary.map((line: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>{line.products?.name || "-"}</span>
                    <span className="text-muted-foreground">{(line.quantity * form.quantity).toFixed(2)} {line.unit}</span>
                  </div>
                ))}
                <div className="border-t pt-1 flex justify-between text-sm font-medium">
                  <span>{t("estimatedCost")}</span>
                  <span>{fmtNum(bomMaterialSummary.reduce((sum: number, l: any) => sum + (l.quantity * form.quantity * (l.products?.default_purchase_price || 0)), 0))}</span>
                </div>
              </div>
            )}
            <div><Label>{t("quantity")}</Label><Input type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: Number(e.target.value) })} /></div>
            <div>
              <Label>{locale === "sr" ? "Prioritet" : "Priority"} (1-5)</Label>
              <Select value={String(form.priority)} onValueChange={v => setForm({ ...form, priority: Number(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 — {locale === "sr" ? "Najviši" : "Highest"}</SelectItem>
                  <SelectItem value="2">2 — {locale === "sr" ? "Visok" : "High"}</SelectItem>
                  <SelectItem value="3">3 — {locale === "sr" ? "Srednji" : "Medium"}</SelectItem>
                  <SelectItem value="4">4 — {locale === "sr" ? "Nizak" : "Low"}</SelectItem>
                  <SelectItem value="5">5 — {locale === "sr" ? "Najniži" : "Lowest"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>{t("plannedStart")}</Label><Input type="date" value={form.planned_start} onChange={e => setForm({ ...form, planned_start: e.target.value })} /></div>
              <div><Label>{t("plannedEnd")}</Label><Input type="date" value={form.planned_end} onChange={e => setForm({ ...form, planned_end: e.target.value })} /></div>
            </div>
            <div>
              <Label>{t("warehouse")}</Label>
              <Select value={form.warehouse_id} onValueChange={v => setForm({ ...form, warehouse_id: v })}>
                <SelectTrigger><SelectValue placeholder={t("warehouse")} /></SelectTrigger>
                <SelectContent>{warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>{t("notes")}</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Dialog */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("completeAndConsume")}</DialogTitle>
            <DialogDescription>{t("completeAndConsume")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("warehouse")}</Label>
              <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                <SelectTrigger><SelectValue placeholder={t("warehouse")} /></SelectTrigger>
                <SelectContent>{warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("quantity")}</Label>
              <Input type="number" min={1} max={completeOrder ? Number(completeOrder.quantity) - Number(completeOrder.completed_quantity || 0) : 1} value={quantityToComplete} onChange={(e) => setQuantityToComplete(Number(e.target.value))} />
            </div>
            {materialAvailability.length > 0 && (
              <div className="border rounded-md p-3 space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">{t("materialSummary")}</Label>
                <Table>
                  <TableHeader><TableRow><TableHead>{t("product")}</TableHead><TableHead className="text-right">{t("quantity")}</TableHead><TableHead className="text-right">{t("available")}</TableHead><TableHead>{t("status")}</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {materialAvailability.map((m: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell>{m.name}</TableCell>
                        <TableCell className="text-right">{m.required}</TableCell>
                        <TableCell className="text-right">{m.available}</TableCell>
                        <TableCell>{m.sufficient ? <Badge variant="outline">OK</Badge> : <Badge variant="destructive">!</Badge>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <div className="border rounded-md p-3 space-y-3">
              <Label className="text-xs font-medium text-muted-foreground">{t("totalActualCost")}</Label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">{t("actualMaterialCost")}</Label>
                  <Input type="number" step="0.01" min={0} value={costInputs.material} onChange={e => setCostInputs(c => ({ ...c, material: Number(e.target.value) }))} />
                </div>
                <div>
                  <Label className="text-xs">{t("actualLaborCost")}</Label>
                  <Input type="number" step="0.01" min={0} value={costInputs.labor} onChange={e => setCostInputs(c => ({ ...c, labor: Number(e.target.value) }))} />
                </div>
                <div>
                  <Label className="text-xs">{t("actualOverheadCost")}</Label>
                  <Input type="number" step="0.01" min={0} value={costInputs.overhead} onChange={e => setCostInputs(c => ({ ...c, overhead: Number(e.target.value) }))} />
                </div>
              </div>
              <div className="flex justify-between text-sm border-t pt-2">
                <span>{t("unitProductionCost")}:</span>
                <strong>{quantityToComplete > 0 ? fmtNum((costInputs.material + costInputs.labor + costInputs.overhead) / quantityToComplete) : "—"}</strong>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteDialogOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => completeMutation.mutate()} disabled={!selectedWarehouse || completeMutation.isPending || hasInsufficientMaterial}>
              {completeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              {t("completeAndConsume")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
