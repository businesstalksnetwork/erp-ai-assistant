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

export default function ProductionOrders() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ product_id: "", bom_template_id: "", quantity: 1, planned_start: "", planned_end: "", notes: "" });
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [completeOrder, setCompleteOrder] = useState<any>(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [quantityToComplete, setQuantityToComplete] = useState<number>(0);

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

  // Fetch BOM lines for material summary when a BOM is selected in create/edit
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

  // Material availability check for complete dialog
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
          return {
            name: line.products?.name || "-",
            required,
            available,
            sufficient: available >= required,
          };
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
        tenant_id: tenantId,
        product_id: form.product_id || null,
        bom_template_id: form.bom_template_id || null,
        quantity: form.quantity,
        status: "draft" as string,
        planned_start: form.planned_start || null,
        planned_end: form.planned_end || null,
        notes: form.notes || null,
        created_by: user?.id || null,
      };
      if (editId) {
        const { status: _, ...updatePayload } = payload;
        await supabase.from("production_orders").update(updatePayload).eq("id", editId);
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

  // Status transition mutations
  const transitionMutation = useMutation({
    mutationFn: async ({ id, status, extra }: { id: string; status: string; extra?: Record<string, any> }) => {
      await supabase.from("production_orders").update({ status, ...extra }).eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production_orders"] });
      toast({ title: t("success") });
    },
  });

  // Atomic complete via RPC
  const completeMutation = useMutation({
    mutationFn: async () => {
      if (!completeOrder || !selectedWarehouse) throw new Error("Missing data");
      const { data, error } = await supabase.rpc("complete_production_order", {
        p_order_id: completeOrder.id,
        p_warehouse_id: selectedWarehouse,
        p_quantity_to_complete: quantityToComplete,
        p_user_id: user?.id || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["production_orders"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setCompleteDialogOpen(false);
      setCompleteOrder(null);
      setSelectedWarehouse("");
      const msg = data?.fully_completed ? t("wipJournalCreated") : t("materialsConsumed");
      toast({ title: msg });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  // Handle BOM URL param from BomTemplates "Create Order" shortcut
  useEffect(() => {
    const bomParam = searchParams.get("bom");
    if (bomParam && boms.length > 0) {
      const selectedBom = boms.find((b: any) => b.id === bomParam);
      if (selectedBom) {
        setEditId(null);
        setForm({ product_id: selectedBom.product_id || "", bom_template_id: bomParam, quantity: 1, planned_start: "", planned_end: "", notes: "" });
        setOpen(true);
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, boms]);

  const openCreate = () => {
    setEditId(null);
    setForm({ product_id: "", bom_template_id: "", quantity: 1, planned_start: "", planned_end: "", notes: "" });
    setOpen(true);
  };

  const openEdit = (o: any) => {
    if (o.status !== "draft") return;
    setEditId(o.id);
    setForm({
      product_id: o.product_id || "",
      bom_template_id: o.bom_template_id || "",
      quantity: Number(o.quantity),
      planned_start: o.planned_start || "",
      planned_end: o.planned_end || "",
      notes: o.notes || "",
    });
    setOpen(true);
  };

  const openComplete = (o: any) => {
    setCompleteOrder(o);
    setSelectedWarehouse("");
    const remaining = Number(o.quantity) - Number(o.completed_quantity || 0);
    setQuantityToComplete(remaining);
    setCompleteDialogOpen(true);
  };

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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("productionOrders")}</h1>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />{t("add")}</Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("orderNumber")}</TableHead>
            <TableHead>{t("product")}</TableHead>
            <TableHead>{t("bomTemplate")}</TableHead>
            <TableHead>{t("quantity")}</TableHead>
            <TableHead>{t("completed")}</TableHead>
            <TableHead>{t("status")}</TableHead>
            <TableHead>{t("plannedStart")}</TableHead>
            <TableHead>{t("actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={8}>{t("loading")}</TableCell></TableRow>
          ) : orders.map((o: any) => (
            <TableRow key={o.id}>
              <TableCell className="font-mono text-sm">{o.order_number || o.id.substring(0, 8)}</TableCell>
              <TableCell>{o.products?.name || "-"}</TableCell>
              <TableCell>{o.bom_templates?.name || "-"}</TableCell>
              <TableCell>{o.quantity}</TableCell>
              <TableCell>{o.completed_quantity || 0}</TableCell>
              <TableCell><Badge variant={statusColor(o.status)}>{t(o.status as any)}</Badge></TableCell>
              <TableCell>{o.planned_start || "-"}</TableCell>
              <TableCell>
                <div className="flex gap-1 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => navigate(`/production/orders/${o.id}`)}>
                    <Eye className="h-3 w-3" />
                  </Button>
                  {o.status === "draft" && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => openEdit(o)}><Pencil className="h-3 w-3" /></Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => transitionMutation.mutate({ id: o.id, status: "planned" })}
                        disabled={!o.product_id || !o.bom_template_id}
                        title={!o.product_id || !o.bom_template_id ? t("selectProduct") : ""}
                      >
                        {t("planned")}
                      </Button>
                    </>
                  )}
                  {o.status === "planned" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => transitionMutation.mutate({ id: o.id, status: "in_progress", extra: { actual_start: new Date().toISOString().split("T")[0] } })}
                    >
                      <Play className="h-3 w-3 mr-1" />{t("in_progress")}
                    </Button>
                  )}
                  {(o.status === "in_progress" || o.status === "planned") && (
                    <Button size="sm" variant="outline" onClick={() => openComplete(o)}>
                      <CheckCircle className="h-3 w-3 mr-1" />{t("completeAndConsume")}
                    </Button>
                  )}
                  {o.status !== "completed" && o.status !== "cancelled" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => transitionMutation.mutate({ id: o.id, status: "cancelled" })}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Create/Edit Dialog (draft only) */}
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
              <Select value={form.bom_template_id} onValueChange={v => {
                const selectedBom = boms.find((b: any) => b.id === v);
                setForm({ ...form, bom_template_id: v, product_id: selectedBom?.product_id || form.product_id });
              }}>
                <SelectTrigger><SelectValue placeholder={t("selectProduct")} /></SelectTrigger>
                <SelectContent>{boms.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {/* Material summary from BOM */}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>{t("plannedStart")}</Label><Input type="date" value={form.planned_start} onChange={e => setForm({ ...form, planned_start: e.target.value })} /></div>
              <div><Label>{t("plannedEnd")}</Label><Input type="date" value={form.planned_end} onChange={e => setForm({ ...form, planned_end: e.target.value })} /></div>
            </div>
            <div><Label>{t("notes")}</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={() => saveMutation.mutate()}>{t("save")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete & Consume Dialog with material availability */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent className="max-w-lg">
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
            <div>
              <Label>{t("quantity")}</Label>
              <Input
                type="number"
                value={quantityToComplete}
                onChange={e => setQuantityToComplete(Number(e.target.value))}
                max={completeOrder ? Number(completeOrder.quantity) - Number(completeOrder.completed_quantity || 0) : 0}
                min={1}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("completed")}: {completeOrder?.completed_quantity || 0} / {completeOrder?.quantity}
              </p>
            </div>
            {completeOrder && (
              <div className="text-sm text-muted-foreground space-y-1">
                <p>{t("product")}: {completeOrder.products?.name || "-"}</p>
                <p>{t("bomTemplate")}: {completeOrder.bom_templates?.name || "-"}</p>
              </div>
            )}
            {/* Material availability table */}
            {selectedWarehouse && materialAvailability.length > 0 && (
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">{t("materials")}</TableHead>
                      <TableHead className="text-xs text-right">{t("quantity")}</TableHead>
                      <TableHead className="text-xs text-right">{t("available")}</TableHead>
                      <TableHead className="text-xs">{t("status")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {materialAvailability.map((m, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm">{m.name}</TableCell>
                        <TableCell className="text-sm text-right">{m.required}</TableCell>
                        <TableCell className="text-sm text-right">{m.available}</TableCell>
                        <TableCell>
                          <Badge variant={m.sufficient ? "default" : "destructive"}>
                            {m.sufficient ? "OK" : t("error")}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteDialogOpen(false)}>{t("cancel")}</Button>
            <Button
              onClick={() => completeMutation.mutate()}
              disabled={!selectedWarehouse || completeMutation.isPending || hasInsufficientMaterial || quantityToComplete <= 0}
            >
              {completeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
