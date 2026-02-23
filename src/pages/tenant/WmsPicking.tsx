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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { ShoppingCart, Plus, Play, CheckCircle, Printer, Package, ClipboardCheck, BarChart3 } from "lucide-react";

export default function WmsPicking() {
  const { t, locale } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [createWaveOpen, setCreateWaveOpen] = useState(false);
  const [waveWarehouse, setWaveWarehouse] = useState("");
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [confirmPickOpen, setConfirmPickOpen] = useState(false);
  const [confirmTask, setConfirmTask] = useState<any>(null);
  const [actualQty, setActualQty] = useState(0);

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("warehouses").select("id, name").eq("tenant_id", tenantId!).eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: waves = [] } = useQuery({
    queryKey: ["wms-pick-waves", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("wms_pick_waves").select("*, warehouses(name)").eq("tenant_id", tenantId!).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: pickTasks = [] } = useQuery({
    queryKey: ["wms-pick-tasks", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("wms_tasks").select("*, products(name), from_bin:wms_bins!wms_tasks_from_bin_id_fkey(code), to_bin:wms_bins!wms_tasks_to_bin_id_fkey(code)").eq("tenant_id", tenantId!).eq("task_type", "pick").order("priority").order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: salesOrders = [] } = useQuery({
    queryKey: ["confirmed-sales-orders", tenantId, waveWarehouse],
    queryFn: async () => {
      const { data, error } = await supabase.from("sales_orders").select("id, order_number, partner_id, partners(name), total").eq("tenant_id", tenantId!).eq("status", "confirmed");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && !!waveWarehouse,
  });

  // Stats
  const totalLines = pickTasks.length;
  const pickedLines = pickTasks.filter((t: any) => t.status === "completed").length;
  const remainingLines = pickTasks.filter((t: any) => t.status !== "completed" && t.status !== "cancelled").length;
  const pickRate = totalLines > 0 ? Math.round((pickedLines / totalLines) * 100) : 0;

  const stats = [
    { label: locale === "sr" ? "Ukupno linija" : "Total Lines", value: totalLines, icon: Package, color: "text-primary" },
    { label: locale === "sr" ? "Pokupljeno" : "Picked", value: pickedLines, icon: CheckCircle, color: "text-primary" },
    { label: locale === "sr" ? "Preostalo" : "Remaining", value: remainingLines, icon: ClipboardCheck, color: "text-accent" },
    { label: t("pickCompletion"), value: `${pickRate}%`, icon: BarChart3, color: "text-primary" },
  ];

  const createWaveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedOrders.size) throw new Error("No orders selected");
      const { data: wave, error } = await supabase.from("wms_pick_waves").insert({
        tenant_id: tenantId!, warehouse_id: waveWarehouse, status: "draft",
      }).select("id").single();
      if (error) throw error;

      // Link orders
      const orderLinks = Array.from(selectedOrders).map(soId => ({
        tenant_id: tenantId!, wave_id: wave.id, order_id: soId,
      }));
      await supabase.from("wms_pick_wave_orders").insert(orderLinks);

      // Generate pick tasks from order lines
      for (const soId of selectedOrders) {
        const { data: soLines } = await supabase.from("sales_order_lines").select("product_id, quantity").eq("sales_order_id", soId);
        if (!soLines) continue;
        for (const line of soLines) {
          const { data: stock } = await supabase.from("wms_bin_stock").select("bin_id, quantity").eq("product_id", line.product_id).eq("warehouse_id", waveWarehouse).eq("tenant_id", tenantId!).eq("status", "available").order("quantity", { ascending: false }).limit(1);
          const fromBinId = stock?.[0]?.bin_id;
          await supabase.from("wms_tasks").insert({
            tenant_id: tenantId!, warehouse_id: waveWarehouse, task_type: "pick",
            status: "pending", priority: 3, product_id: line.product_id,
            quantity: line.quantity, from_bin_id: fromBinId || null, created_by: user?.id,
          });
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wms-pick-waves"] });
      qc.invalidateQueries({ queryKey: ["wms-pick-tasks"] });
      toast({ title: t("success"), description: t("createPickWave") });
      setCreateWaveOpen(false);
      setSelectedOrders(new Set());
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const waveTransition = useMutation({
    mutationFn: async ({ waveId, newStatus }: { waveId: string; newStatus: "draft" | "released" | "in_progress" | "completed" }) => {
      const { error } = await supabase.from("wms_pick_waves").update({ status: newStatus }).eq("id", waveId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wms-pick-waves"] });
      toast({ title: t("success") });
    },
  });

  const confirmPickMutation = useMutation({
    mutationFn: async () => {
      if (!confirmTask) return;
      await supabase.from("wms_tasks").update({
        status: "completed", completed_at: new Date().toISOString(),
      }).eq("id", confirmTask.id);
      // Adjust bin stock
      if (confirmTask.from_bin_id) {
        const { data: stock } = await supabase.from("wms_bin_stock").select("id, quantity").eq("bin_id", confirmTask.from_bin_id).eq("product_id", confirmTask.product_id).eq("tenant_id", tenantId!).limit(1);
        if (stock?.[0]) {
          const newQty = Math.max(0, stock[0].quantity - actualQty);
          if (newQty === 0) {
            await supabase.from("wms_bin_stock").delete().eq("id", stock[0].id);
          } else {
            await supabase.from("wms_bin_stock").update({ quantity: newQty }).eq("id", stock[0].id);
          }
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wms-pick-tasks"] });
      qc.invalidateQueries({ queryKey: ["wms-bin-stock"] });
      toast({ title: t("success"), description: t("confirmPick") });
      setConfirmPickOpen(false);
      setConfirmTask(null);
    },
  });

  const printPickList = () => {
    const activeTasks = pickTasks.filter((t: any) => t.status === "pending" || t.status === "in_progress");
    const content = activeTasks.map((t: any) => `${t.task_number}\t${t.products?.name}\t${t.quantity}\t${t.from_bin?.code || "—"}`).join("\n");
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(`<pre style="font-family:monospace;font-size:12px;">Pick List\n${"=".repeat(60)}\nTask#\tProduct\tQty\tFrom Bin\n${"-".repeat(60)}\n${content}</pre>`);
      w.document.close();
      w.print();
    }
  };

  const statusBadge = (status: string) => {
    const v: Record<string, "default" | "secondary" | "outline" | "destructive"> = { draft: "outline", released: "secondary", in_progress: "default", completed: "default" };
    return <Badge variant={v[status] || "outline"}>{status.replace("_", " ")}</Badge>;
  };

  const toggleOrder = (id: string) => {
    setSelectedOrders(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("wmsPicking")} description={t("wmsPickingDesc")} icon={ShoppingCart}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={printPickList}><Printer className="h-4 w-4 mr-1" />{t("printPickList")}</Button>
            <Button size="sm" onClick={() => { setWaveWarehouse(""); setSelectedOrders(new Set()); setCreateWaveOpen(true); }}><Plus className="h-4 w-4 mr-1" />{t("createPickWave")}</Button>
          </div>
        } />

      <StatsBar stats={stats} />

      <Card>
        <CardHeader><CardTitle>{t("pickWaves")}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>#</TableHead><TableHead>{t("warehouse")}</TableHead><TableHead>{t("status")}</TableHead><TableHead>{t("date")}</TableHead><TableHead>{t("actions")}</TableHead></TableRow></TableHeader>
            <TableBody>
              {waves.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>
              ) : waves.map((w: any) => (
                <TableRow key={w.id}>
                  <TableCell className="font-mono text-xs">{w.wave_number}</TableCell>
                  <TableCell>{w.warehouses?.name}</TableCell>
                  <TableCell>{statusBadge(w.status)}</TableCell>
                  <TableCell className="text-xs">{new Date(w.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {w.status === "draft" && <Button size="sm" variant="outline" onClick={() => waveTransition.mutate({ waveId: w.id, newStatus: "released" })}>{t("releaseWave")}</Button>}
                      {w.status === "released" && <Button size="sm" variant="outline" onClick={() => waveTransition.mutate({ waveId: w.id, newStatus: "in_progress" })}><Play className="h-3 w-3 mr-1" />{t("startWave")}</Button>}
                      {w.status === "in_progress" && <Button size="sm" onClick={() => waveTransition.mutate({ waveId: w.id, newStatus: "completed" })}><CheckCircle className="h-3 w-3 mr-1" />{t("completeWave")}</Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("activePickTasks")}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>#</TableHead><TableHead>{t("product")}</TableHead><TableHead>{t("quantity")}</TableHead><TableHead>From Bin</TableHead><TableHead>{t("status")}</TableHead><TableHead className="w-24" /></TableRow></TableHeader>
            <TableBody>
              {pickTasks.filter((t: any) => t.status !== "cancelled").length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>
              ) : pickTasks.filter((t: any) => t.status !== "cancelled").map((task: any) => (
                <TableRow key={task.id}>
                  <TableCell className="font-mono text-xs">{task.task_number}</TableCell>
                  <TableCell>{task.products?.name || "—"}</TableCell>
                  <TableCell>{task.quantity}</TableCell>
                  <TableCell className="font-mono text-xs">{task.from_bin?.code || "—"}</TableCell>
                  <TableCell><Badge variant={task.status === "completed" ? "default" : task.status === "in_progress" ? "secondary" : "outline"}>{task.status.replace("_", " ")}</Badge></TableCell>
                  <TableCell>
                    {(task.status === "pending" || task.status === "in_progress") && (
                      <Button size="sm" variant="outline" onClick={() => { setConfirmTask(task); setActualQty(task.quantity); setConfirmPickOpen(true); }}>
                        <CheckCircle className="h-3 w-3 mr-1" />{t("confirmPick")}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Pick Wave */}
      <Dialog open={createWaveOpen} onOpenChange={setCreateWaveOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t("createPickWave")}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div><Label>{t("warehouse")}</Label>
              <Select value={waveWarehouse} onValueChange={setWaveWarehouse}>
                <SelectTrigger><SelectValue placeholder={t("selectWarehouse")} /></SelectTrigger>
                <SelectContent>{warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {waveWarehouse && (
              <div className="space-y-2">
                <Label>{locale === "sr" ? "Izaberite porudzbine" : "Select Sales Orders"}</Label>
                {salesOrders.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("noResults")}</p>
                ) : salesOrders.map((so: any) => (
                  <label key={so.id} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted cursor-pointer text-sm">
                    <Checkbox checked={selectedOrders.has(so.id)} onCheckedChange={() => toggleOrder(so.id)} />
                    <span className="font-mono">{so.order_number}</span>
                    <span className="text-muted-foreground">{so.partners?.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateWaveOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => createWaveMutation.mutate()} disabled={!waveWarehouse || !selectedOrders.size || createWaveMutation.isPending}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Pick */}
      <Dialog open={confirmPickOpen} onOpenChange={setConfirmPickOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("confirmPick")}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm">{confirmTask?.products?.name} — {locale === "sr" ? "Očekivano" : "Expected"}: <strong>{confirmTask?.quantity}</strong></p>
            <div><Label>{t("actualQuantity")}</Label>
              <Input type="number" min={0} max={confirmTask?.quantity || 999} value={actualQty} onChange={e => setActualQty(Number(e.target.value))} />
              {actualQty < (confirmTask?.quantity || 0) && (
                <p className="text-xs text-accent mt-1">{locale === "sr" ? "Delimično pokupljeno" : "Partial pick"}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmPickOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => confirmPickMutation.mutate()} disabled={confirmPickMutation.isPending}>{t("confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
