import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatsBar } from "@/components/shared/StatsBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { MapPin, Route, TrendingDown, Users, Zap, Brain } from "lucide-react";

// Nearest-neighbor TSP heuristic for pick route optimization
function optimizeRoute(bins: { id: string; code: string; sort_order: number }[]) {
  if (bins.length <= 1) return bins;
  const visited = new Set<string>();
  const route: typeof bins = [];
  let current = bins.reduce((min, b) => b.sort_order < min.sort_order ? b : min, bins[0]);
  route.push(current);
  visited.add(current.id);
  while (visited.size < bins.length) {
    let nearest = bins.filter(b => !visited.has(b.id))
      .reduce((best, b) => Math.abs(b.sort_order - current.sort_order) < Math.abs(best.sort_order - current.sort_order) ? b : best);
    route.push(nearest);
    visited.add(nearest.id);
    current = nearest;
  }
  return route;
}

export default function WmsRouteOptimization() {
  const { t, locale } = useLanguage();
  const { tenantId } = useTenant();
  const [warehouseId, setWarehouseId] = useState("");

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("warehouses").select("id, name").eq("tenant_id", tenantId!).eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: activeTasks = [] } = useQuery({
    queryKey: ["wms-route-tasks", tenantId, warehouseId],
    queryFn: async () => {
      const { data, error } = await supabase.from("wms_tasks")
        .select("id, wave_id, assigned_to, wms_bins(id, code, sort_order, zone_id), products(name, sku)")
        .eq("tenant_id", tenantId!)
        .eq("warehouse_id", warehouseId)
        .in("status", ["assigned", "in_progress"])
        .eq("task_type", "pick")
        .order("wave_id");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && !!warehouseId,
  });

  // Group by wave/picker, then optimize each route
  const routesByWave: Record<string, { waveId: string; tasks: any[]; optimized: any[]; savings: number }> = {};
  activeTasks.forEach((task: any) => {
    const key = task.wave_id || "unassigned";
    if (!routesByWave[key]) routesByWave[key] = { waveId: key, tasks: [], optimized: [], savings: 0 };
    routesByWave[key].tasks.push(task);
  });

  Object.values(routesByWave).forEach(group => {
    const bins = group.tasks.map((t: any) => t.wms_bins).filter(Boolean);
    const naiveDistance = bins.reduce((sum, b, i) => i === 0 ? 0 : sum + Math.abs(b.sort_order - bins[i - 1].sort_order), 0);
    const opt = optimizeRoute(bins);
    const optDistance = opt.reduce((sum, b, i) => i === 0 ? 0 : sum + Math.abs(b.sort_order - opt[i - 1].sort_order), 0);
    group.optimized = opt;
    group.savings = naiveDistance > 0 ? Math.round(((naiveDistance - optDistance) / naiveDistance) * 100) : 0;
  });

  const routeGroups = Object.values(routesByWave);
  const avgSavings = routeGroups.length > 0 ? Math.round(routeGroups.reduce((s, r) => s + r.savings, 0) / routeGroups.length) : 0;

  const stats = [
    { label: locale === "sr" ? "Aktivne rute" : "Active Routes", value: routeGroups.length, icon: Route, color: "text-primary" },
    { label: locale === "sr" ? "Ukupno stavki" : "Total Picks", value: activeTasks.length, icon: MapPin, color: "text-accent" },
    { label: locale === "sr" ? "Prosečna ušteda" : "Avg Distance Saved", value: `${avgSavings}%`, icon: TrendingDown, color: "text-primary" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("wmsRouteOptimization")} description={t("wmsRouteOptimizationDesc")} icon={Route}
        actions={
          <Select value={warehouseId} onValueChange={setWarehouseId}>
            <SelectTrigger className="w-48"><SelectValue placeholder={t("selectWarehouse")} /></SelectTrigger>
            <SelectContent>{warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
          </Select>
        } />

      <StatsBar stats={stats} />

      <div className="grid grid-cols-1 gap-6">
        {routeGroups.map(group => (
          <Card key={group.waveId}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Route className="h-4 w-4" />
                  {locale === "sr" ? "Talas" : "Wave"}: <span className="font-mono">{group.waveId}</span>
                </CardTitle>
                <Badge variant={group.savings > 15 ? "default" : "secondary"}>
                  <TrendingDown className="h-3 w-3 mr-1" />{group.savings}% {locale === "sr" ? "uštede" : "saved"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 flex-wrap text-sm">
                <span className="text-muted-foreground font-medium">{locale === "sr" ? "Optimalan put:" : "Optimal path:"}</span>
                {group.optimized.map((bin: any, i: number) => (
                  <span key={bin.id} className="inline-flex items-center">
                    <Badge variant="outline" className="font-mono text-xs">{bin.code}</Badge>
                    {i < group.optimized.length - 1 && <span className="text-muted-foreground mx-1">→</span>}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
        {routeGroups.length === 0 && (
          <Card><CardContent className="py-8 text-center text-muted-foreground">{t("noResults")}</CardContent></Card>
        )}
      </div>
    </div>
  );
}
