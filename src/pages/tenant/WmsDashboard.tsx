import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LayoutDashboard, Package, ClipboardCheck, Truck, ScanBarcode, RefreshCw, Activity } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const COLORS = ["hsl(var(--primary))", "hsl(var(--muted-foreground))", "hsl(var(--destructive))", "hsl(var(--chart-4))", "hsl(var(--chart-5))", "hsl(var(--chart-3))"];

export default function WmsDashboard() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const navigate = useNavigate();

  const { data: bins = [] } = useQuery({
    queryKey: ["wms-dashboard-bins", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("wms_bins").select("id, bin_type, max_units").eq("tenant_id", tenantId!);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: binStock = [] } = useQuery({
    queryKey: ["wms-dashboard-bin-stock", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("wms_bin_stock").select("bin_id, quantity").eq("tenant_id", tenantId!);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["wms-dashboard-tasks", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("wms_tasks").select("id, task_type, status, completed_at, created_at").eq("tenant_id", tenantId!);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: zones = [] } = useQuery({
    queryKey: ["wms-dashboard-zones", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("wms_zones").select("id, name, zone_type, warehouse_id, warehouses(name)").eq("tenant_id", tenantId!);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // KPIs
  const totalBins = bins.length;
  const occupiedBinIds = new Set(binStock.map((s: any) => s.bin_id));
  const occupiedBins = occupiedBinIds.size;
  const utilization = totalBins > 0 ? Math.round((occupiedBins / totalBins) * 100) : 0;

  const today = new Date().toDateString();
  const pendingTasks = tasks.filter((t: any) => t.status === "pending").length;
  const inProgressTasks = tasks.filter((t: any) => t.status === "in_progress").length;
  const completedToday = tasks.filter((t: any) => t.status === "completed" && t.completed_at && new Date(t.completed_at).toDateString() === today).length;
  const exceptionTasks = tasks.filter((t: any) => t.status === "exception").length;

  // Task status pie
  const taskStatusData = [
    { name: t("pending"), value: pendingTasks },
    { name: t("wmsInProgress"), value: inProgressTasks },
    { name: t("completed"), value: tasks.filter((t: any) => t.status === "completed").length },
    { name: t("exceptions"), value: exceptionTasks },
    { name: t("cancelled"), value: tasks.filter((t: any) => t.status === "cancelled").length },
  ].filter(d => d.value > 0);

  // Tasks by type bar
  const taskTypeMap: Record<string, number> = {};
  tasks.forEach((t: any) => { taskTypeMap[t.task_type] = (taskTypeMap[t.task_type] || 0) + 1; });
  const taskTypeData = Object.entries(taskTypeMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  // Throughput trend (last 14 days)
  const throughputData = (() => {
    const dayMap: Record<string, number> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dayMap[d.toISOString().split("T")[0]] = 0;
    }
    tasks.forEach((t: any) => {
      if (t.status === "completed" && t.completed_at) {
        const day = t.completed_at.split("T")[0];
        if (dayMap[day] !== undefined) dayMap[day]++;
      }
    });
    return Object.entries(dayMap).map(([date, count]) => ({ date: date.slice(5), count }));
  })();
  
  // Recent activity
  const recentTasks = [...tasks]
    .filter((t: any) => t.status === "completed" || t.status === "exception")
    .sort((a: any, b: any) => new Date(b.completed_at || b.created_at).getTime() - new Date(a.completed_at || a.created_at).getTime())
    .slice(0, 15);

  return (
    <div className="space-y-6">
      <PageHeader title={t("wmsDashboard")} description={t("wmsDashboardDesc")} icon={LayoutDashboard} />

      {/* KPI Cards */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <Card><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground uppercase">{t("totalBins")}</p><p className="mt-2 text-2xl font-bold">{totalBins}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground uppercase">{t("occupiedBins")}</p><p className="mt-2 text-2xl font-bold">{occupiedBins}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground uppercase">{t("utilizationPercent")}</p><p className="mt-2 text-2xl font-bold">{utilization}%</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground uppercase">{t("pending")}</p><p className="mt-2 text-2xl font-bold">{pendingTasks}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground uppercase">{t("wmsInProgress")}</p><p className="mt-2 text-2xl font-bold">{inProgressTasks}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground uppercase">{t("completedToday")}</p><p className="mt-2 text-2xl font-bold">{completedToday}</p></CardContent></Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>{t("taskStatusBreakdown")}</CardTitle></CardHeader>
          <CardContent className="h-64">
            {taskStatusData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center pt-16">{t("noResults")}</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={taskStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                    {taskStatusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("tasksByType")}</CardTitle></CardHeader>
          <CardContent className="h-64">
            {taskTypeData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center pt-16">{t("noResults")}</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={taskTypeData}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Throughput Trend */}
      <Card>
        <CardHeader><CardTitle>{"Throughput (14 days)"}</CardTitle></CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={throughputData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Zone Heatmap */}
      <Card>
        <CardHeader><CardTitle>{t("zoneOverview")}</CardTitle></CardHeader>
        <CardContent>
          {zones.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noResults")}</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {zones.map((zone: any) => (
                <div key={zone.id} className="border rounded-lg p-3 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{zone.name}</span>
                    <Badge variant="outline" className="text-[10px]">{zone.zone_type}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{(zone as any).warehouses?.name}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-4 w-4" />{t("recentActivity")}</CardTitle></CardHeader>
          <CardContent>
            {recentTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noResults")}</p>
            ) : (
              <div className="space-y-2">
                {recentTasks.map((task: any) => (
                  <div key={task.id} className="flex items-center justify-between text-sm border-b border-border/50 pb-2 last:border-0">
                    <div className="flex items-center gap-2">
                      <Badge variant={task.status === "exception" ? "destructive" : "default"} className="text-[10px]">{task.task_type}</Badge>
                      <span className="text-muted-foreground">{t(task.status as any)}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{new Date(task.completed_at || task.created_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("quickActions")}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate("/inventory/wms/receiving")}>
              <Truck className="h-4 w-4 mr-2" />{t("newReceiving")}
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate("/inventory/wms/picking")}>
              <ScanBarcode className="h-4 w-4 mr-2" />{t("wmsPicking")}
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate("/inventory/wms/cycle-counts")}>
              <RefreshCw className="h-4 w-4 mr-2" />{t("wmsCycleCounts")}
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate("/inventory/wms/tasks")}>
              <ClipboardCheck className="h-4 w-4 mr-2" />{t("wmsTasks")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
