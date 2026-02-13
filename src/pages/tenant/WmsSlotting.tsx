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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Brain, Play, Layers, TrendingDown, ArrowRightLeft, Zap } from "lucide-react";

export default function WmsSlotting() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [warehouseId, setWarehouseId] = useState("");
  const [scenarioName, setScenarioName] = useState("");
  const [travelWeight, setTravelWeight] = useState(70);
  const [affinityWeight, setAffinityWeight] = useState(20);
  const [spaceWeight, setSpaceWeight] = useState(10);
  const [selectedScenario, setSelectedScenario] = useState<any>(null);
  const [createDialog, setCreateDialog] = useState(false);

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("warehouses").select("id, name").eq("tenant_id", tenantId!).eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: scenarios = [] } = useQuery({
    queryKey: ["wms-slotting-scenarios", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("wms_slotting_scenarios").select("*, warehouses(name)").eq("tenant_id", tenantId!).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: moves = [] } = useQuery({
    queryKey: ["wms-slotting-moves", selectedScenario?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("wms_slotting_moves").select("*, products(name, sku), from_bin:wms_bins!wms_slotting_moves_from_bin_id_fkey(code), to_bin:wms_bins!wms_slotting_moves_to_bin_id_fkey(code)").eq("scenario_id", selectedScenario!.id).order("priority");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedScenario?.id,
  });

  const runAnalysisMutation = useMutation({
    mutationFn: async () => {
      // Create scenario
      const params = {
        travel_weight: travelWeight / 100,
        affinity_weight: affinityWeight / 100,
        space_weight: spaceWeight / 100,
        date_range_days: 90,
      };
      const { data: scenario, error } = await supabase.from("wms_slotting_scenarios").insert({
        tenant_id: tenantId!, warehouse_id: warehouseId, name: scenarioName || `Analysis ${new Date().toLocaleDateString()}`,
        parameters: params, status: "analyzing", created_by: user?.id,
      }).select("id").single();
      if (error) throw error;

      // Gather data for analysis
      const [binStock, bins, pickHistory] = await Promise.all([
        supabase.from("wms_bin_stock").select("bin_id, product_id, quantity").eq("warehouse_id", warehouseId).eq("tenant_id", tenantId!),
        supabase.from("wms_bins").select("id, code, zone_id, level, accessibility_score, max_units, sort_order").eq("warehouse_id", warehouseId).eq("tenant_id", tenantId!).eq("is_active", true),
        supabase.from("wms_tasks").select("product_id, from_bin_id, created_at").eq("warehouse_id", warehouseId).eq("tenant_id", tenantId!).eq("task_type", "pick").eq("status", "completed").gte("created_at", new Date(Date.now() - 90 * 86400000).toISOString()),
      ]);

      // Calculate velocity (picks per product)
      const velocity: Record<string, number> = {};
      (pickHistory.data || []).forEach((p: any) => { velocity[p.product_id] = (velocity[p.product_id] || 0) + 1; });

      // Current placement
      const currentPlacement: Record<string, string> = {};
      (binStock.data || []).forEach((bs: any) => { currentPlacement[bs.product_id] = bs.bin_id; });

      // Score bins by accessibility (higher score = better for fast-movers)
      const binsData = bins.data || [];
      const sortedBins = [...binsData].sort((a: any, b: any) => b.accessibility_score - a.accessibility_score || a.sort_order - b.sort_order);

      // Sort products by velocity (highest first)
      const sortedProducts = Object.entries(velocity).sort((a, b) => b[1] - a[1]);

      // Generate recommendations: assign highest-velocity SKUs to highest-accessibility bins
      const recommendations: any[] = [];
      const usedBins = new Set<string>();

      for (const [productId, picks] of sortedProducts) {
        const currentBin = currentPlacement[productId];
        if (!currentBin) continue;

        const bestBin = sortedBins.find((b: any) => !usedBins.has(b.id) && b.id !== currentBin);
        if (!bestBin) continue;

        const currentBinData = binsData.find((b: any) => b.id === currentBin);
        if (!currentBinData) continue;

        // Only recommend if it's actually an improvement
        if (bestBin.accessibility_score > (currentBinData as any).accessibility_score) {
          recommendations.push({
            product_id: productId,
            from_bin_id: currentBin,
            to_bin_id: bestBin.id,
            score: bestBin.accessibility_score - (currentBinData as any).accessibility_score,
            reasons: [`${picks} picks in 90 days`, `Accessibility: ${(currentBinData as any).accessibility_score} → ${bestBin.accessibility_score}`],
          });
          usedBins.add(bestBin.id);
        }
      }

      // Calculate estimated improvement
      const totalCurrentScore = recommendations.reduce((acc, r) => {
        const bin = binsData.find((b: any) => b.id === r.from_bin_id);
        return acc + ((bin as any)?.accessibility_score || 0);
      }, 0);
      const totalNewScore = recommendations.reduce((acc, r) => {
        const bin = binsData.find((b: any) => b.id === r.to_bin_id);
        return acc + ((bin as any)?.accessibility_score || 0);
      }, 0);

      const improvement = totalCurrentScore > 0 ? Math.round(((totalNewScore - totalCurrentScore) / totalCurrentScore) * 100) : 0;

      // Save results
      await supabase.from("wms_slotting_scenarios").update({
        status: "completed",
        results: recommendations,
        estimated_improvement: { travel_reduction_pct: improvement, moves_count: recommendations.length },
      }).eq("id", scenario.id);

      // Save move plan
      if (recommendations.length > 0) {
        const moveInserts = recommendations.map((r: any, i: number) => ({
          tenant_id: tenantId!, scenario_id: scenario.id,
          product_id: r.product_id, from_bin_id: r.from_bin_id, to_bin_id: r.to_bin_id,
          quantity: 0, priority: i + 1, status: "proposed" as const,
        }));
        await supabase.from("wms_slotting_moves").insert(moveInserts);
      }

      return scenario.id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wms-slotting-scenarios"] });
      toast({ title: t("success"), description: t("slottingAnalysisComplete") });
      setCreateDialog(false);
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const generateTasksMutation = useMutation({
    mutationFn: async () => {
      if (!selectedScenario) return;
      for (const move of moves) {
        if ((move as any).status !== "proposed") continue;
        const { data: task } = await supabase.from("wms_tasks").insert({
          tenant_id: tenantId!, warehouse_id: selectedScenario.warehouse_id,
          task_type: "reslot", status: "pending", priority: (move as any).priority,
          product_id: (move as any).product_id, from_bin_id: (move as any).from_bin_id, to_bin_id: (move as any).to_bin_id,
          created_by: user?.id,
        }).select("id").single();
        if (task) {
          await supabase.from("wms_slotting_moves").update({ status: "approved", task_id: task.id }).eq("id", (move as any).id);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wms-slotting-moves"] });
      qc.invalidateQueries({ queryKey: ["wms-tasks"] });
      toast({ title: t("success"), description: t("reslotTasksCreated") });
    },
  });

  const improvement = selectedScenario?.estimated_improvement as any;

  return (
    <div className="space-y-6">
      <PageHeader title={t("wmsSlotting")} description={t("wmsSlottingDesc")} icon={Brain}
        actions={<Button onClick={() => setCreateDialog(true)}><Zap className="h-4 w-4 mr-1" />{t("runAnalysis")}</Button>} />

      {selectedScenario && improvement && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><TrendingDown className="h-4 w-4" />{t("travelReduction")}</CardTitle></CardHeader>
            <CardContent className="text-2xl font-bold text-primary">{improvement.travel_reduction_pct || 0}%</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><ArrowRightLeft className="h-4 w-4" />{t("proposedMoves")}</CardTitle></CardHeader>
            <CardContent className="text-2xl font-bold">{improvement.moves_count || 0}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><Layers className="h-4 w-4" />{t("status")}</CardTitle></CardHeader>
            <CardContent><Badge variant="default" className="text-base">{selectedScenario.status}</Badge></CardContent></Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="text-base">{t("scenarios")}</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {scenarios.map((s: any) => (
              <button
                key={s.id}
                onClick={() => setSelectedScenario(s)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm text-left transition-colors ${selectedScenario?.id === s.id ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}
              >
                <div>
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.warehouses?.name} · {new Date(s.created_at).toLocaleDateString()}</div>
                </div>
                <Badge variant={s.status === "completed" ? "default" : "secondary"}>{s.status}</Badge>
              </button>
            ))}
            {scenarios.length === 0 && <p className="text-sm text-center text-muted-foreground py-4">{t("noResults")}</p>}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{t("movePlan")}</CardTitle>
            {selectedScenario?.status === "completed" && moves.some((m: any) => m.status === "proposed") && (
              <Button size="sm" onClick={() => generateTasksMutation.mutate()} disabled={generateTasksMutation.isPending}>
                <Play className="h-3 w-3 mr-1" />{t("generateTasks")}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!selectedScenario ? (
              <p className="text-center text-muted-foreground py-8">{t("selectScenario")}</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>{t("product")}</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>{t("priority")}</TableHead><TableHead>{t("status")}</TableHead></TableRow></TableHeader>
                <TableBody>
                  {moves.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>
                  ) : moves.map((m: any) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.products?.name}</TableCell>
                      <TableCell className="font-mono text-xs">{m.from_bin?.code}</TableCell>
                      <TableCell className="font-mono text-xs">{m.to_bin?.code}</TableCell>
                      <TableCell>{m.priority}</TableCell>
                      <TableCell><Badge variant={m.status === "executed" ? "default" : m.status === "approved" ? "secondary" : "outline"}>{m.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("runAnalysis")}</DialogTitle></DialogHeader>
          <div className="grid gap-5 py-4">
            <div><Label>{t("warehouse")}</Label>
              <Select value={warehouseId} onValueChange={setWarehouseId}>
                <SelectTrigger><SelectValue placeholder={t("selectWarehouse")} /></SelectTrigger>
                <SelectContent>{warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>{t("scenarioName")}</Label><Input value={scenarioName} onChange={e => setScenarioName(e.target.value)} placeholder={t("optional")} /></div>
            <div className="space-y-4">
              <CardDescription>{t("optimizationWeights")}</CardDescription>
              <div><Label className="text-xs">{t("travelReduction")} ({travelWeight}%)</Label>
                <Slider value={[travelWeight]} onValueChange={([v]) => { setTravelWeight(v); setAffinityWeight(Math.max(0, 100 - v - spaceWeight)); }} max={100} step={5} /></div>
              <div><Label className="text-xs">{t("affinityGrouping")} ({affinityWeight}%)</Label>
                <Slider value={[affinityWeight]} onValueChange={([v]) => { setAffinityWeight(v); setSpaceWeight(Math.max(0, 100 - travelWeight - v)); }} max={100 - travelWeight} step={5} /></div>
              <div><Label className="text-xs">{t("spaceUtilization")} ({spaceWeight}%)</Label>
                <Slider value={[spaceWeight]} disabled max={100} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialog(false)}>{t("cancel")}</Button>
            <Button onClick={() => runAnalysisMutation.mutate()} disabled={!warehouseId || runAnalysisMutation.isPending}>
              <Brain className="h-4 w-4 mr-1" />{runAnalysisMutation.isPending ? t("loading") : t("runAnalysis")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
