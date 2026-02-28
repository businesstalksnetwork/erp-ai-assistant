import { useState, useMemo } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Brain, Play, Layers, TrendingDown, ArrowRightLeft, Zap, Loader2, GitCompareArrows, X, RefreshCw } from "lucide-react";

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
  const [useAi, setUseAi] = useState(true);
  const [compareMode, setCompareMode] = useState(false);
  const [compareScenarioA, setCompareScenarioA] = useState<any>(null);
  const [compareScenarioB, setCompareScenarioB] = useState<any>(null);

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

  const completedScenarios = useMemo(() => scenarios.filter((s: any) => s.status === "completed"), [scenarios]);

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

      if (useAi) {
        const { data: aiResult, error: aiError } = await supabase.functions.invoke("wms-slotting", {
          body: {
            warehouse_id: warehouseId,
            tenant_id: tenantId!,
            weights: { travel: params.travel_weight, space: params.space_weight, affinity: params.affinity_weight },
          },
        });

        if (aiError) throw aiError;

        const recommendations = aiResult?.recommendations || [];
        const estimatedImprovement = aiResult?.estimated_improvement || { travel_reduction_pct: 0, summary: "No improvement data" };

        await supabase.from("wms_slotting_scenarios").update({
          status: "completed",
          results: recommendations,
          estimated_improvement: { travel_reduction_pct: estimatedImprovement.travel_reduction_pct, moves_count: recommendations.length, summary: estimatedImprovement.summary },
        }).eq("id", scenario.id);

        if (recommendations.length > 0) {
          const moveInserts = recommendations.map((r: any, i: number) => ({
            tenant_id: tenantId!, scenario_id: scenario.id,
            product_id: r.product_id,
            from_bin_id: r.current_bin || null,
            to_bin_id: r.recommended_bin || null,
            quantity: r.quantity || 0, priority: i + 1, status: "proposed" as const,
          }));
          await supabase.from("wms_slotting_moves").insert(moveInserts);
        }
      } else {
        // Local algorithm with capacity validation
        const [binStockRes, binsRes, pickHistoryRes] = await Promise.all([
          supabase.from("wms_bin_stock").select("bin_id, product_id, quantity").eq("warehouse_id", warehouseId).eq("tenant_id", tenantId!),
          supabase.from("wms_bins").select("id, code, zone_id, level, accessibility_score, max_units, sort_order").eq("warehouse_id", warehouseId).eq("tenant_id", tenantId!).eq("is_active", true).gt("accessibility_score", 0).order("accessibility_score", { ascending: false }).limit(500),
          supabase.from("wms_tasks").select("product_id, from_bin_id, created_at").eq("warehouse_id", warehouseId).eq("tenant_id", tenantId!).eq("task_type", "pick").eq("status", "completed").gte("created_at", new Date(Date.now() - 90 * 86400000).toISOString()).order("created_at", { ascending: false }).limit(5000),
        ]);

        const velocity: Record<string, number> = {};
        (pickHistoryRes.data || []).forEach((p: any) => { velocity[p.product_id] = (velocity[p.product_id] || 0) + 1; });

        const currentPlacement: Record<string, string> = {};
        const binOccupancy: Record<string, number> = {};
        (binStockRes.data || []).forEach((bs: any) => {
          currentPlacement[bs.product_id] = bs.bin_id;
          binOccupancy[bs.bin_id] = (binOccupancy[bs.bin_id] || 0) + (bs.quantity || 0);
        });

        const binsData = binsRes.data || [];
        const sortedBins = [...binsData].sort((a: any, b: any) => b.accessibility_score - a.accessibility_score || a.sort_order - b.sort_order);
        const sortedProducts = Object.entries(velocity).sort((a, b) => b[1] - a[1]);

        const recommendations: any[] = [];
        const usedBins = new Set<string>();

        for (const [productId, picks] of sortedProducts) {
          const currentBin = currentPlacement[productId];
          if (!currentBin) continue;
          const bestBin = sortedBins.find((b: any) => {
            if (usedBins.has(b.id) || b.id === currentBin) return false;
            // Capacity validation: check max_units vs current occupancy
            const maxUnits = b.max_units || 9999;
            const currentOccupancy = binOccupancy[b.id] || 0;
            return currentOccupancy < maxUnits;
          });
          if (!bestBin) continue;
          const currentBinData = binsData.find((b: any) => b.id === currentBin);
          if (!currentBinData) continue;
          if (bestBin.accessibility_score > (currentBinData as any).accessibility_score) {
            recommendations.push({
              product_id: productId, from_bin_id: currentBin, to_bin_id: bestBin.id,
              score: bestBin.accessibility_score - (currentBinData as any).accessibility_score,
              reasons: [`${picks} picks in 90 days`, `Accessibility: ${(currentBinData as any).accessibility_score} → ${bestBin.accessibility_score}`, `Capacity: ${binOccupancy[bestBin.id] || 0}/${bestBin.max_units || '∞'}`],
            });
            usedBins.add(bestBin.id);
          }
        }

        const totalCurrentScore = recommendations.reduce((acc, r) => acc + ((binsData.find((b: any) => b.id === r.from_bin_id) as any)?.accessibility_score || 0), 0);
        const totalNewScore = recommendations.reduce((acc, r) => acc + ((binsData.find((b: any) => b.id === r.to_bin_id) as any)?.accessibility_score || 0), 0);
        const improvement = totalCurrentScore > 0 ? Math.round(((totalNewScore - totalCurrentScore) / totalCurrentScore) * 100) : 0;

        await supabase.from("wms_slotting_scenarios").update({
          status: "completed", results: recommendations,
          estimated_improvement: { travel_reduction_pct: improvement, moves_count: recommendations.length },
        }).eq("id", scenario.id);

        if (recommendations.length > 0) {
          // Batch insert all moves at once
          await supabase.from("wms_slotting_moves").insert(recommendations.map((r: any, i: number) => ({
            tenant_id: tenantId!, scenario_id: scenario.id,
            product_id: r.product_id, from_bin_id: r.from_bin_id, to_bin_id: r.to_bin_id,
            quantity: 0, priority: i + 1, status: "proposed" as const,
          })));
        }
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

  // Batch task generation — single bulk insert instead of sequential loop
  const generateTasksMutation = useMutation({
    mutationFn: async () => {
      if (!selectedScenario) return;
      const proposedMoves = moves.filter((m: any) => m.status === "proposed");
      if (proposedMoves.length === 0) return;

      // Batch insert all reslot tasks at once
      const taskInserts = proposedMoves.map((move: any) => ({
        tenant_id: tenantId!,
        warehouse_id: selectedScenario.warehouse_id,
        task_type: "reslot" as const,
        status: "pending" as const,
        priority: move.priority,
        product_id: move.product_id,
        from_bin_id: move.from_bin_id,
        to_bin_id: move.to_bin_id,
        created_by: user?.id,
      }));

      const { data: tasks, error: taskError } = await supabase
        .from("wms_tasks")
        .insert(taskInserts)
        .select("id");
      if (taskError) throw taskError;

      // Batch update all moves to approved with their task IDs
      if (tasks && tasks.length === proposedMoves.length) {
        const moveUpdates = proposedMoves.map((move: any, i: number) => ({
          id: move.id,
          status: "approved" as const,
          task_id: tasks[i].id,
        }));
        // Update each move — Supabase doesn't support batch upsert on non-PK, so we use Promise.all
        await Promise.all(
          moveUpdates.map((u) =>
            supabase.from("wms_slotting_moves").update({ status: u.status, task_id: u.task_id }).eq("id", u.id)
          )
        );
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wms-slotting-moves"] });
      qc.invalidateQueries({ queryKey: ["wms-tasks"] });
      toast({ title: t("success"), description: t("reslotTasksCreated") });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const improvement = selectedScenario?.estimated_improvement as any;
  const improvA = compareScenarioA?.estimated_improvement as any;
  const improvB = compareScenarioB?.estimated_improvement as any;

  return (
    <div className="space-y-6">
      <PageHeader title={t("wmsSlotting")} description={t("wmsSlottingDesc")} icon={Brain}
        actions={
          <div className="flex gap-2">
            {completedScenarios.length >= 2 && (
              <Button variant="outline" onClick={() => { setCompareMode(!compareMode); setCompareScenarioA(null); setCompareScenarioB(null); }}>
                <GitCompareArrows className="h-4 w-4 mr-1" />{compareMode ? t("cancel") : "Compare"}
              </Button>
            )}
            <Button onClick={() => setCreateDialog(true)}><Zap className="h-4 w-4 mr-1" />{t("runAnalysis")}</Button>
          </div>
        } />

      {/* Scenario Comparison View */}
      {compareMode && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <GitCompareArrows className="h-4 w-4" />
              Scenario Comparison
            </CardTitle>
            <CardDescription>Select two completed scenarios to compare</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <Label className="text-xs mb-1 block">Scenario A</Label>
                <Select value={compareScenarioA?.id || ""} onValueChange={(id) => setCompareScenarioA(completedScenarios.find((s: any) => s.id === id))}>
                  <SelectTrigger><SelectValue placeholder="Select scenario A" /></SelectTrigger>
                  <SelectContent>
                    {completedScenarios.filter((s: any) => s.id !== compareScenarioB?.id).map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.name} — {s.warehouses?.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Scenario B</Label>
                <Select value={compareScenarioB?.id || ""} onValueChange={(id) => setCompareScenarioB(completedScenarios.find((s: any) => s.id === id))}>
                  <SelectTrigger><SelectValue placeholder="Select scenario B" /></SelectTrigger>
                  <SelectContent>
                    {completedScenarios.filter((s: any) => s.id !== compareScenarioA?.id).map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.name} — {s.warehouses?.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {compareScenarioA && compareScenarioB && (
              <div className="grid grid-cols-2 gap-4">
                <CompareCard label="A" scenario={compareScenarioA} improvement={improvA} />
                <CompareCard label="B" scenario={compareScenarioB} improvement={improvB} />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      {selectedScenario && improvement && !compareMode && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><TrendingDown className="h-4 w-4" />{t("travelReduction")}</CardTitle></CardHeader>
            <CardContent className="text-2xl font-bold text-primary">{improvement.travel_reduction_pct || 0}%</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><ArrowRightLeft className="h-4 w-4" />{t("proposedMoves")}</CardTitle></CardHeader>
            <CardContent className="text-2xl font-bold">{improvement.moves_count || 0}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><Layers className="h-4 w-4" />{t("status")}</CardTitle></CardHeader>
            <CardContent><Badge variant="default" className="text-base">{selectedScenario.status}</Badge></CardContent></Card>
        </div>
      )}

      {/* Main content */}
      {!compareMode && (
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
                  {generateTasksMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Play className="h-3 w-3 mr-1" />}
                  {t("generateTasks")}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {!selectedScenario ? (
                <p className="text-center text-muted-foreground py-8">{t("selectScenario")}</p>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>{t("product")}</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>#</TableHead><TableHead>{t("status")}</TableHead></TableRow></TableHeader>
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
      )}

      {/* Run Analysis Dialog */}
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

            {/* Refresh Stats */}
            {warehouseId && (
              <RefreshStatsButton warehouseId={warehouseId} tenantId={tenantId!} />
            )}

            <div className="space-y-4">
              <CardDescription>{t("optimizationWeights")}</CardDescription>
              <div className="flex items-center gap-2 mb-2">
                <Switch checked={useAi} onCheckedChange={setUseAi} />
                <Label className="text-sm">{useAi ? t("useAiAnalysis") : t("localAnalysis")}</Label>
              </div>
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
              {runAnalysisMutation.isPending ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />{useAi ? t("aiAnalyzing") : t("loading")}</> : <><Brain className="h-4 w-4 mr-1" />{t("runAnalysis")}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Refresh Stats button component
function RefreshStatsButton({ warehouseId, tenantId }: { warehouseId: string; tenantId: string }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);

  // Fetch last refresh timestamp
  useQuery({
    queryKey: ["wms-stats-last-refresh", tenantId, warehouseId],
    queryFn: async () => {
      const { data } = await supabase.from("wms_product_stats").select("updated_at")
        .eq("tenant_id", tenantId).eq("warehouse_id", warehouseId)
        .order("updated_at", { ascending: false }).limit(1);
      const ts = data?.[0]?.updated_at || null;
      setLastRefresh(ts);
      return ts;
    },
    enabled: !!tenantId && !!warehouseId,
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        supabase.rpc("refresh_wms_product_stats", { p_tenant_id: tenantId, p_warehouse_id: warehouseId }),
        supabase.rpc("refresh_wms_affinity_pairs", { p_tenant_id: tenantId, p_warehouse_id: warehouseId }),
      ]);
      setLastRefresh(new Date().toISOString());
      toast({ title: t("success"), description: t("statsRefreshed") });
    } catch (e: any) {
      toast({ title: t("error"), description: e.message, variant: "destructive" });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="flex items-center justify-between border rounded-md p-3 bg-muted/30">
      <div className="text-xs text-muted-foreground">
        {t("lastRefresh")}: {lastRefresh ? new Date(lastRefresh).toLocaleString() : "—"}
      </div>
      <Button size="sm" variant="outline" onClick={handleRefresh} disabled={refreshing}>
        {refreshing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
        {t("refreshStats")}
      </Button>
    </div>
  );
}

// Side-by-side comparison card
function CompareCard({ label, scenario, improvement }: { label: string; scenario: any; improvement: any }) {
  const params = scenario.parameters as any;
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <Badge variant="outline" className="text-xs">{label}</Badge>
        <span className="text-xs text-muted-foreground">{new Date(scenario.created_at).toLocaleDateString()}</span>
      </div>
      <h4 className="font-semibold text-sm">{scenario.name}</h4>
      <p className="text-xs text-muted-foreground">{scenario.warehouses?.name}</p>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-muted-foreground text-xs block">Travel Reduction</span>
          <span className="text-lg font-bold text-primary">{improvement?.travel_reduction_pct || 0}%</span>
        </div>
        <div>
          <span className="text-muted-foreground text-xs block">Moves</span>
          <span className="text-lg font-bold">{improvement?.moves_count || 0}</span>
        </div>
      </div>
      {params && (
        <div className="text-xs text-muted-foreground space-y-0.5">
          <div>Travel: {Math.round((params.travel_weight || 0) * 100)}%</div>
          <div>Affinity: {Math.round((params.affinity_weight || 0) * 100)}%</div>
          <div>Space: {Math.round((params.space_weight || 0) * 100)}%</div>
        </div>
      )}
      {improvement?.summary && (
        <p className="text-xs text-muted-foreground border-t pt-2">{improvement.summary}</p>
      )}
    </div>
  );
}
