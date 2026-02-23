import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatsBar } from "@/components/shared/StatsBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Truck, Trash2, FileInput, Package, ClipboardCheck, XCircle } from "lucide-react";

interface ReceiveLine {
  product_id: string;
  product_name: string;
  quantity: number;
  lot_number?: string;
  expiry_date?: string;
}

export default function WmsReceiving() {
  const { t, locale } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [poDialogOpen, setPoDialogOpen] = useState(false);
  const [warehouseId, setWarehouseId] = useState("");
  const [lines, setLines] = useState<ReceiveLine[]>([]);
  const [lineProduct, setLineProduct] = useState("");
  const [lineQty, setLineQty] = useState(1);
  const [lineLot, setLineLot] = useState("");
  const [lineExpiry, setLineExpiry] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [supplierRef, setSupplierRef] = useState("");
  const [deliveryNoteNum, setDeliveryNoteNum] = useState("");
  const [qualityHold, setQualityHold] = useState(false);

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("warehouses").select("id, name").eq("tenant_id", tenantId!).eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-list", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name, sku").eq("tenant_id", tenantId!).eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: recentTasks = [] } = useQuery({
    queryKey: ["wms-receiving-tasks", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("wms_tasks").select("*, products(name), warehouses(name), to_bin:wms_bins!wms_tasks_to_bin_id_fkey(code)").eq("tenant_id", tenantId!).in("task_type", ["receive", "putaway"]).order("created_at", { ascending: false }).limit(30);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: pendingPOs = [] } = useQuery({
    queryKey: ["pending-pos", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("purchase_orders").select("id, order_number, partner_id, partners(name)").eq("tenant_id", tenantId!).eq("status", "confirmed");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // Stats
  const todayReceivings = recentTasks.filter((t: any) => t.task_type === "receive" && new Date(t.created_at).toDateString() === new Date().toDateString()).length;
  const pendingPutaways = recentTasks.filter((t: any) => t.task_type === "putaway" && t.status === "pending").length;
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 7);
  const weekItems = recentTasks.filter((t: any) => t.task_type === "receive" && new Date(t.created_at) >= weekStart).reduce((s: number, t: any) => s + (t.quantity || 0), 0);

  const stats = [
    { label: locale === "sr" ? "Prijemi danas" : "Receivings Today", value: todayReceivings, icon: Truck, color: "text-primary" },
    { label: locale === "sr" ? "Čeka raspored" : "Pending Putaways", value: pendingPutaways, icon: ClipboardCheck, color: "text-accent" },
    { label: locale === "sr" ? "Stavki ove nedelje" : "Items This Week", value: weekItems, icon: Package, color: "text-primary" },
  ];

  const importFromPO = async (poId: string) => {
    const { data: poLines } = await supabase.from("purchase_order_lines").select("product_id, products(name), quantity").eq("purchase_order_id", poId);
    if (poLines?.length) {
      setLines(prev => [...prev, ...poLines.map((l: any) => ({ product_id: l.product_id, product_name: l.products?.name || "—", quantity: l.quantity }))]);
    }
    setPoDialogOpen(false);
    toast({ title: t("success"), description: `${poLines?.length || 0} lines imported` });
  };

  const receiveMutation = useMutation({
    mutationFn: async () => {
      const { data: zones } = await supabase.from("wms_zones").select("id").eq("warehouse_id", warehouseId).eq("tenant_id", tenantId!).eq("zone_type", "receiving").limit(1);
      if (!zones?.length) throw new Error("No receiving zone configured for this warehouse");
      const zoneId = zones[0].id;
      const { data: bins } = await supabase.from("wms_bins").select("id").eq("zone_id", zoneId).eq("tenant_id", tenantId!).eq("is_active", true).limit(1);
      if (!bins?.length) throw new Error("No bins in the receiving zone");
      const receivingBinId = bins[0].id;
      const stockStatus = qualityHold ? "on_hold" : "available";

      for (const line of lines) {
        await supabase.from("wms_bin_stock").insert({
          tenant_id: tenantId!, bin_id: receivingBinId, product_id: line.product_id,
          warehouse_id: warehouseId, quantity: line.quantity, status: stockStatus,
          lot_number: line.lot_number || null,
        });
        await supabase.from("wms_tasks").insert({
          tenant_id: tenantId!, warehouse_id: warehouseId, task_type: "receive",
          status: "completed", product_id: line.product_id, quantity: line.quantity,
          to_bin_id: receivingBinId, completed_at: new Date().toISOString(), created_by: user?.id,
        });
        const { data: rules } = await supabase.from("wms_putaway_rules").select("target_zone_id").eq("warehouse_id", warehouseId).eq("tenant_id", tenantId!).order("priority").limit(1);
        let targetZoneId = rules?.[0]?.target_zone_id;
        if (!targetZoneId) {
          const { data: reserveZones } = await supabase.from("wms_zones").select("id").eq("warehouse_id", warehouseId).eq("tenant_id", tenantId!).eq("zone_type", "reserve").limit(1);
          targetZoneId = reserveZones?.[0]?.id;
        }
        if (targetZoneId) {
          const { data: targetBins } = await supabase.from("wms_bins").select("id").eq("zone_id", targetZoneId).eq("tenant_id", tenantId!).eq("is_active", true).order("sort_order").limit(1);
          if (targetBins?.length) {
            await supabase.from("wms_tasks").insert({
              tenant_id: tenantId!, warehouse_id: warehouseId, task_type: "putaway",
              status: "pending", priority: 2, product_id: line.product_id, quantity: line.quantity,
              from_bin_id: receivingBinId, to_bin_id: targetBins[0].id, created_by: user?.id,
            });
          }
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wms-receiving-tasks"] });
      qc.invalidateQueries({ queryKey: ["wms-tasks"] });
      qc.invalidateQueries({ queryKey: ["wms-bin-stock"] });
      toast({ title: t("success"), description: t("receivingConfirmed") });
      setDialogOpen(false);
      setLines([]);
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const cancelMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const task = recentTasks.find((t: any) => t.id === taskId) as any;
      if (!task) return;
      await supabase.from("wms_tasks").update({ status: "cancelled" }).eq("id", taskId);
      if (task.task_type === "receive" && task.to_bin_id && task.product_id) {
        await supabase.from("wms_bin_stock").delete().eq("bin_id", task.to_bin_id).eq("product_id", task.product_id).eq("tenant_id", tenantId!);
      }
      // Cancel related putaway tasks
      await supabase.from("wms_tasks").update({ status: "cancelled" }).eq("tenant_id", tenantId!).eq("task_type", "putaway").eq("product_id", task.product_id).eq("from_bin_id", task.to_bin_id).eq("status", "pending");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wms-receiving-tasks"] });
      qc.invalidateQueries({ queryKey: ["wms-bin-stock"] });
      toast({ title: t("success"), description: t("cancelReceiving") });
    },
  });

  const addLine = () => {
    const prod = products.find((p: any) => p.id === lineProduct);
    if (!prod || lineQty <= 0) return;
    setLines(prev => [...prev, { product_id: prod.id, product_name: prod.name, quantity: lineQty, lot_number: lineLot || undefined, expiry_date: lineExpiry || undefined }]);
    setLineProduct(""); setLineQty(1); setLineLot(""); setLineExpiry("");
  };

  const openDialog = () => {
    setLines([]); setWarehouseId(""); setPoNumber(""); setSupplierRef(""); setDeliveryNoteNum(""); setQualityHold(false);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("wmsReceiving")} description={t("wmsReceivingDesc")} icon={Truck}
        actions={<Button onClick={openDialog}><Plus className="h-4 w-4 mr-1" />{t("newReceiving")}</Button>} />

      <StatsBar stats={stats} />

      <Card>
        <CardHeader><CardTitle>{t("recentReceivings")}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>#</TableHead><TableHead>{t("type")}</TableHead><TableHead>{t("product")}</TableHead><TableHead>{t("quantity")}</TableHead><TableHead>{t("warehouse")}</TableHead><TableHead>Bin</TableHead><TableHead>{t("status")}</TableHead><TableHead>{t("date")}</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
            <TableBody>
              {recentTasks.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>
              ) : recentTasks.map((task: any) => (
                <TableRow key={task.id}>
                  <TableCell className="font-mono text-xs">{task.task_number}</TableCell>
                  <TableCell><Badge variant="outline">{task.task_type}</Badge></TableCell>
                  <TableCell>{task.products?.name || "—"}</TableCell>
                  <TableCell>{task.quantity}</TableCell>
                  <TableCell>{task.warehouses?.name}</TableCell>
                  <TableCell className="font-mono text-xs">{task.to_bin?.code || "—"}</TableCell>
                  <TableCell><Badge variant={task.status === "completed" ? "default" : task.status === "cancelled" ? "destructive" : "secondary"}>{task.status}</Badge></TableCell>
                  <TableCell className="text-xs">{new Date(task.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {task.status === "completed" && task.task_type === "receive" && (
                      <Button variant="ghost" size="icon" onClick={() => cancelMutation.mutate(task.id)} title={t("cancelReceiving")}>
                        <XCircle className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Receiving Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("newReceiving")}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>{t("warehouse")}</Label>
                <Select value={warehouseId} onValueChange={setWarehouseId}>
                  <SelectTrigger><SelectValue placeholder={t("selectWarehouse")} /></SelectTrigger>
                  <SelectContent>{warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>{t("poNumberLabel")} ({t("optional")})</Label>
                <Input value={poNumber} onChange={e => setPoNumber(e.target.value)} placeholder="PO-001" />
              </div>
              <div><Label>{t("supplierReference")} ({t("optional")})</Label>
                <Input value={supplierRef} onChange={e => setSupplierRef(e.target.value)} /></div>
              <div><Label>{t("deliveryNote")} ({t("optional")})</Label>
                <Input value={deliveryNoteNum} onChange={e => setDeliveryNoteNum(e.target.value)} /></div>
            </div>

            <div className="flex items-center gap-3">
              <Switch checked={qualityHold} onCheckedChange={setQualityHold} />
              <Label className="text-sm">{t("qualityHold")} — {locale === "sr" ? "Zadrži zalihe na čekanju" : "Hold stock pending inspection"}</Label>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPoDialogOpen(true)} disabled={!pendingPOs.length}>
                <FileInput className="h-3.5 w-3.5 mr-1" />{t("importFromPo")}
              </Button>
            </div>

            <div className="border rounded-md p-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("addLine")}</p>
              <div className="flex gap-2 items-end flex-wrap">
                <div className="flex-1 min-w-[160px]"><Label className="text-xs">{t("product")}</Label>
                  <Select value={lineProduct} onValueChange={setLineProduct}>
                    <SelectTrigger className="h-9"><SelectValue placeholder={t("selectProduct")} /></SelectTrigger>
                    <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="w-20"><Label className="text-xs">{t("quantity")}</Label><Input className="h-9" type="number" min={1} value={lineQty} onChange={e => setLineQty(Number(e.target.value))} /></div>
                <div className="w-28"><Label className="text-xs">{t("lotNumber")}</Label><Input className="h-9" value={lineLot} onChange={e => setLineLot(e.target.value)} placeholder="LOT-001" /></div>
                <div className="w-32"><Label className="text-xs">{t("expiryDate")}</Label><Input className="h-9" type="date" value={lineExpiry} onChange={e => setLineExpiry(e.target.value)} /></div>
                <Button size="sm" className="h-9" onClick={addLine} disabled={!lineProduct || lineQty <= 0}><Plus className="h-4 w-4" /></Button>
              </div>
            </div>

            {lines.length > 0 && (
              <div className="border rounded-md">
                <Table>
                  <TableHeader><TableRow><TableHead>{t("product")}</TableHead><TableHead>{t("quantity")}</TableHead><TableHead>{t("lotNumber")}</TableHead><TableHead>{t("expiryDate")}</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
                  <TableBody>
                    {lines.map((l, i) => (
                      <TableRow key={i}>
                        <TableCell>{l.product_name}</TableCell>
                        <TableCell>{l.quantity}</TableCell>
                        <TableCell className="text-xs">{l.lot_number || "—"}</TableCell>
                        <TableCell className="text-xs">{l.expiry_date || "—"}</TableCell>
                        <TableCell><Button variant="ghost" size="icon" onClick={() => setLines(prev => prev.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3 text-destructive" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => receiveMutation.mutate()} disabled={!warehouseId || lines.length === 0 || receiveMutation.isPending}>
              {t("confirmReceipt")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import from PO Dialog */}
      <Dialog open={poDialogOpen} onOpenChange={setPoDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("importFromPo")}</DialogTitle></DialogHeader>
          <div className="space-y-2 py-4">
            {pendingPOs.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm">{t("noResults")}</p>
            ) : pendingPOs.map((po: any) => (
              <button key={po.id} onClick={() => importFromPO(po.id)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors text-left">
                <div>
                  <div className="font-mono font-medium">{po.order_number}</div>
                  <div className="text-xs text-muted-foreground">{po.partners?.name}</div>
                </div>
                <Badge variant="secondary">{t("confirmed")}</Badge>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
