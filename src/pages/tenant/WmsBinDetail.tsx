import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package, ArrowLeft, Plus, Minus, ArrowRightLeft, Edit, History } from "lucide-react";

export default function WmsBinDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ product_id: "", quantity: 0, reason: "" });
  const [transferForm, setTransferForm] = useState({ stock_id: "", to_bin_id: "", quantity: 0 });
  const [editForm, setEditForm] = useState({ max_units: 0, max_weight: 0, max_volume: 0, accessibility_score: 5 });

  const { data: bin } = useQuery({
    queryKey: ["wms-bin", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("wms_bins").select("*, wms_zones(name, zone_type, warehouse_id), wms_aisles(name), warehouses(name)").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!tenantId,
  });

  const { data: stock = [] } = useQuery({
    queryKey: ["wms-bin-stock", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("wms_bin_stock").select("*, products(name, sku)").eq("bin_id", id!).order("received_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!tenantId,
  });

  const { data: movementHistory = [] } = useQuery({
    queryKey: ["wms-bin-history", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("wms_tasks")
        .select("id, task_number, task_type, status, quantity, created_at, completed_at, products(name)")
        .or(`from_bin_id.eq.${id},to_bin_id.eq.${id}`)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!tenantId,
  });

  const { data: allBins = [] } = useQuery({
    queryKey: ["wms-transfer-bins", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("wms_bins").select("id, code").eq("tenant_id", tenantId!).neq("id", id!).limit(500);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && !!id,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["wms-bin-products", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name, sku").eq("tenant_id", tenantId!).limit(200);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // Stock adjustment mutation
  const adjustMutation = useMutation({
    mutationFn: async () => {
      if (adjustForm.quantity > 0) {
        // Add stock - need warehouse_id from zone
        const warehouseId = (bin as any)?.wms_zones?.warehouse_id;
        const { error } = await supabase.from("wms_bin_stock").insert({
          tenant_id: tenantId!,
          bin_id: id!,
          product_id: adjustForm.product_id,
          quantity: adjustForm.quantity,
          status: "available" as const,
          warehouse_id: warehouseId,
        });
        if (error) throw error;
      } else {
        // Reduce stock — find existing record
        const existing = stock.find((s: any) => s.product_id === adjustForm.product_id);
        if (!existing) throw new Error("Product not found in bin");
        const newQty = existing.quantity + adjustForm.quantity; // quantity is negative
        if (newQty <= 0) {
          await supabase.from("wms_bin_stock").delete().eq("id", existing.id);
        } else {
          await supabase.from("wms_bin_stock").update({ quantity: newQty }).eq("id", existing.id);
        }
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["wms-bin-stock"] }); toast({ title: t("success") }); setAdjustOpen(false); setAdjustForm({ product_id: "", quantity: 0, reason: "" }); },
    onError: () => toast({ title: t("error"), variant: "destructive" }),
  });

  // Transfer mutation — creates a move task
  const transferMutation = useMutation({
    mutationFn: async () => {
      const stockItem = stock.find((s: any) => s.id === transferForm.stock_id);
      if (!stockItem) throw new Error("Stock not found");
      const count = await supabase.from("wms_tasks").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!);
      const seq = (count.count || 0) + 1;
      const { error } = await supabase.from("wms_tasks").insert({
        tenant_id: tenantId!,
        task_number: `TASK-${String(seq).padStart(5, "0")}`,
        task_type: "move",
        warehouse_id: (bin as any)?.wms_zones?.warehouse_id || null,
        product_id: stockItem.product_id,
        from_bin_id: id!,
        to_bin_id: transferForm.to_bin_id,
        quantity: transferForm.quantity,
        priority: 3,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: t("transferTaskCreated") }); setTransferOpen(false); setTransferForm({ stock_id: "", to_bin_id: "", quantity: 0 }); },
    onError: () => toast({ title: t("error"), variant: "destructive" }),
  });

  // Edit bin mutation
  const editMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("wms_bins").update({
        max_units: editForm.max_units || null,
        max_weight: editForm.max_weight || null,
        max_volume: editForm.max_volume || null,
        accessibility_score: editForm.accessibility_score,
      }).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["wms-bin"] }); toast({ title: t("success") }); setEditOpen(false); },
    onError: () => toast({ title: t("error"), variant: "destructive" }),
  });

  const openEdit = () => {
    if (bin) {
      setEditForm({
        max_units: bin.max_units || 0,
        max_weight: bin.max_weight || 0,
        max_volume: bin.max_volume || 0,
        accessibility_score: bin.accessibility_score || 5,
      });
      setEditOpen(true);
    }
  };

  if (!bin) return <div className="p-6">{t("loading")}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-2"><ArrowLeft className="h-4 w-4 mr-1" />{t("back")}</Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setAdjustOpen(true)}><Plus className="h-3 w-3 mr-1" />{t("adjustStock")}</Button>
          <Button variant="outline" size="sm" onClick={() => setTransferOpen(true)}><ArrowRightLeft className="h-3 w-3 mr-1" />{t("transfer")}</Button>
          <Button variant="outline" size="sm" onClick={openEdit}><Edit className="h-3 w-3 mr-1" />{t("edit")}</Button>
        </div>
      </div>
      <PageHeader title={`Bin ${bin.code}`} description={`${(bin as any).warehouses?.name} · ${(bin as any).wms_zones?.name}`} icon={Package} />

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t("binType")}</CardTitle></CardHeader><CardContent className="text-lg font-semibold capitalize">{bin.bin_type}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t("level")} / {t("accessibilityScore")}</CardTitle></CardHeader><CardContent className="text-lg font-semibold">L{bin.level} · Score {bin.accessibility_score}/10</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t("capacity")}</CardTitle></CardHeader><CardContent className="text-lg font-semibold">{bin.max_units ?? "∞"} units · {bin.max_weight ?? "∞"} kg · {bin.max_volume ?? "∞"} m³</CardContent></Card>
      </div>

      {/* Tabs: Contents + History */}
      <Tabs defaultValue="contents">
        <TabsList>
          <TabsTrigger value="contents">{t("currentContents")}</TabsTrigger>
          <TabsTrigger value="history"><History className="h-3 w-3 mr-1" />{t("movementHistory")}</TabsTrigger>
        </TabsList>

        <TabsContent value="contents">
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader><TableRow><TableHead>{t("product")}</TableHead><TableHead>SKU</TableHead><TableHead>{t("quantity")}</TableHead><TableHead>{t("status")}</TableHead><TableHead>{t("lot")}</TableHead><TableHead>{t("receivedAt")}</TableHead></TableRow></TableHeader>
                <TableBody>
                  {stock.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>
                  ) : stock.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.products?.name}</TableCell>
                      <TableCell className="font-mono text-xs">{s.products?.sku}</TableCell>
                      <TableCell>{s.quantity}</TableCell>
                      <TableCell><Badge variant={s.status === "available" ? "default" : "secondary"}>{s.status}</Badge></TableCell>
                      <TableCell>{s.lot_number || "—"}</TableCell>
                      <TableCell className="text-xs">{new Date(s.received_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader><TableRow><TableHead>#</TableHead><TableHead>{t("type")}</TableHead><TableHead>{t("product")}</TableHead><TableHead>{t("quantity")}</TableHead><TableHead>{t("status")}</TableHead><TableHead>{t("date")}</TableHead></TableRow></TableHeader>
                <TableBody>
                  {movementHistory.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>
                  ) : movementHistory.map((task: any) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-mono text-xs">{task.task_number}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{task.task_type}</Badge></TableCell>
                      <TableCell>{task.products?.name || "—"}</TableCell>
                      <TableCell>{task.quantity ?? "—"}</TableCell>
                      <TableCell><Badge variant={task.status === "completed" ? "default" : "outline"}>{task.status}</Badge></TableCell>
                      <TableCell className="text-xs">{new Date(task.completed_at || task.created_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Stock Adjustment Dialog */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("adjustStock")}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>{t("product")}</Label>
              <Select value={adjustForm.product_id} onValueChange={v => setAdjustForm(p => ({ ...p, product_id: v }))}>
                <SelectTrigger><SelectValue placeholder={t("selectProduct")} /></SelectTrigger>
                <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("quantity")} ({t("adjustmentHint")})</Label>
              <Input type="number" value={adjustForm.quantity} onChange={e => setAdjustForm(p => ({ ...p, quantity: Number(e.target.value) }))} />
            </div>
            <div>
              <Label>{t("reason")}</Label>
              <Textarea value={adjustForm.reason} onChange={e => setAdjustForm(p => ({ ...p, reason: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => adjustMutation.mutate()} disabled={!adjustForm.product_id || adjustForm.quantity === 0}>{t("confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("transferStock")}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>{t("selectProduct")}</Label>
              <Select value={transferForm.stock_id} onValueChange={v => setTransferForm(p => ({ ...p, stock_id: v }))}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{stock.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.products?.name} (qty: {s.quantity})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("targetBin")}</Label>
              <Select value={transferForm.to_bin_id} onValueChange={v => setTransferForm(p => ({ ...p, to_bin_id: v }))}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{allBins.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.code}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("quantity")}</Label>
              <Input type="number" min={1} value={transferForm.quantity} onChange={e => setTransferForm(p => ({ ...p, quantity: Number(e.target.value) }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => transferMutation.mutate()} disabled={!transferForm.stock_id || !transferForm.to_bin_id || transferForm.quantity <= 0}>{t("createTask")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Bin Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("editBin")}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t("maxUnits")}</Label><Input type="number" min={0} value={editForm.max_units} onChange={e => setEditForm(p => ({ ...p, max_units: Number(e.target.value) }))} /></div>
              <div><Label>{t("maxWeight")} (kg)</Label><Input type="number" min={0} value={editForm.max_weight} onChange={e => setEditForm(p => ({ ...p, max_weight: Number(e.target.value) }))} /></div>
              <div><Label>{t("maxVolume")} (m³)</Label><Input type="number" min={0} value={editForm.max_volume} onChange={e => setEditForm(p => ({ ...p, max_volume: Number(e.target.value) }))} /></div>
              <div><Label>{t("accessibilityScore")} (1-10)</Label><Input type="number" min={1} max={10} value={editForm.accessibility_score} onChange={e => setEditForm(p => ({ ...p, accessibility_score: Number(e.target.value) }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => editMutation.mutate()}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
