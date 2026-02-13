import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Brain, Loader2, AlertCircle, AlertTriangle, Info, Package, CalendarDays, Clock, TrendingUp, TrendingDown, ChevronDown, CheckCircle, Eye } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { useNavigate } from "react-router-dom";

interface Bottleneck {
  type: "material_shortage" | "overloaded_period" | "late_order_risk";
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  suggested_action: string;
  affected_orders?: string[];
  material_detail?: { product: string; required: number; available: number; deficit: number };
}

const typeIcons = {
  material_shortage: Package,
  overloaded_period: CalendarDays,
  late_order_risk: Clock,
};

const severityConfig = {
  critical: { icon: AlertCircle, color: "text-destructive", badge: "destructive" as const },
  warning: { icon: AlertTriangle, color: "text-accent", badge: "secondary" as const },
  info: { icon: Info, color: "text-primary", badge: "outline" as const },
};

export default function AiBottleneckPrediction() {
  const { t, locale } = useLanguage();
  const { tenantId } = useTenant();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [bottlenecks, setBottlenecks] = useState<Bottleneck[] | null>(null);
  const [previousCount, setPreviousCount] = useState<number | null>(null);
  const [actionState, setActionState] = useState<Record<number, "acknowledged" | "resolved">>({});
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  const analyze = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      if (bottlenecks) setPreviousCount(bottlenecks.length);
      const { data, error } = await supabase.functions.invoke("production-ai-planning", {
        body: { action: "predict-bottlenecks", tenant_id: tenantId, language: locale },
      });
      if (error) throw error;
      setBottlenecks((data as any).bottlenecks || []);
      toast.success(locale === "sr" ? "Analiza završena" : "Analysis complete");
    } catch {
      toast.error(locale === "sr" ? "Greška pri analizi" : "Error analyzing bottlenecks");
    } finally { setLoading(false); }
  };

  // Auto-analyze on mount
  useEffect(() => { if (tenantId && !bottlenecks) analyze(); }, [tenantId]);

  const filtered = bottlenecks?.filter(b => severityFilter === "all" || b.severity === severityFilter) || [];
  const trendDiff = previousCount !== null && bottlenecks ? bottlenecks.length - previousCount : null;

  const toggleAction = (idx: number) => {
    setActionState(prev => {
      const current = prev[idx];
      if (!current) return { ...prev, [idx]: "acknowledged" };
      if (current === "acknowledged") return { ...prev, [idx]: "resolved" };
      const next = { ...prev };
      delete next[idx];
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("bottleneckPrediction")} />

      <div className="flex gap-2 items-center flex-wrap">
        <Button onClick={analyze} disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          <Brain className="h-4 w-4" /> {t("generateAiPlan")}
        </Button>
        {bottlenecks && (
          <div className="flex items-center gap-2 ml-auto">
            {trendDiff !== null && trendDiff !== 0 && (
              <Badge variant={trendDiff > 0 ? "destructive" : "secondary"} className="flex items-center gap-1">
                {trendDiff > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {trendDiff > 0 ? "+" : ""}{trendDiff} {locale === "sr" ? "vs prethodno" : "vs previous"}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">{bottlenecks.length} {locale === "sr" ? "pronađeno" : "found"}</span>
          </div>
        )}
      </div>

      {bottlenecks !== null && (
        <Tabs value={severityFilter} onValueChange={setSeverityFilter}>
          <TabsList>
            <TabsTrigger value="all">{locale === "sr" ? "Sve" : "All"} ({bottlenecks.length})</TabsTrigger>
            <TabsTrigger value="critical">Critical ({bottlenecks.filter(b => b.severity === "critical").length})</TabsTrigger>
            <TabsTrigger value="warning">Warning ({bottlenecks.filter(b => b.severity === "warning").length})</TabsTrigger>
            <TabsTrigger value="info">Info ({bottlenecks.filter(b => b.severity === "info").length})</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {bottlenecks && filtered.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {locale === "sr" ? "Nisu pronađena uska grla." : "No bottlenecks detected."}
          </CardContent>
        </Card>
      )}

      {filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((b, i) => {
            const globalIdx = bottlenecks!.indexOf(b);
            const sev = severityConfig[b.severity];
            const SevIcon = sev.icon;
            const TypeIcon = typeIcons[b.type];
            const action = actionState[globalIdx];

            return (
              <Collapsible key={i}>
                <Card className={action === "resolved" ? "opacity-50" : ""}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <SevIcon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${sev.color}`} />
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{b.title}</span>
                          <Badge variant={sev.badge} className="text-[10px]">{b.severity}</Badge>
                          <Badge variant="outline" className="text-[10px] flex items-center gap-1">
                            <TypeIcon className="h-2.5 w-2.5" />
                            {t(b.type === "material_shortage" ? "materialShortage" : b.type === "overloaded_period" ? "overloadedPeriod" : "lateOrders")}
                          </Badge>
                          {action && (
                            <Badge variant={action === "resolved" ? "default" : "secondary"} className="text-[10px]">
                              {action === "resolved" ? t("resolved") : t("acknowledged")}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{b.description}</p>
                        <div className="bg-muted/50 rounded p-2">
                          <p className="text-xs"><span className="font-medium">{t("suggestedAction")}:</span> {b.suggested_action}</p>
                        </div>

                        {/* Material shortage detail */}
                        {b.type === "material_shortage" && b.material_detail && (
                          <div className="grid grid-cols-3 gap-2 text-xs bg-destructive/5 rounded p-2">
                            <div><span className="text-muted-foreground">{locale === "sr" ? "Potrebno" : "Required"}:</span> <span className="font-medium">{b.material_detail.required}</span></div>
                            <div><span className="text-muted-foreground">{t("available")}:</span> <span className="font-medium">{b.material_detail.available}</span></div>
                            <div><span className="text-muted-foreground">{locale === "sr" ? "Deficit" : "Deficit"}:</span> <span className="font-medium text-destructive">{b.material_detail.deficit}</span></div>
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => toggleAction(globalIdx)}>
                            {!action ? <Eye className="h-3 w-3 mr-1" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                            {!action ? t("acknowledged") : action === "acknowledged" ? t("resolved") : locale === "sr" ? "Poništi" : "Undo"}
                          </Button>

                          {b.affected_orders && b.affected_orders.length > 0 && (
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 text-xs">
                                <ChevronDown className="h-3 w-3 mr-1" />
                                {b.affected_orders.length} {locale === "sr" ? "naloga" : "orders"}
                              </Button>
                            </CollapsibleTrigger>
                          )}
                        </div>

                        <CollapsibleContent>
                          {b.affected_orders && (
                            <div className="flex gap-1 flex-wrap pt-1">
                              {b.affected_orders.map(o => (
                                <Badge key={o} variant="outline" className="text-[10px] cursor-pointer hover:bg-muted"
                                  onClick={() => navigate(`/production/orders/${o}`)}>
                                  {o}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </CollapsibleContent>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
}
