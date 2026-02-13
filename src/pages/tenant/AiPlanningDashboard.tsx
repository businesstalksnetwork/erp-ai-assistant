import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatsBar } from "@/components/shared/StatsBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, Activity, Clock, AlertTriangle, AlertCircle, Info, Loader2, Sparkles, BarChart3, CalendarDays } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { useNavigate } from "react-router-dom";

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

export default function AiPlanningDashboard() {
  const { t, locale } = useLanguage();
  const { tenantId } = useTenant();
  const navigate = useNavigate();
  const [generating, setGenerating] = useState(false);

  const { data, isLoading, refetch } = useQuery({
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
    refetchOnWindowFocus: false,
  });

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await refetch();
      toast.success(locale === "sr" ? "AI analiza završena" : "AI analysis complete");
    } catch {
      toast.error(locale === "sr" ? "Greška pri generisanju" : "Error generating insights");
    } finally {
      setGenerating(false);
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

      <div className="flex gap-2 flex-wrap">
        <Button onClick={handleGenerate} disabled={generating || isLoading}>
          {(generating || isLoading) && <Loader2 className="h-4 w-4 animate-spin" />}
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
