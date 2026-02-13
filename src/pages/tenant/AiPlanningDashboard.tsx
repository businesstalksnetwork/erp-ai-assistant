import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatsBar } from "@/components/shared/StatsBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, Activity, Clock, AlertTriangle, AlertCircle, Info, Loader2, Sparkles, BarChart3, CalendarDays, RefreshCw, Package } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { useNavigate } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { formatDistanceToNow } from "date-fns";

interface DashboardInsights {
  schedule_adherence_pct: number;
  capacity_utilization_pct: number;
  active_orders: number;
  late_orders: number;
  insights: { severity: "critical" | "warning" | "info"; title: string; description: string }[];
}

const severityConfig = {
  critical: { icon: AlertCircle, color: "text-destructive", badge: "destructive" as const },
  warning: { icon: AlertTriangle, color: "text-accent", badge: "secondary" as const },
  info: { icon: Info, color: "text-primary", badge: "outline" as const },
};

const STATUS_COLORS: Record<string, string> = { draft: "hsl(var(--muted-foreground))", in_progress: "hsl(var(--primary))", completed: "hsl(var(--accent))", cancelled: "hsl(var(--destructive))" };

export default function AiPlanningDashboard() {
  const { t, locale } = useLanguage();
  const { tenantId } = useTenant();
  const navigate = useNavigate();
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const { data, isLoading, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["ai-planning-dashboard", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("production-ai-planning", {
        body: { action: "dashboard-insights", tenant_id: tenantId, language: locale },
      });
      if (error) throw error;
      return data as DashboardInsights;
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 10, // auto-refresh every 10 min
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (dataUpdatedAt) setLastUpdated(new Date(dataUpdatedAt));
  }, [dataUpdatedAt]);

  // Fetch production orders for donut chart
  const { data: orderStatusData = [] } = useQuery({
    queryKey: ["production-order-status", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("production_orders").select("status").eq("tenant_id", tenantId!);
      if (error) throw error;
      const counts: Record<string, number> = {};
      data.forEach((o: any) => { counts[o.status] = (counts[o.status] || 0) + 1; });
      return Object.entries(counts).map(([name, value]) => ({ name, value }));
    },
    enabled: !!tenantId,
  });

  // Fetch material readiness
  const { data: materialReadiness = [] } = useQuery({
    queryKey: ["material-readiness", tenantId],
    queryFn: async () => {
      const { data: orders } = await supabase.from("production_orders").select("id, order_number, bom_template_id, bom_templates(name)").eq("tenant_id", tenantId!).in("status", ["draft", "in_progress"]).limit(10);
      if (!orders?.length) return [];
      const readiness = [];
      for (const order of orders) {
        if (!order.bom_template_id) continue;
        const { data: bomLines } = await supabase.from("bom_lines").select("material_product_id, quantity").eq("bom_template_id", order.bom_template_id);
        if (!bomLines?.length) continue;
        let allReady = true, anyMissing = false;
        for (const bl of bomLines) {
          const { data: stock } = await supabase.from("inventory_stock").select("on_hand").eq("product_id", bl.material_product_id).eq("tenant_id", tenantId!);
          const total = stock?.reduce((s: number, st: any) => s + st.on_hand, 0) || 0;
          if (total < bl.quantity) { anyMissing = true; allReady = false; }
        }
        readiness.push({ id: order.id, order_number: order.order_number, bom: (order as any).bom_templates?.name, status: allReady ? "green" : anyMissing ? "red" : "yellow" });
      }
      return readiness;
    },
    enabled: !!tenantId,
  });

  const handleRefresh = async () => {
    try {
      await refetch();
      toast.success(locale === "sr" ? "AI analiza završena" : "AI analysis complete");
    } catch {
      toast.error(locale === "sr" ? "Greška pri generisanju" : "Error generating insights");
    }
  };

  const stats = data ? [
    { label: t("scheduleAdherence"), value: `${data.schedule_adherence_pct}%`, icon: Activity, color: "text-primary" },
    { label: t("capacityUtilization"), value: `${data.capacity_utilization_pct}%`, icon: BarChart3, color: "text-accent" },
    { label: t("productionOrders"), value: data.active_orders, icon: CalendarDays, color: "text-primary" },
    { label: t("lateOrders"), value: data.late_orders, icon: Clock, color: data.late_orders > 0 ? "text-destructive" : "text-muted-foreground" },
  ] : [];

  return (
    <div className="space-y-6">
      <PageHeader title={t("aiPlanningDashboard")} />

      <div className="flex gap-2 flex-wrap items-center">
        <Button onClick={handleRefresh} disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <Brain className="h-4 w-4" />
          {t("generateAiPlan")}
        </Button>
        <Button variant="outline" onClick={() => navigate("/production/ai-planning/schedule")}>
          <CalendarDays className="h-4 w-4" /> {t("aiSchedule")}
        </Button>
        <Button variant="outline" onClick={() => navigate("/production/ai-planning/bottlenecks")}>
          <AlertTriangle className="h-4 w-4" /> {t("bottleneckPrediction")}
        </Button>
        <Button variant="outline" onClick={() => navigate("/production/ai-planning/scenarios")}>
          <BarChart3 className="h-4 w-4" /> {t("capacitySimulation")}
        </Button>
        <Button variant="outline" onClick={() => navigate("/production/ai-planning/calendar")}>
          <CalendarDays className="h-4 w-4" /> {t("productionCalendar")}
        </Button>
        {lastUpdated && (
          <span className="text-xs text-muted-foreground ml-auto">{t("lastUpdated")}: {formatDistanceToNow(lastUpdated, { addSuffix: true })}</span>
        )}
      </div>

      {isLoading && !data && (
        <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" />
          {locale === "sr" ? "AI analizira podatke..." : "AI analyzing production data..."}
        </div>
      )}

      {data && (
        <>
          <StatsBar stats={stats} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Order Status Donut */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">{t("orderStatusBreakdown")}</CardTitle></CardHeader>
              <CardContent>
                {orderStatusData.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">{t("noResults")}</p>
                ) : (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width={160} height={160}>
                      <PieChart>
                        <Pie data={orderStatusData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" strokeWidth={2}>
                          {orderStatusData.map((entry, i) => (
                            <Cell key={i} fill={STATUS_COLORS[entry.name] || "hsl(var(--muted))"} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-1.5">
                      {orderStatusData.map(d => (
                        <div key={d.name} className="flex items-center gap-2 text-xs">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[d.name] || "hsl(var(--muted))" }} />
                          <span className="capitalize">{d.name.replace("_", " ")}</span>
                          <span className="font-medium ml-auto">{d.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Material Readiness */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Package className="h-4 w-4" />{t("materialReadiness")}</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {materialReadiness.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">{t("noResults")}</p>
                ) : materialReadiness.map((m: any) => (
                  <button key={m.id} onClick={() => navigate(`/production/orders/${m.id}`)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors text-left">
                    <div>
                      <span className="font-mono font-medium">{m.order_number}</span>
                      <span className="text-xs text-muted-foreground ml-2">{m.bom}</span>
                    </div>
                    <span className={`h-3 w-3 rounded-full ${m.status === "green" ? "bg-primary" : m.status === "red" ? "bg-destructive" : "bg-accent"}`} />
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* AI Insights */}
          <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                {t("aiInsights")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.insights?.map((insight, i) => {
                const config = severityConfig[insight.severity];
                const Icon = config.icon;
                return (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-background/60">
                    <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${config.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{insight.title}</span>
                        <Badge variant={config.badge} className="text-[10px]">{insight.severity}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{insight.description}</p>
                    </div>
                  </div>
                );
              })}
              {(!data.insights || data.insights.length === 0) && (
                <p className="text-sm text-muted-foreground">{locale === "sr" ? "Nema uvida za prikaz." : "No insights to display."}</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
