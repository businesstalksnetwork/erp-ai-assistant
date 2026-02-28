import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatsBar } from "@/components/shared/StatsBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Layers, Zap, Clock, CheckCircle, Users, Brain, Play } from "lucide-react";

export default function WmsWavePlanning() {
  const { t, locale } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [warehouseId, setWarehouseId] = useState("");
  const [createWaveDialog, setCreateWaveDialog] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("warehouses").select("id, name").eq("tenant_id", tenantId!).eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: pendingTasks = [] } = useQuery({
    queryKey: ["wms-wave-pending-tasks", tenantId, warehouseId],
    queryFn: async () => {
      const { data, error } = await supabase.from("wms_tasks")
        .select("*, wms_bins(code, zone_id), products(name, sku)")
        .eq("tenant_id", tenantId!)
        .eq("warehouse_id", warehouseId)
        .eq("status", "pending")
        .eq("task_type", "pick")
        .order("priority", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && !!warehouseId,
  });

  const { data: waves = [] } = useQuery({
    queryKey: ["wms-waves", tenantId, warehouseId],
    queryFn: async () => {
      const { data, error } = await supabase.from("wms_tasks")
        .select("wave_id, status, priority")
        .eq("tenant_id", tenantId!)
        .eq("warehouse_id", warehouseId)
        .not("wave_id", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Group by wave_id
      const grouped: Record<string, { count: number; completed: number; waveId: string }> = {};
      (data || []).forEach((t: any) => {
        if (!grouped[t.wave_id]) grouped[t.wave_id] = { count: 0, completed: 0, waveId: t.wave_id };
        grouped[t.wave_id].count++;
        if (t.status === "completed") grouped[t.wave_id].completed++;
      });
      return Object.values(grouped);
    },
    enabled: !!tenantId && !!warehouseId,
  });

  const totalWaves = waves.length;
  const picksToday = pendingTasks.length;
  const completedWaves = waves.filter((w: any) => w.count === w.completed && w.count > 0).length;

  const stats = [
    { label: locale === "sr" ? "Talasi danas" : "Waves Today", value: totalWaves, icon: Layers, color: "text-primary" },
    { label: locale === "sr" ? "Stavke za pick" : "Pending Picks", value: picksToday, icon: Clock, color: "text-accent" },
    { label: locale === "sr" ? "Završeni talasi" : "Completed Waves", value: completedWaves, icon: CheckCircle, color: "text-primary" },
  ];

  const createWaveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTasks.length) return;
      const waveId = `WAVE-${Date.now()}`;
      const { error } = await supabase.from("wms_tasks")
        .update({ wave_id: waveId, status: "assigned" })
        .in("id", selectedTasks);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wms-wave-pending-tasks"] });
      qc.invalidateQueries({ queryKey: ["wms-waves"] });
      toast({ title: t("success") });
      setCreateWaveDialog(false);
      setSelectedTasks([]);
    },
    onError: () => toast({ title: t("error"), variant: "destructive" }),
  });

  const toggleTask = (id: string) => {
    setSelectedTasks(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  };

  // AI grouping: sort by zone proximity (bin zone_id), then priority
  const suggestWaveGrouping = () => {
    const zoneGroups: Record<string, string[]> = {};
    pendingTasks.forEach((t: any) => {
      const zone = t.wms_bins?.zone_id || "unknown";
      if (!zoneGroups[zone]) zoneGroups[zone] = [];
      zoneGroups[zone].push(t.id);
    });
    // Pick the largest zone group
    const largest = Object.values(zoneGroups).sort((a, b) => b.length - a.length)[0] || [];
    setSelectedTasks(largest.slice(0, 20)); // cap at 20
    toast({ title: locale === "sr" ? "AI predložio grupisanje" : "AI suggested grouping" });
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("wmsWavePlanning")} description={t("wmsWavePlanningDesc")} icon={Layers}
        actions={
          <div className="flex gap-2">
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger className="w-48"><SelectValue placeholder={t("selectWarehouse")} /></SelectTrigger>
              <SelectContent>{warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
            </Select>
            <Button onClick={() => setCreateWaveDialog(true)} disabled={!warehouseId}>
              <Layers className="h-4 w-4 mr-1" />{locale === "sr" ? "Novi talas" : "New Wave"}
            </Button>
          </div>
        } />

      <StatsBar stats={stats} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">{locale === "sr" ? "Aktivni talasi" : "Active Waves"}</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{locale === "sr" ? "Talas" : "Wave"}</TableHead>
                  <TableHead>{locale === "sr" ? "Stavke" : "Tasks"}</TableHead>
                  <TableHead>{locale === "sr" ? "Progres" : "Progress"}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {waves.map((w: any) => (
                  <TableRow key={w.waveId}>
                    <TableCell className="font-mono text-xs">{w.waveId}</TableCell>
                    <TableCell>{w.count}</TableCell>
                    <TableCell>{Math.round((w.completed / w.count) * 100)}%</TableCell>
                    <TableCell>
                      <Badge variant={w.count === w.completed ? "default" : "secondary"}>
                        {w.count === w.completed ? (locale === "sr" ? "Završen" : "Done") : (locale === "sr" ? "U toku" : "In Progress")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {waves.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Brain className="h-4 w-4" />{locale === "sr" ? "AI preporuke" : "AI Recommendations"}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{locale === "sr" ? "AI analizira zone i prioritete da predloži optimalne talase." : "AI analyzes zones and priorities to suggest optimal waves."}</p>
            <Button variant="outline" size="sm" onClick={suggestWaveGrouping} disabled={!pendingTasks.length}>
              <Zap className="h-3 w-3 mr-1" />{locale === "sr" ? "Predloži grupu" : "Suggest Grouping"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={createWaveDialog} onOpenChange={setCreateWaveDialog}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{locale === "sr" ? "Kreiraj talas" : "Create Wave"}</DialogTitle></DialogHeader>
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm text-muted-foreground">{locale === "sr" ? `Izabrano: ${selectedTasks.length}` : `Selected: ${selectedTasks.length}`}</p>
            <Button variant="outline" size="sm" onClick={suggestWaveGrouping}><Brain className="h-3 w-3 mr-1" />AI Group</Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Bin</TableHead>
                <TableHead>{t("product")}</TableHead>
                <TableHead>{locale === "sr" ? "Prioritet" : "Priority"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingTasks.map((task: any) => (
                <TableRow key={task.id}>
                  <TableCell><Checkbox checked={selectedTasks.includes(task.id)} onCheckedChange={() => toggleTask(task.id)} /></TableCell>
                  <TableCell className="font-mono text-xs">{task.wms_bins?.code}</TableCell>
                  <TableCell>{task.products?.name}</TableCell>
                  <TableCell><Badge variant={task.priority >= 8 ? "destructive" : task.priority >= 5 ? "secondary" : "outline"}>{task.priority}</Badge></TableCell>
                </TableRow>
              ))}
              {pendingTasks.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>}
            </TableBody>
          </Table>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateWaveDialog(false)}>{t("cancel")}</Button>
            <Button onClick={() => createWaveMutation.mutate()} disabled={!selectedTasks.length || createWaveMutation.isPending}>
              <Play className="h-3 w-3 mr-1" />{locale === "sr" ? "Kreiraj" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
