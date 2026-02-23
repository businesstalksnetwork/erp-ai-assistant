import { useMemo } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatsBar } from "@/components/shared/StatsBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Clock, Zap, TrendingUp, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function WmsLabor() {
  const { t, locale } = useLanguage();
  const { tenantId } = useTenant();

  // Derive labor metrics from completed tasks
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
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const profileMap = useMemo(() => {
    const m: Record<string, string> = {};
    profiles.forEach((p: any) => { m[p.id] = p.full_name || p.id.substring(0, 8); });
    return m;
  }, [profiles]);

  // Worker performance metrics
  const workerMetrics = useMemo(() => {
    const workers: Record<string, { tasks: number; totalMinutes: number; totalItems: number; taskTypes: Record<string, number> }> = {};
    tasks.forEach((task: any) => {
      const wid = task.assigned_to;
      if (!workers[wid]) workers[wid] = { tasks: 0, totalMinutes: 0, totalItems: 0, taskTypes: {} };
      workers[wid].tasks++;
      const mins = (new Date(task.completed_at).getTime() - new Date(task.started_at).getTime()) / 60000;
      workers[wid].totalMinutes += mins;
      workers[wid].totalItems += task.quantity || 0;
      workers[wid].taskTypes[task.task_type] = (workers[wid].taskTypes[task.task_type] || 0) + 1;
    });

    return Object.entries(workers).map(([id, data]) => ({
      id,
      name: profileMap[id] || id.substring(0, 8),
      tasks: data.tasks,
      avgMinutes: data.tasks > 0 ? Math.round(data.totalMinutes / data.tasks) : 0,
      totalItems: data.totalItems,
      itemsPerHour: data.totalMinutes > 0 ? Math.round((data.totalItems / data.totalMinutes) * 60) : 0,
      topType: Object.entries(data.taskTypes).sort((a, b) => b[1] - a[1])[0]?.[0] || "—",
    })).sort((a, b) => b.itemsPerHour - a.itemsPerHour);
  }, [tasks, profileMap]);

  // Task type distribution
  const typeDistribution = useMemo(() => {
    const dist: Record<string, number> = {};
    tasks.forEach((t: any) => { dist[t.task_type] = (dist[t.task_type] || 0) + 1; });
    return Object.entries(dist).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [tasks]);

  const totalTasks = tasks.length;
  const avgCompletionMin = tasks.length > 0
    ? Math.round(tasks.reduce((s: number, t: any) => s + (new Date(t.completed_at).getTime() - new Date(t.started_at).getTime()) / 60000, 0) / tasks.length)
    : 0;
  const totalItems = tasks.reduce((s: number, t: any) => s + (t.quantity || 0), 0);
  const uniqueWorkers = workerMetrics.length;

  const stats = [
    { label: locale === "sr" ? "Radnika" : "Workers", value: uniqueWorkers, icon: Users, color: "text-primary" },
    { label: locale === "sr" ? "Završenih zadataka" : "Completed Tasks", value: totalTasks, icon: Zap, color: "text-primary" },
    { label: locale === "sr" ? "Prosečno vreme" : "Avg Time", value: `${avgCompletionMin}m`, icon: Clock, color: "text-amber-500" },
    { label: locale === "sr" ? "Ukupno artikala" : "Total Items", value: totalItems, icon: TrendingUp, color: "text-primary" },
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

      <Card>
        <CardHeader><CardTitle>{locale === "sr" ? "Performanse radnika" : "Worker Performance"}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{locale === "sr" ? "Radnik" : "Worker"}</TableHead>
                <TableHead>{locale === "sr" ? "Zadaci" : "Tasks"}</TableHead>
                <TableHead>{locale === "sr" ? "Prosečno vreme" : "Avg Time"}</TableHead>
                <TableHead>{locale === "sr" ? "Ukupno artikala" : "Total Items"}</TableHead>
                <TableHead>{locale === "sr" ? "Artikli/sat" : "Items/Hour"}</TableHead>
                <TableHead>{locale === "sr" ? "Najčešći tip" : "Top Type"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workerMetrics.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>
              ) : workerMetrics.map(w => (
                <TableRow key={w.id}>
                  <TableCell className="font-medium">{w.name}</TableCell>
                  <TableCell>{w.tasks}</TableCell>
                  <TableCell>{w.avgMinutes}m</TableCell>
                  <TableCell>{w.totalItems}</TableCell>
                  <TableCell><Badge variant="outline">{w.itemsPerHour}/h</Badge></TableCell>
                  <TableCell><Badge variant="secondary" className="text-[10px]">{w.topType}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
