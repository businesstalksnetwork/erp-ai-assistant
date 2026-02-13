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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, ClipboardCheck, CheckCircle } from "lucide-react";

const COUNT_TYPES = ["scheduled", "trigger", "abc"] as const;

export default function WmsCycleCounts() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [createDialog, setCreateDialog] = useState(false);
  const [warehouseId, setWarehouseId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [countType, setCountType] = useState<typeof COUNT_TYPES[number]>("scheduled");
  const [selectedCountId, setSelectedCountId] = useState<string>("");
  const [countValues, setCountValues] = useState<Record<string, number>>({});

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("warehouses").select("id, name").eq("tenant_id", tenantId!).eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: zones = [] } = useQuery({
    queryKey: ["wms-zones-for-count", tenantId, warehouseId],
    queryFn: async () => {
      const { data, error } = await supabase.from("wms_zones").select("id, name").eq("warehouse_id", warehouseId).eq("tenant_id", tenantId!);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && !!warehouseId,
  });

  const { data: counts = [] } = useQuery({
    queryKey: ["wms-cycle-counts", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("wms_cycle_counts").select("*, warehouses(name), wms_zones(name)").eq("tenant_id", tenantId!).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: countLines = [] } = useQuery({
    queryKey: ["wms-cycle-count-lines", selectedCountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("wms_cycle_count_lines").select("*, wms_bins(code), products(name, sku)").eq("count_id", selectedCountId).order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCountId,
  });

  const createCountMutation = useMutation({
    mutationFn: async () => {
      // Create count
      const { data: count, error: cErr } = await supabase.from("wms_cycle_counts").insert({
        tenant_id: tenantId!, warehouse_id: warehouseId, count_type: countType,
        zone_id: zoneId || null, status: "planned",
      }).select("id").single();
      if (cErr) throw cErr;

      // Auto-generate lines from bin stock
      let stockQuery = supabase.from("wms_bin_stock").select("bin_id, product_id, quantity").eq("tenant_id", tenantId!).eq("warehouse_id", warehouseId);
      if (zoneId) {
        const { data: binIds } = await supabase.from("wms_bins").select("id").eq("zone_id", zoneId).eq("tenant_id", tenantId!);
        if (binIds?.length) {
          stockQuery = stockQuery.in("bin_id", binIds.map((b: any) => b.id));
        }
      }
      const { data: stockItems } = await stockQuery;

      if (stockItems?.length) {
        const lineInserts = stockItems.map((s: any) => ({
          tenant_id: tenantId!, count_id: count.id, bin_id: s.bin_id,
          product_id: s.product_id, expected_quantity: s.quantity, status: "pending" as const,
        }));
        await supabase.from("wms_cycle_count_lines").insert(lineInserts);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wms-cycle-counts"] });
      toast({ title: t("success") });
      setCreateDialog(false);
    },
    onError: () => toast({ title: t("error"), variant: "destructive" }),
  });

  const submitCountMutation = useMutation({
    mutationFn: async (lineId: string) => {
      const qty = countValues[lineId];
      if (qty === undefined) return;
      const { error } = await supabase.from("wms_cycle_count_lines").update({
        counted_quantity: qty, status: "counted", counted_by: user?.id, counted_at: new Date().toISOString(),
      }).eq("id", lineId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wms-cycle-count-lines"] });
      toast({ title: t("success") });
    },
  });

  const statusBadge = (status: string) => {
    const v: Record<string, "default" | "secondary" | "outline" | "destructive"> = { planned: "outline", in_progress: "secondary", completed: "default", reconciled: "default" };
    return <Badge variant={v[status] || "outline"}>{status.replace("_", " ")}</Badge>;
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("wmsCycleCounts")} description={t("wmsCycleCountsDesc")} icon={ClipboardCheck}
        actions={<Button onClick={() => { setWarehouseId(""); setZoneId(""); setCreateDialog(true); }}><Plus className="h-4 w-4 mr-1" />{t("newCount")}</Button>} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="text-base">{t("countSessions")}</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {counts.map((c: any) => (
              <button
                key={c.id}
                onClick={() => setSelectedCountId(c.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm text-left transition-colors ${selectedCountId === c.id ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}
              >
                <div>
                  <div className="font-mono font-medium">{c.count_number}</div>
                  <div className="text-xs text-muted-foreground">{c.warehouses?.name} · {c.count_type}</div>
                </div>
                {statusBadge(c.status)}
              </button>
            ))}
            {counts.length === 0 && <p className="text-sm text-center text-muted-foreground py-4">{t("noResults")}</p>}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">{t("countLines")}</CardTitle></CardHeader>
          <CardContent>
            {!selectedCountId ? (
              <p className="text-center text-muted-foreground py-8">{t("selectCount")}</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Bin</TableHead><TableHead>{t("product")}</TableHead><TableHead>{t("expected")}</TableHead><TableHead>{t("counted")}</TableHead><TableHead>{t("difference")}</TableHead><TableHead>{t("status")}</TableHead><TableHead className="w-24" /></TableRow></TableHeader>
                <TableBody>
                  {countLines.map((l: any) => (
                    <TableRow key={l.id} className={l.variance && l.variance !== 0 ? "bg-destructive/5" : ""}>
                      <TableCell className="font-mono text-xs">{l.wms_bins?.code}</TableCell>
                      <TableCell>{l.products?.name}</TableCell>
                      <TableCell>{l.expected_quantity}</TableCell>
                      <TableCell>
                        {l.status === "pending" ? (
                          <Input type="number" className="w-20 h-8" value={countValues[l.id] ?? ""} onChange={e => setCountValues(prev => ({ ...prev, [l.id]: Number(e.target.value) }))} />
                        ) : l.counted_quantity}
                      </TableCell>
                      <TableCell className={l.variance && l.variance !== 0 ? "text-destructive font-medium" : ""}>{l.variance ?? "—"}</TableCell>
                      <TableCell><Badge variant={l.status === "counted" ? "default" : "outline"}>{l.status}</Badge></TableCell>
                      <TableCell>
                        {l.status === "pending" && countValues[l.id] !== undefined && (
                          <Button size="sm" onClick={() => submitCountMutation.mutate(l.id)}><CheckCircle className="h-3 w-3 mr-1" />{t("submit")}</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {countLines.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("newCount")}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div><Label>{t("warehouse")}</Label>
              <Select value={warehouseId} onValueChange={v => { setWarehouseId(v); setZoneId(""); }}>
                <SelectTrigger><SelectValue placeholder={t("selectWarehouse")} /></SelectTrigger>
                <SelectContent>{warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>{t("zones")} ({t("optional")})</Label>
              <Select value={zoneId || "all"} onValueChange={v => setZoneId(v === "all" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allZones")}</SelectItem>
                  {zones.map((z: any) => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>{t("countType")}</Label>
              <Select value={countType} onValueChange={(v: any) => setCountType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{COUNT_TYPES.map(ct => <SelectItem key={ct} value={ct}>{ct}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialog(false)}>{t("cancel")}</Button>
            <Button onClick={() => createCountMutation.mutate()} disabled={!warehouseId || createCountMutation.isPending}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
