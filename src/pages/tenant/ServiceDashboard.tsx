import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { ClipboardCheck, AlertTriangle, Clock, DollarSign } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  received: "hsl(var(--primary))",
  diagnosed: "hsl(210,60%,50%)",
  in_repair: "hsl(40,90%,50%)",
  waiting_parts: "hsl(30,80%,50%)",
  completed: "hsl(140,60%,40%)",
  delivered: "hsl(200,10%,60%)",
  cancelled: "hsl(0,60%,50%)",
};

export default function ServiceDashboard() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();

  const { data: orders = [] } = useQuery({
    queryKey: ["service-dashboard-orders", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_orders")
        .select("id, status, priority, total_amount, created_at, estimated_completion, intake_channel")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false })
        .limit(1000);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: workOrders = [] } = useQuery({
    queryKey: ["service-dashboard-wo", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_work_orders")
        .select("id, status, assigned_to, employees(first_name, last_name)")
        .eq("tenant_id", tenantId!)
        .in("status", ["pending", "in_progress"]);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const statusLabel = (s: string) => (t as any)(`status${s.charAt(0).toUpperCase() + s.slice(1).replace(/_([a-z])/g, (_: string, c: string) => c.toUpperCase())}`) || s;

  // KPIs
  const openStatuses = ["received", "diagnosed", "in_repair", "waiting_parts"];
  const openOrders = orders.filter((o: any) => openStatuses.includes(o.status));
  const urgentOrders = orders.filter((o: any) => o.priority === "urgent" && openStatuses.includes(o.status));
  const overdueOrders = openOrders.filter((o: any) => o.estimated_completion && new Date(o.estimated_completion) < new Date());

  const completedOrders = orders.filter((o: any) => o.status === "completed" || o.status === "delivered");
  const avgRepairDays = completedOrders.length > 0
    ? Math.round(completedOrders.reduce((sum: number, o: any) => {
        const created = new Date(o.created_at).getTime();
        return sum + (Date.now() - created) / 86400000;
      }, 0) / completedOrders.length)
    : 0;

  const monthlyRevenue = orders
    .filter((o: any) => {
      const d = new Date(o.created_at);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0);

  // Status distribution for pie
  const statusCounts = orders.reduce((acc: Record<string, number>, o: any) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});
  const pieData = Object.entries(statusCounts).map(([name, value]) => ({ name: statusLabel(name), value, fill: STATUS_COLORS[name] || "hsl(var(--muted))" }));

  // Technician workload
  const techLoad = workOrders.reduce((acc: Record<string, { name: string; count: number }>, wo: any) => {
    const emp = wo.employees as any;
    const key = wo.assigned_to || "unassigned";
    if (!acc[key]) acc[key] = { name: emp ? `${emp.first_name} ${emp.last_name}` : t("unassigned" as any) || "Unassigned", count: 0 };
    acc[key].count++;
    return acc;
  }, {});
  const barData = Object.values(techLoad).sort((a, b) => b.count - a.count);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-bold">{t("serviceOverview")}</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><ClipboardCheck className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{openOrders.length}</p>
              <p className="text-xs text-muted-foreground">{t("openServiceOrders")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10"><AlertTriangle className="h-5 w-5 text-destructive" /></div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{urgentOrders.length}</p>
              <p className="text-xs text-muted-foreground">{t("urgentServiceOrders")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted"><Clock className="h-5 w-5 text-muted-foreground" /></div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{avgRepairDays}d</p>
              <p className="text-xs text-muted-foreground">{t("estimatedCompletion")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10"><DollarSign className="h-5 w-5 text-green-600" /></div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{monthlyRevenue.toLocaleString("sr-RS")}</p>
              <p className="text-xs text-muted-foreground">RSD</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {overdueOrders.length > 0 && (
        <Card className="border-destructive/30">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-destructive">⚠ {overdueOrders.length} {t("overdueRepairs" as any) || "overdue repairs"}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status pie */}
        <Card>
          <CardHeader><CardTitle className="text-sm">{t("status")}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50} paddingAngle={2}>
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-2 mt-2 justify-center">
              {pieData.map((d, i) => (
                <Badge key={i} variant="outline" className="text-xs gap-1">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: d.fill }} />
                  {d.name}: {d.value}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Technician workload */}
        <Card>
          <CardHeader><CardTitle className="text-sm">{t("technicianWorkload")}</CardTitle></CardHeader>
          <CardContent>
            {barData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">{t("noResults")}</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={barData} layout="vertical">
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
