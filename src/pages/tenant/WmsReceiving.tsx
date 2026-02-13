import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Truck, Trash2 } from "lucide-react";

interface ReceiveLine {
  product_id: string;
  product_name: string;
  quantity: number;
}

export default function WmsReceiving() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [warehouseId, setWarehouseId] = useState("");
  const [lines, setLines] = useState<ReceiveLine[]>([]);
  const [lineProduct, setLineProduct] = useState("");
  const [lineQty, setLineQty] = useState(1);

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
      const { data, error } = await supabase.from("wms_tasks").select("*, products(name), warehouses(name), to_bin:wms_bins!wms_tasks_to_bin_id_fkey(code)").eq("tenant_id", tenantId!).in("task_type", ["receive", "putaway"]).order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const receiveMutation = useMutation({
    mutationFn: async () => {
      // Find or get the receiving zone's first bin
      const { data: zones } = await supabase.from("wms_zones").select("id").eq("warehouse_id", warehouseId).eq("tenant_id", tenantId!).eq("zone_type", "receiving").limit(1);
      if (!zones?.length) throw new Error("No receiving zone configured for this warehouse");
      const zoneId = zones[0].id;

      const { data: bins } = await supabase.from("wms_bins").select("id").eq("zone_id", zoneId).eq("tenant_id", tenantId!).eq("is_active", true).limit(1);
      if (!bins?.length) throw new Error("No bins in the receiving zone");
      const receivingBinId = bins[0].id;

      // Create bin stock entries in receiving bin
      for (const line of lines) {
        const { error: stockError } = await supabase.from("wms_bin_stock").insert({
          tenant_id: tenantId!, bin_id: receivingBinId, product_id: line.product_id,
          warehouse_id: warehouseId, quantity: line.quantity, status: "available",
        });
        if (stockError) throw stockError;

        // Create receive task (already completed)
        const { error: taskError } = await supabase.from("wms_tasks").insert({
          tenant_id: tenantId!, warehouse_id: warehouseId, task_type: "receive",
          status: "completed", product_id: line.product_id, quantity: line.quantity,
          to_bin_id: receivingBinId, completed_at: new Date().toISOString(), created_by: user?.id,
        });
        if (taskError) throw taskError;

        // Auto-generate putaway task
        // Find target zone via putaway rules, fallback to reserve zone
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

  const addLine = () => {
    const prod = products.find((p: any) => p.id === lineProduct);
    if (!prod || lineQty <= 0) return;
    setLines(prev => [...prev, { product_id: prod.id, product_name: prod.name, quantity: lineQty }]);
    setLineProduct("");
    setLineQty(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("wmsReceiving")} description={t("wmsReceivingDesc")} icon={Truck}
        actions={<Button onClick={() => { setLines([]); setWarehouseId(""); setDialogOpen(true); }}><Plus className="h-4 w-4 mr-1" />{t("newReceiving")}</Button>} />

      <Card>
        <CardHeader><CardTitle>{t("recentReceivings")}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>#</TableHead><TableHead>{t("type")}</TableHead><TableHead>{t("product")}</TableHead><TableHead>{t("quantity")}</TableHead><TableHead>{t("warehouse")}</TableHead><TableHead>Bin</TableHead><TableHead>{t("status")}</TableHead><TableHead>{t("date")}</TableHead></TableRow></TableHeader>
            <TableBody>
              {recentTasks.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>
              ) : recentTasks.map((task: any) => (
                <TableRow key={task.id}>
                  <TableCell className="font-mono text-xs">{task.task_number}</TableCell>
                  <TableCell><Badge variant="outline">{task.task_type}</Badge></TableCell>
                  <TableCell>{task.products?.name || "—"}</TableCell>
                  <TableCell>{task.quantity}</TableCell>
                  <TableCell>{task.warehouses?.name}</TableCell>
                  <TableCell className="font-mono text-xs">{task.to_bin?.code || "—"}</TableCell>
                  <TableCell><Badge variant={task.status === "completed" ? "default" : "secondary"}>{task.status}</Badge></TableCell>
                  <TableCell className="text-xs">{new Date(task.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t("newReceiving")}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div><Label>{t("warehouse")}</Label>
              <Select value={warehouseId} onValueChange={setWarehouseId}>
                <SelectTrigger><SelectValue placeholder={t("selectWarehouse")} /></SelectTrigger>
                <SelectContent>{warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 items-end">
              <div className="flex-1"><Label>{t("product")}</Label>
                <Select value={lineProduct} onValueChange={setLineProduct}>
                  <SelectTrigger><SelectValue placeholder={t("selectProduct")} /></SelectTrigger>
                  <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="w-24"><Label>{t("quantity")}</Label><Input type="number" min={1} value={lineQty} onChange={e => setLineQty(Number(e.target.value))} /></div>
              <Button size="sm" onClick={addLine} disabled={!lineProduct || lineQty <= 0}><Plus className="h-4 w-4" /></Button>
            </div>
            {lines.length > 0 && (
              <div className="border rounded-md">
                <Table>
                  <TableHeader><TableRow><TableHead>{t("product")}</TableHead><TableHead>{t("quantity")}</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
                  <TableBody>
                    {lines.map((l, i) => (
                      <TableRow key={i}>
                        <TableCell>{l.product_name}</TableCell>
                        <TableCell>{l.quantity}</TableCell>
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
    </div>
  );
}
