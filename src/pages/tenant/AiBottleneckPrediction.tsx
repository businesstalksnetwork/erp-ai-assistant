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
import { Brain, Loader2, AlertCircle, AlertTriangle, Info, Package, CalendarDays, Clock, TrendingUp, TrendingDown, ChevronDown, CheckCircle, Eye, Zap } from "lucide-react";
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
  _source?: "local" | "ai";
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

  // Local material pre-check data
  const { data: localShortages = [] } = useQuery({
    queryKey: ["local-material-shortages", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      // Fetch active orders with BOMs
      const { data: orders } = await supabase.from("production_orders")
        .select("id, order_number, quantity, bom_template_id")
        .eq("tenant_id", tenantId).in("status", ["draft", "in_progress", "planned"]);
      if (!orders?.length) return [];

      const shortages: Bottleneck[] = [];
      const bomIds = [...new Set(orders.filter(o => o.bom_template_id).map(o => o.bom_template_id!))];
      if (!bomIds.length) return [];

      // Fetch all BOM lines at once
      const { data: allBomLines } = await supabase.from("bom_lines")
        .select("bom_template_id, material_product_id, quantity, products(name)")
        .in("bom_template_id", bomIds);
      if (!allBomLines?.length) return [];

      // Aggregate material needs across all orders
      const materialNeeds: Record<string, { name: string; required: number; orders: string[] }> = {};
      for (const order of orders) {
        if (!order.bom_template_id) continue;
        const lines = allBomLines.filter(l => l.bom_template_id === order.bom_template_id);
        for (const line of lines) {
          const key = line.material_product_id;
          if (!materialNeeds[key]) materialNeeds[key] = { name: (line as any).products?.name || key, required: 0, orders: [] };
          materialNeeds[key].required += line.quantity * (order.quantity || 1);
          materialNeeds[key].orders.push(order.order_number || order.id.substring(0, 8));
        }
      }

      // Check stock for each material
      const productIds = Object.keys(materialNeeds);
      if (!productIds.length) return [];
      const { data: stockData } = await supabase.from("inventory_stock")
        .select("product_id, quantity_on_hand")
        .eq("tenant_id", tenantId).in("product_id", productIds);

      const stockMap: Record<string, number> = {};
      for (const s of (stockData || [])) {
        stockMap[s.product_id] = (stockMap[s.product_id] || 0) + (s.quantity_on_hand || 0);
      }

      for (const [pid, need] of Object.entries(materialNeeds)) {
        const available = stockMap[pid] || 0;
        const deficit = need.required - available;
        if (deficit > 0) {
          shortages.push({
            type: "material_shortage",
            severity: deficit > need.required * 0.5 ? "critical" : "warning",
            title: locale === "sr" ? `Nedostatak: ${need.name}` : `Shortage: ${need.name}`,
            description: locale === "sr"
              ? `Potrebno ${need.required}, dostupno ${available}, deficit ${deficit}`
              : `Required ${need.required}, available ${available}, deficit ${deficit}`,
            suggested_action: locale === "sr"
              ? `Naručite još ${deficit} jedinica ${need.name}`
              : `Order ${deficit} more units of ${need.name}`,
            affected_orders: [...new Set(need.orders)],
            material_detail: { product: need.name, required: need.required, available, deficit },
            _source: "local",
          });
        }
      }
      return shortages;
    },
    enabled: !!tenantId,
  });

  const analyze = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      if (bottlenecks) setPreviousCount(bottlenecks.length);
      const { data, error } = await supabase.functions.invoke("production-ai-planning", {
        body: { action: "predict-bottlenecks", tenant_id: tenantId, language: locale },
      });
      if (error) throw error;
      const aiBottlenecks: Bottleneck[] = ((data as any).bottlenecks || []).map((b: Bottleneck) => ({ ...b, _source: "ai" as const }));

      // Merge local + AI, deduplicate material shortages by product name
      const localProducts = new Set(localShortages.map(s => s.material_detail?.product));
      const merged = [
        ...localShortages,
        ...aiBottlenecks.filter(b => b.type !== "material_shortage" || !localProducts.has(b.material_detail?.product)),
      ];
      setBottlenecks(merged);
      toast.success(locale === "sr" ? "Analiza završena" : "Analysis complete");
    } catch {
      // On AI failure, show local shortages only
      if (localShortages.length > 0) {
        setBottlenecks(localShortages);
        toast.info(locale === "sr" ? "AI nedostupan — prikazani lokalni rezultati" : "AI unavailable — showing local results");
      } else {
        toast.error(locale === "sr" ? "Greška pri analizi" : "Error analyzing bottlenecks");
      }
    } finally { setLoading(false); }
  };

  // Auto-analyze on mount
  useEffect(() => { if (tenantId && !bottlenecks) analyze(); }, [tenantId]);

  const allBottlenecks = bottlenecks || localShortages;
  const filtered = allBottlenecks.filter(b => severityFilter === "all" || b.severity === severityFilter);
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
        {localShortages.length > 0 && !bottlenecks && (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Zap className="h-3 w-3" />
            {localShortages.length} {locale === "sr" ? "lokalni nedostaci" : "local shortages"}
          </Badge>
        )}
        {allBottlenecks.length > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            {trendDiff !== null && trendDiff !== 0 && (
              <Badge variant={trendDiff > 0 ? "destructive" : "secondary"} className="flex items-center gap-1">
                {trendDiff > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {trendDiff > 0 ? "+" : ""}{trendDiff} {locale === "sr" ? "vs prethodno" : "vs previous"}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">{allBottlenecks.length} {locale === "sr" ? "pronađeno" : "found"}</span>
          </div>
        )}
      </div>

      {allBottlenecks.length > 0 && (
        <Tabs value={severityFilter} onValueChange={setSeverityFilter}>
          <TabsList>
            <TabsTrigger value="all">{locale === "sr" ? "Sve" : "All"} ({allBottlenecks.length})</TabsTrigger>
            <TabsTrigger value="critical">Critical ({allBottlenecks.filter(b => b.severity === "critical").length})</TabsTrigger>
            <TabsTrigger value="warning">Warning ({allBottlenecks.filter(b => b.severity === "warning").length})</TabsTrigger>
            <TabsTrigger value="info">Info ({allBottlenecks.filter(b => b.severity === "info").length})</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {allBottlenecks.length > 0 && filtered.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {locale === "sr" ? "Nisu pronađena uska grla." : "No bottlenecks detected."}
          </CardContent>
        </Card>
      )}

      {filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((b, i) => {
            const globalIdx = allBottlenecks.indexOf(b);
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
                          {b._source === "local" && (
                            <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                              <Zap className="h-2 w-2 mr-0.5" />{locale === "sr" ? "Lokalno" : "Local"}
                            </Badge>
                          )}
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

      {allBottlenecks.length === 0 && !loading && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {locale === "sr" ? "Kliknite dugme za analizu uskih grla." : "Click the button to analyze bottlenecks."}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
