import { useMemo } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatsBar } from "@/components/shared/StatsBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Clock, Zap, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/shared/ResponsiveTable";

export default function WmsLabor() {
  const { t, locale } = useLanguage();
  const { tenantId } = useTenant();

  const { data: tasks = [] } = useQuery({
    queryKey: ["wms-labor-tasks", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wms_tasks")
        .select("id, task_type, status, assigned_to, started_at, completed_at, quantity, warehouse_id, warehouses(name)")
        .eq("tenant_id", tenantId!)
        .eq("status", "completed")
        .not("assigned_to", "is", null)
        .not("started_at", "is", null)
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["wms-labor-profiles", tenantId],
    queryFn: async () => { const { data } = await supabase.from("profiles").select("id, full_name"); return data || []; },
    enabled: !!tenantId,
  });

  const profileMap = useMemo(() => {
    const m: Record<string, string> = {};
    profiles.forEach((p: any) => { m[p.id] = p.full_name || p.id.substring(0, 8); });
    return m;
  }, [profiles]);

  const workerMetrics = useMemo(() => {
    const workers: Record<string, { tasks: number; totalMinutes: number; totalItems: number; taskTypes: Record<string, number>; hourlyOutput: Map<number, number> }> = {};
    tasks.forEach((task: any) => {
      const wid = task.assigned_to;
      if (!workers[wid]) workers[wid] = { tasks: 0, totalMinutes: 0, totalItems: 0, taskTypes: {}, hourlyOutput: new Map() };
      workers[wid].tasks++;
      const durationMin = (new Date(task.completed_at).getTime() - new Date(task.started_at).getTime()) / 60000;
      workers[wid].totalMinutes += durationMin;
      workers[wid].totalItems += task.quantity || 0;
      workers[wid].taskTypes[task.task_type] = (workers[wid].taskTypes[task.task_type] || 0) + 1;
      // Track hourly output for shift analysis
      const hour = new Date(task.started_at).getHours();
      workers[wid].hourlyOutput.set(hour, (workers[wid].hourlyOutput.get(hour) || 0) + (task.quantity || 0));
    });
    return Object.entries(workers).map(([id, data]) => {
      const peakHour = Array.from(data.hourlyOutput.entries()).sort((a, b) => b[1] - a[1])[0];
      const shift = peakHour ? (peakHour[0] < 14 ? "Morning" : peakHour[0] < 22 ? "Afternoon" : "Night") : "—";
      const efficiency = data.totalMinutes > 0 ? Math.round((data.totalItems / data.totalMinutes) * 60) : 0;
      const rank = efficiency > 50 ? "⭐ Top" : efficiency > 20 ? "Good" : "Training";
      return {
        id, name: profileMap[id] || id.substring(0, 8), tasks: data.tasks,
        avgMinutes: data.tasks > 0 ? Math.round(data.totalMinutes / data.tasks) : 0,
        totalItems: data.totalItems,
        itemsPerHour: efficiency,
        topType: Object.entries(data.taskTypes).sort((a, b) => b[1] - a[1])[0]?.[0] || "—",
        shift, rank,
      };
    }).sort((a, b) => b.itemsPerHour - a.itemsPerHour);
  }, [tasks, profileMap]);

  const typeDistribution = useMemo(() => {
    const dist: Record<string, number> = {};
    tasks.forEach((t: any) => { dist[t.task_type] = (dist[t.task_type] || 0) + 1; });
    return Object.entries(dist).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [tasks]);

  const totalTasks = tasks.length;
  const avgCompletionMin = tasks.length > 0
    ? Math.round(tasks.reduce((s: number, t: any) => s + (new Date(t.completed_at).getTime() - new Date(t.started_at).getTime()) / 60000, 0) / tasks.length) : 0;
  const totalItems = tasks.reduce((s: number, t: any) => s + (t.quantity || 0), 0);

  const stats = [
    { label: locale === "sr" ? "Radnika" : "Workers", value: workerMetrics.length, icon: Users, color: "text-primary" },
    { label: locale === "sr" ? "Završenih zadataka" : "Completed Tasks", value: totalTasks, icon: Zap, color: "text-primary" },
    { label: locale === "sr" ? "Prosečno vreme" : "Avg Time", value: `${avgCompletionMin}m`, icon: Clock, color: "text-amber-500" },
    { label: locale === "sr" ? "Ukupno artikala" : "Total Items", value: totalItems, icon: TrendingUp, color: "text-primary" },
  ];

  const columns: ResponsiveColumn<typeof workerMetrics[number]>[] = [
    { key: "name", label: locale === "sr" ? "Radnik" : "Worker", primary: true, sortable: true, sortValue: (w) => w.name, render: (w) => <span className="font-medium">{w.name}</span> },
    { key: "rank", label: locale === "sr" ? "Rang" : "Rank", render: (w) => <Badge variant={w.rank === "⭐ Top" ? "default" : "secondary"} className="text-[10px]">{w.rank}</Badge> },
    { key: "tasks", label: locale === "sr" ? "Zadaci" : "Tasks", align: "right", sortable: true, sortValue: (w) => w.tasks, render: (w) => w.tasks },
    { key: "avgMinutes", label: locale === "sr" ? "Prosečno vreme" : "Avg Time", align: "right", sortable: true, sortValue: (w) => w.avgMinutes, render: (w) => `${w.avgMinutes}m` },
    { key: "totalItems", label: locale === "sr" ? "Ukupno artikala" : "Total Items", align: "right", sortable: true, sortValue: (w) => w.totalItems, render: (w) => w.totalItems },
    { key: "itemsPerHour", label: locale === "sr" ? "Artikli/sat" : "Items/Hour", align: "right", sortable: true, sortValue: (w) => w.itemsPerHour, render: (w) => <Badge variant="outline">{w.itemsPerHour}/h</Badge> },
    { key: "shift", label: locale === "sr" ? "Smena" : "Shift", render: (w) => <Badge variant="secondary" className="text-[10px]">{w.shift}</Badge> },
    { key: "topType", label: locale === "sr" ? "Najčešći tip" : "Top Type", render: (w) => <Badge variant="secondary" className="text-[10px]">{w.topType}</Badge> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={locale === "sr" ? "Produktivnost radnika" : "Labor Productivity"}
        description={locale === "sr" ? "Analiza performansi skladišnih radnika" : "Warehouse worker performance analytics"}
        icon={Users}
      />
      <StatsBar stats={stats} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>{locale === "sr" ? "Zadaci po tipu" : "Tasks by Type"}</CardTitle></CardHeader>
          <CardContent className="h-64">
            {typeDistribution.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center pt-16">{t("noResults")}</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={typeDistribution}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{locale === "sr" ? "Artikli/sat po radniku" : "Items/Hour by Worker"}</CardTitle></CardHeader>
          <CardContent className="h-64">
            {workerMetrics.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center pt-16">{t("noResults")}</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workerMetrics.slice(0, 10)} layout="vertical">
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="itemsPerHour" fill="hsl(var(--chart-4))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <ResponsiveTable
        data={workerMetrics}
        columns={columns}
        keyExtractor={(w) => w.id}
        emptyMessage={t("noResults")}
        enableExport
        exportFilename="wms_labor_productivity"
      />
    </div>
  );
}
