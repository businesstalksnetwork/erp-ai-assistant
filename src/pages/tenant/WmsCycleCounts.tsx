import { useState, useMemo } from "react";
import { postWithRuleOrFallback } from "@/lib/postingHelper";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, ClipboardCheck, CheckCircle, Play, AlertTriangle, BarChart3, Package, Brain, Zap, Sparkles } from "lucide-react";

const COUNT_TYPES = ["scheduled", "trigger", "abc"] as const;

// --- Sub-components ---

function CountSessionList({ counts, selectedCountId, onSelect, t }: any) {
  const statusBadge = (status: string) => {
    const v: Record<string, "default" | "secondary" | "outline" | "destructive"> = { planned: "outline", in_progress: "secondary", completed: "default", reconciled: "default" };
    return <Badge variant={v[status] || "outline"}>{t(status as any)}</Badge>;
  };
  return (
    <Card className="lg:col-span-1">
      <CardHeader><CardTitle className="text-base">{t("countSessions")}</CardTitle></CardHeader>
      <CardContent className="space-y-1">
        {counts.map((c: any) => (
          <button key={c.id} onClick={() => onSelect(c.id)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm text-left transition-colors ${selectedCountId === c.id ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}>
            <div>
              <div className="font-mono font-medium">{c.count_number}</div>
              <div className="text-xs text-muted-foreground">
                {c.warehouses?.name} · {c.count_type}
                {c.ai_generated && <Sparkles className="inline h-3 w-3 ml-1 text-primary" />}
              </div>
            </div>
            {statusBadge(c.status)}
          </button>
        ))}
        {counts.length === 0 && <p className="text-sm text-center text-muted-foreground py-4">{t("noResults")}</p>}
      </CardContent>
    </Card>
  );
}

function CountLinesTable({ countLines, countValues, setCountValues, submitCountMutation, selectedCount, startCountMutation, allCounted, onReconcile, t, locale }: any) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{t("countLines")}</CardTitle>
          <div className="flex gap-2">
            {selectedCount?.status === "planned" && (
              <Button size="sm" variant="outline" onClick={() => startCountMutation.mutate()}>
                <Play className="h-3 w-3 mr-1" />{t("startCount")}
              </Button>
            )}
            {allCounted && selectedCount?.status !== "reconciled" && (
              <Button size="sm" onClick={onReconcile}>
                <CheckCircle className="h-3 w-3 mr-1" />{t("reconcile")}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bin</TableHead>
              <TableHead>{t("product")}</TableHead>
              <TableHead>ABC</TableHead>
              <TableHead>{t("expected")}</TableHead>
              <TableHead>{t("counted")}</TableHead>
              <TableHead>{locale === "sr" ? "Razlika" : "Variance"}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {countLines.map((l: any) => (
              <TableRow key={l.id} className={l.variance && l.variance !== 0 ? "bg-destructive/5" : ""}>
                <TableCell className="font-mono text-xs">{l.wms_bins?.code}</TableCell>
                <TableCell>{l.products?.name}</TableCell>
                <TableCell>
                  <Badge variant={l.abc_class === "A" ? "default" : l.abc_class === "B" ? "secondary" : "outline"}>
                    {l.abc_class || "—"}
                  </Badge>
                </TableCell>
                <TableCell>{l.expected_quantity}</TableCell>
                <TableCell>
                  {l.status === "pending" ? (
                    <Input type="number" className="w-20 h-8" value={countValues[l.id] ?? ""} onChange={e => setCountValues((prev: any) => ({ ...prev, [l.id]: Number(e.target.value) }))} />
                  ) : l.counted_quantity}
                </TableCell>
                <TableCell className={l.variance && l.variance !== 0 ? "text-destructive font-medium" : ""}>{l.variance ?? "—"}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Badge variant={l.status === "counted" ? "default" : "outline"}>{l.status}</Badge>
                    {l.auto_approved && <Zap className="h-3 w-3 text-primary" />}
                  </div>
                </TableCell>
                <TableCell>
                  {l.status === "pending" && countValues[l.id] !== undefined && (
                    <Button size="sm" onClick={() => submitCountMutation.mutate(l.id)}><CheckCircle className="h-3 w-3 mr-1" />{t("submit")}</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {countLines.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// --- Main Component ---

export default function WmsCycleCounts() {
  const { t, locale } = useLanguage();
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
  const [reconcileDialog, setReconcileDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("counts");

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
      const { data, error } = await supabase.from("wms_cycle_count_lines").select("*, wms_bins(code), products(name, sku)").eq("count_id", selectedCountId).order("ai_priority_score", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCountId,
  });

  // Velocity data for ABC classification
  const { data: velocityData = [] } = useQuery({
    queryKey: ["wms-velocity-cycle", tenantId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("wms_product_velocity").select("product_id, velocity_class, pick_count").eq("tenant_id", tenantId!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Schedule config
  const { data: scheduleConfig } = useQuery({
    queryKey: ["wms-schedule-config", tenantId, warehouseId],
    queryFn: async () => {
      const { data, error } = await supabase.from("wms_count_schedule_config")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("warehouse_id", warehouseId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && !!warehouseId,
  });

  const selectedCount = counts.find((c: any) => c.id === selectedCountId) as any;
  const velocityMap = useMemo(() => new Map<string, any>(velocityData.map((v: any) => [v.product_id, v])), [velocityData]);

  const totalCounted = countLines.filter((l: any) => l.status === "counted").length;
  const discrepancies = countLines.filter((l: any) => l.status === "counted" && l.variance !== 0 && l.variance !== null).length;
  const netAdj = countLines.filter((l: any) => l.status === "counted").reduce((s: number, l: any) => s + (l.variance || 0), 0);
  const allCounted = countLines.length > 0 && countLines.every((l: any) => l.status === "counted");
  const autoApprovedCount = countLines.filter((l: any) => l.auto_approved).length;

  const stats = selectedCountId ? [
    { label: locale === "sr" ? "Prebrojano" : "Counted", value: `${totalCounted}/${countLines.length}`, icon: Package, color: "text-primary" },
    { label: t("discrepancies"), value: discrepancies, icon: AlertTriangle, color: discrepancies > 0 ? "text-destructive" : "text-primary" },
    { label: t("netAdjustment"), value: netAdj, icon: BarChart3, color: netAdj !== 0 ? "text-accent" : "text-primary" },
    { label: locale === "sr" ? "Auto-odobreno" : "Auto-Approved", value: autoApprovedCount, icon: Zap, color: "text-primary" },
  ] : [];

  const createCountMutation = useMutation({
    mutationFn: async () => {
      const isAbc = countType === "abc";
      const { data: count, error: cErr } = await supabase.from("wms_cycle_counts").insert({
        tenant_id: tenantId!, warehouse_id: warehouseId, count_type: countType,
        zone_id: zoneId || null, status: "planned", ai_generated: isAbc,
      }).select("id").single();
      if (cErr) throw cErr;

      let stockQuery = supabase.from("wms_bin_stock").select("bin_id, product_id, quantity").eq("tenant_id", tenantId!).eq("warehouse_id", warehouseId);
      if (zoneId) {
        const { data: binIds } = await supabase.from("wms_bins").select("id").eq("zone_id", zoneId).eq("tenant_id", tenantId!);
        if (binIds?.length) stockQuery = stockQuery.in("bin_id", binIds.map((b: any) => b.id));
      }
      const { data: stockItems } = await stockQuery;
      if (stockItems?.length) {
        const lines = stockItems.map((s: any) => {
          const vel = velocityMap.get(s.product_id);
          const abcClass = vel?.velocity_class || "C";
          // AI priority: A=100, B=50, C=10 + stock value factor
          const priorityScore = (abcClass === "A" ? 100 : abcClass === "B" ? 50 : 10) + Math.min(s.quantity, 50);
          return {
            tenant_id: tenantId!, count_id: count.id, bin_id: s.bin_id,
            product_id: s.product_id, expected_quantity: s.quantity, status: "pending" as const,
            abc_class: abcClass, ai_priority_score: priorityScore,
          };
        });
        // Sort by priority for ABC counts, take top items
        if (isAbc) {
          lines.sort((a, b) => b.ai_priority_score - a.ai_priority_score);
          await supabase.from("wms_cycle_count_lines").insert(lines.slice(0, 50));
        } else {
          await supabase.from("wms_cycle_count_lines").insert(lines);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wms-cycle-counts"] });
      toast({ title: t("success") });
      setCreateDialog(false);
    },
    onError: () => toast({ title: t("error"), variant: "destructive" }),
  });

  const startCountMutation = useMutation({
    mutationFn: async () => {
      await supabase.from("wms_cycle_counts").update({ status: "in_progress" }).eq("id", selectedCountId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wms-cycle-counts"] });
      toast({ title: t("success") });
    },
  });

  const submitCountMutation = useMutation({
    mutationFn: async (lineId: string) => {
      const qty = countValues[lineId];
      if (qty === undefined) return;
      const line = countLines.find((l: any) => l.id === lineId);
      const threshold = scheduleConfig?.auto_approve_threshold_pct || 2.0;
      const variancePct = line?.expected_quantity > 0 ? Math.abs((qty - line.expected_quantity) / line.expected_quantity) * 100 : 0;
      const autoApproved = variancePct <= threshold;

      const { error } = await supabase.from("wms_cycle_count_lines").update({
        counted_quantity: qty, status: "counted", counted_by: user?.id, counted_at: new Date().toISOString(),
        auto_approved: autoApproved,
      }).eq("id", lineId);
      if (error) throw error;
      if (selectedCount?.status === "planned") {
        await supabase.from("wms_cycle_counts").update({ status: "in_progress" }).eq("id", selectedCountId);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wms-cycle-count-lines"] });
      qc.invalidateQueries({ queryKey: ["wms-cycle-counts"] });
      toast({ title: t("success") });
    },
  });

  const reconcileMutation = useMutation({
    mutationFn: async () => {
      const varianceLines = countLines.filter((l: any) => l.status === "counted" && l.variance !== 0);
      for (const line of varianceLines) {
        // Update WMS bin stock
        await supabase.from("wms_bin_stock").update({ quantity: line.counted_quantity }).eq("bin_id", line.bin_id).eq("product_id", line.product_id).eq("tenant_id", tenantId!);

        // P4-13 FIX: Adjust inventory_stock for variance
        if (line.product_id && tenantId) {
          const variance = line.counted_quantity - line.expected_quantity;
          // Get warehouse from bin -> zone -> warehouse chain
          let warehouseId: string | null = null;
          try {
            const { data: binData } = await supabase.from("wms_bins").select("wms_zones(warehouse_id)").eq("id", line.bin_id).single();
            warehouseId = (binData as any)?.wms_zones?.warehouse_id || null;
          } catch {}
          if (!warehouseId) continue;
          try {
            await supabase.rpc("batch_adjust_inventory_stock", {
              p_tenant_id: tenantId,
              p_adjustments: [{
                product_id: line.product_id,
                warehouse_id: warehouseId,
                quantity: Math.abs(variance),
                movement_type: variance > 0 ? "in" : "out",
                reference: `WMS-CycleCount-${selectedCountId}`,
              }],
              p_reference: `CC-${selectedCountId}`,
            });
          } catch (e) {
            console.warn("Inventory adjustment failed for product:", line.product_id, e);
          }
        }
      }

      // P4-13 FIX: Post GL entries for shortages and surpluses
      const totalShortage = varianceLines.filter((l: any) => l.counted_quantity < l.expected_quantity)
        .reduce((sum: number, l: any) => sum + Math.abs(l.counted_quantity - l.expected_quantity) * (l.unit_cost || 0), 0);
      const totalSurplus = varianceLines.filter((l: any) => l.counted_quantity > l.expected_quantity)
        .reduce((sum: number, l: any) => sum + (l.counted_quantity - l.expected_quantity) * (l.unit_cost || 0), 0);

      if ((totalShortage > 0 || totalSurplus > 0) && tenantId) {
        const glLines: Array<{ accountCode: string; debit: number; credit: number; description: string; sortOrder: number }> = [];
        let sortOrder = 1;
        if (totalShortage > 0) {
          glLines.push({ accountCode: "5710", debit: totalShortage, credit: 0, description: "Manjak po popisu - WMS", sortOrder: sortOrder++ });
          glLines.push({ accountCode: "1320", debit: 0, credit: totalShortage, description: "Smanjenje zaliha - manjak", sortOrder: sortOrder++ });
        }
        if (totalSurplus > 0) {
          glLines.push({ accountCode: "1320", debit: totalSurplus, credit: 0, description: "Povećanje zaliha - višak", sortOrder: sortOrder++ });
          glLines.push({ accountCode: "5790", debit: 0, credit: totalSurplus, description: "Višak po popisu - WMS", sortOrder: sortOrder++ });
        }
        try {
          await postWithRuleOrFallback({
            tenantId, userId: user?.id || null, modelCode: "WMS_CYCLE_COUNT",
            amount: totalShortage + totalSurplus,
            entryDate: new Date().toISOString().slice(0, 10),
            description: `WMS Cycle Count Reconciliation - ${selectedCountId}`,
            reference: `CC-${selectedCountId}`,
            context: {}, fallbackLines: glLines,
          });
        } catch (e) {
          console.warn("GL posting for cycle count reconciliation failed:", e);
        }
      }

      const accuracy = countLines.length > 0
        ? (countLines.filter((l: any) => l.status === "counted" && (l.variance === 0 || l.variance === null)).length / countLines.length) * 100
        : 100;
      await supabase.from("wms_cycle_counts").update({ status: "reconciled", accuracy_rate: accuracy }).eq("id", selectedCountId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wms-cycle-counts"] });
      qc.invalidateQueries({ queryKey: ["wms-bin-stock"] });
      toast({ title: t("success"), description: t("approveAdjustment") });
      setReconcileDialog(false);
    },
  });

  // AI scheduling panel data
  const aiSuggestions = useMemo(() => {
    if (!velocityData.length) return [];
    const aItems = velocityData.filter((v: any) => v.velocity_class === "A").length;
    const bItems = velocityData.filter((v: any) => v.velocity_class === "B").length;
    const cItems = velocityData.filter((v: any) => v.velocity_class === "C").length;
    return [
      { label: "A", count: aItems, freq: scheduleConfig?.abc_a_frequency_days || 30, color: "text-primary" },
      { label: "B", count: bItems, freq: scheduleConfig?.abc_b_frequency_days || 60, color: "text-accent" },
      { label: "C", count: cItems, freq: scheduleConfig?.abc_c_frequency_days || 90, color: "text-muted-foreground" },
    ];
  }, [velocityData, scheduleConfig]);

  return (
    <div className="space-y-6">
      <PageHeader title={t("wmsCycleCounts")} description={t("wmsCycleCountsDesc")} icon={ClipboardCheck}
        actions={<Button onClick={() => { setWarehouseId(""); setZoneId(""); setCreateDialog(true); }}><Plus className="h-4 w-4 mr-1" />{t("newCount")}</Button>} />

      {selectedCountId && <StatsBar stats={stats} />}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="counts">{locale === "sr" ? "Popisi" : "Counts"}</TabsTrigger>
          <TabsTrigger value="ai"><Brain className="h-3 w-3 mr-1" />{locale === "sr" ? "AI raspoređivanje" : "AI Scheduling"}</TabsTrigger>
        </TabsList>

        <TabsContent value="counts">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <CountSessionList counts={counts} selectedCountId={selectedCountId} onSelect={setSelectedCountId} t={t} />
            {selectedCountId ? (
              <CountLinesTable
                countLines={countLines} countValues={countValues} setCountValues={setCountValues}
                submitCountMutation={submitCountMutation} selectedCount={selectedCount}
                startCountMutation={startCountMutation} allCounted={allCounted}
                onReconcile={() => setReconcileDialog(true)} t={t} locale={locale}
              />
            ) : (
              <Card className="lg:col-span-2">
                <CardContent className="py-8 text-center text-muted-foreground">{t("selectCount")}</CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="ai">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Brain className="h-4 w-4" />{locale === "sr" ? "ABC klasifikacija" : "ABC Classification"}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {aiSuggestions.map(s => (
                  <div key={s.label} className="flex items-center justify-between px-3 py-2 bg-muted/50 rounded">
                    <div className="flex items-center gap-3">
                      <Badge variant={s.label === "A" ? "default" : s.label === "B" ? "secondary" : "outline"} className="w-8 justify-center">{s.label}</Badge>
                      <span className="text-sm">{s.count} {locale === "sr" ? "proizvoda" : "products"}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{locale === "sr" ? `Svakih ${s.freq} dana` : `Every ${s.freq} days`}</span>
                  </div>
                ))}
                {aiSuggestions.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">{locale === "sr" ? "Nema podataka o brzini" : "No velocity data available"}</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4" />{locale === "sr" ? "Konfiguracija" : "Schedule Config"}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="text-muted-foreground">{locale === "sr" ? "A frekvencija" : "A frequency"}</div>
                  <div>{scheduleConfig?.abc_a_frequency_days || 30} {locale === "sr" ? "dana" : "days"}</div>
                  <div className="text-muted-foreground">{locale === "sr" ? "B frekvencija" : "B frequency"}</div>
                  <div>{scheduleConfig?.abc_b_frequency_days || 60} {locale === "sr" ? "dana" : "days"}</div>
                  <div className="text-muted-foreground">{locale === "sr" ? "C frekvencija" : "C frequency"}</div>
                  <div>{scheduleConfig?.abc_c_frequency_days || 90} {locale === "sr" ? "dana" : "days"}</div>
                  <div className="text-muted-foreground">{locale === "sr" ? "Auto-odobrenje prag" : "Auto-approve threshold"}</div>
                  <div>{scheduleConfig?.auto_approve_threshold_pct || 2.0}%</div>
                </div>
                <p className="text-xs text-muted-foreground">{locale === "sr" ? "Podešava se u konfiguraciji skladišta" : "Configure in warehouse settings"}</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Count Dialog */}
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
                <SelectContent>{COUNT_TYPES.map(ct => <SelectItem key={ct} value={ct}>{ct === "abc" ? "ABC (AI)" : ct}</SelectItem>)}</SelectContent>
              </Select>
              {countType === "abc" && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Brain className="h-3 w-3" />{locale === "sr" ? "AI će prioritizovati A stavke i ograničiti na 50" : "AI will prioritize A-class items, limited to 50"}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialog(false)}>{t("cancel")}</Button>
            <Button onClick={() => createCountMutation.mutate()} disabled={!warehouseId || createCountMutation.isPending}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reconcile Dialog */}
      <Dialog open={reconcileDialog} onOpenChange={setReconcileDialog}>
        <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("reconcile")} — {t("varianceSummary")}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-4">
            {countLines.filter((l: any) => l.status === "counted" && l.variance !== 0).map((l: any) => (
              <div key={l.id} className="flex items-center justify-between px-3 py-2 bg-muted/50 rounded text-sm">
                <div>
                  <span className="font-medium">{l.products?.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">({l.wms_bins?.code})</span>
                  {l.auto_approved && <Zap className="inline h-3 w-3 ml-1 text-primary" />}
                </div>
                <div className="text-right">
                  <span className="text-muted-foreground">{l.expected_quantity} → {l.counted_quantity}</span>
                  <span className={`ml-2 font-medium ${l.variance > 0 ? "text-primary" : "text-destructive"}`}>{l.variance > 0 ? "+" : ""}{l.variance}</span>
                </div>
              </div>
            ))}
            {countLines.filter((l: any) => l.status === "counted" && l.variance !== 0).length === 0 && (
              <p className="text-center text-muted-foreground text-sm">{t("noVariancesToReconcile")}</p>
            )}
            <p className="text-xs text-muted-foreground">{t("approveAdjustmentHint")}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReconcileDialog(false)}>{t("cancel")}</Button>
            <Button onClick={() => reconcileMutation.mutate()} disabled={reconcileMutation.isPending}>{t("approveAdjustment")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
