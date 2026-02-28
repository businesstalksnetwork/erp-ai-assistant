import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Brain, Loader2, Lock, Unlock, Check, X, Sparkles, Download, Eye, Cpu, AlertTriangle } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { format, parseISO, differenceInDays, addDays, addWeeks, addMonths } from "date-fns";
import { exportToCsv, type CsvColumn } from "@/lib/exportCsv";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ScheduleSuggestion {
  order_id: string;
  order_number: string;
  suggested_start: string;
  suggested_end: string;
  priority: number;
  explanation: string;
}

interface ScheduleResult {
  suggestions: ScheduleSuggestion[];
  overall_explanation: string;
  _filtered_count?: number;
  _fallback?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted-foreground/60",
  in_progress: "bg-primary",
  completed: "bg-accent",
  cancelled: "bg-destructive/60",
  late: "bg-destructive",
};

const LEGEND_ITEMS = [
  { key: "draft", color: "bg-muted-foreground/60" },
  { key: "in_progress", color: "bg-primary" },
  { key: "completed", color: "bg-accent" },
  { key: "late", color: "bg-destructive" },
  { key: "aiSuggestion", color: "border-2 border-dashed border-primary/50 bg-primary/10" },
];

type DateRange = "1w" | "2w" | "1m" | "3m";

export default function AiPlanningSchedule() {
  const { t, locale } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScheduleResult | null>(null);
  const [locked, setLocked] = useState<Set<string>>(new Set());
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [rejected, setRejected] = useState<Set<string>>(new Set());
  const [dateRange, setDateRange] = useState<DateRange>("1m");
  const [showAiOverlay, setShowAiOverlay] = useState(false);
  const [useLocalMode, setUseLocalMode] = useState(false);

  const { data: orders = [] } = useQuery({
    queryKey: ["production-orders-schedule", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("production_orders").select("id, order_number, status, planned_start, planned_end, quantity, priority, product_id, products(name), bom_template_id, bom_templates(name)").eq("tenant_id", tenantId!).neq("status", "cancelled").order("planned_start");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const now = new Date();
  const rangeEnd = useMemo(() => {
    switch (dateRange) {
      case "1w": return addWeeks(now, 1);
      case "2w": return addWeeks(now, 2);
      case "1m": return addMonths(now, 1);
      case "3m": return addMonths(now, 3);
    }
  }, [dateRange]);

  const rangeStart = addDays(now, -3);
  const totalDays = Math.max(differenceInDays(rangeEnd, rangeStart), 1);

  const getOrderStatus = (order: any) => {
    if (order.status === "completed") return "completed";
    if (order.status === "draft") return "draft";
    if (order.planned_end && new Date(order.planned_end) < now && order.status !== "completed") return "late";
    return order.status;
  };

  const generate = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("production-ai-planning", {
        body: {
          action: useLocalMode ? "local-fallback-schedule" : "generate-schedule",
          tenant_id: tenantId,
          language: locale,
          locked_order_ids: Array.from(locked),
          excluded_order_ids: Array.from(excluded),
        },
      });
      if (error) throw error;
      const res = data as ScheduleResult;
      setResult(res);
      setAccepted(new Set()); setRejected(new Set());

      if (res._filtered_count && res._filtered_count > 0) {
        toast.warning(locale === "sr"
          ? `${res._filtered_count} nevažećih predloga uklonjeno (prošli datumi ili neispravni)`
          : `${res._filtered_count} invalid suggestions removed (past dates or invalid ranges)`);
      }
      if (res._fallback) {
        toast.info(locale === "sr" ? "AI nedostupan — korišćen lokalni raspored" : "AI unavailable — local fallback used");
      } else {
        toast.success(t("scheduleGenerated"));
      }
    } catch {
      toast.error(t("scheduleGenerationError"));
    } finally { setLoading(false); }
  };

  const applyMutation = useMutation({
    mutationFn: async () => {
      if (!result) return;
      const toApply = result.suggestions.filter(s => accepted.has(s.order_id));
      await Promise.all(toApply.map(s =>
        supabase.from("production_orders").update({ planned_start: s.suggested_start, planned_end: s.suggested_end }).eq("id", s.order_id)
      ));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["production-orders-schedule"] });
      toast.success(t("scheduleApplied"));
      setResult(null); setAccepted(new Set());
    },
  });

  const toggleLock = (id: string) => setLocked(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleExclude = (id: string) => setExcluded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const exportSchedule = () => {
    const rows = orders.map((o: any) => ({
      order_number: o.order_number, product: o.products?.name, quantity: o.quantity,
      priority: (o as any).priority || 3,
      planned_start: o.planned_start, planned_end: o.planned_end, status: o.status,
    }));
    const cols: CsvColumn<typeof rows[0]>[] = [
      { key: "order_number", label: "Order" }, { key: "product", label: "Product" },
      { key: "quantity", label: "Qty" }, { key: "priority", label: "Priority" },
      { key: "planned_start", label: "Start" }, { key: "planned_end", label: "End" }, { key: "status", label: "Status" },
    ];
    exportToCsv(rows, cols, "production-schedule");
  };

  const getBarPosition = (start: string | null, end: string | null) => {
    if (!start || !end) return { left: 0, width: 5 };
    const s = differenceInDays(parseISO(start), rangeStart);
    const dur = Math.max(differenceInDays(parseISO(end), parseISO(start)), 1);
    return { left: Math.max((s / totalDays) * 100, 0), width: Math.max((dur / totalDays) * 100, 2) };
  };

  const priorityLabel = (p: number) => {
    const labels: Record<number, string> = { 1: "🔴", 2: "🟠", 3: "🟡", 4: "🟢", 5: "⚪" };
    return labels[p] || "🟡";
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("aiSchedule")} />

      <div className="flex gap-2 flex-wrap items-center">
        <Button onClick={generate} disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {useLocalMode ? <Cpu className="h-4 w-4" /> : <Brain className="h-4 w-4" />}
          {useLocalMode ? (locale === "sr" ? "Lokalni raspored" : "Local Schedule") : t("generateAiPlan")}
        </Button>
        {accepted.size > 0 && (
          <Button variant="secondary" onClick={() => applyMutation.mutate()} disabled={applyMutation.isPending}>
            <Check className="h-4 w-4" /> {t("applyAccepted")} ({accepted.size})
          </Button>
        )}
        {result && result.suggestions.length > 0 && (
          <>
            <Button variant="outline" size="sm" onClick={() => { setAccepted(new Set(result.suggestions.map(s => s.order_id))); setRejected(new Set()); }}>
              <Check className="h-4 w-4" /> {t("acceptAll")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setRejected(new Set(result.suggestions.map(s => s.order_id))); setAccepted(new Set()); }}>
              <X className="h-4 w-4" /> {t("rejectAll")}
            </Button>
          </>
        )}
        <Button variant="outline" onClick={exportSchedule}><Download className="h-4 w-4" /> {t("exportCsv")}</Button>
        <div className="ml-auto flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch checked={useLocalMode} onCheckedChange={setUseLocalMode} />
            <Label className="text-xs">{locale === "sr" ? "Lokalni mod" : "Local mode"}</Label>
          </div>
          {result && (
            <div className="flex items-center gap-2">
              <Switch checked={showAiOverlay} onCheckedChange={setShowAiOverlay} />
              <Label className="text-xs">{t("showAiOverlay")}</Label>
            </div>
          )}
        </div>
      </div>

      {excluded.size > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <AlertTriangle className="h-3 w-3" />
          {excluded.size} {locale === "sr" ? "naloga isključeno iz analize" : "orders excluded from analysis"}
          <Button variant="ghost" size="sm" className="h-5 text-[10px]" onClick={() => setExcluded(new Set())}>
            {locale === "sr" ? "Poništi" : "Clear"}
          </Button>
        </div>
      )}

      {/* Date range tabs */}
      <Tabs value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
        <TabsList>
          <TabsTrigger value="1w">{t("oneWeek")}</TabsTrigger>
          <TabsTrigger value="2w">{t("twoWeeks")}</TabsTrigger>
          <TabsTrigger value="1m">{t("oneMonth")}</TabsTrigger>
          <TabsTrigger value="3m">{t("threeMonths")}</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Gantt chart */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">{t("aiSchedule")}</CardTitle></CardHeader>
        <CardContent className="space-y-2 overflow-x-auto">
          {orders.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{t("noResults")}</p>
          ) : orders.map((order: any) => {
            const status = getOrderStatus(order);
            const pos = getBarPosition(order.planned_start, order.planned_end);
            const suggestion = result?.suggestions.find(s => s.order_id === order.id);
            const sugPos = suggestion ? getBarPosition(suggestion.suggested_start, suggestion.suggested_end) : null;
            const isAccepted = accepted.has(order.id);
            const isRejected = rejected.has(order.id);
            const isLocked = locked.has(order.id);
            const isExcluded = excluded.has(order.id);

            return (
              <div key={order.id} className={`flex items-center gap-3 ${isExcluded ? "opacity-40" : ""}`}>
                <div className="w-44 flex-shrink-0 text-xs font-medium truncate flex items-center gap-1">
                  <Checkbox checked={!isExcluded} onCheckedChange={() => toggleExclude(order.id)} className="h-3 w-3" />
                  <button onClick={() => toggleLock(order.id)} className="p-0.5 hover:bg-muted rounded">
                    {isLocked ? <Lock className="h-3 w-3 text-destructive" /> : <Unlock className="h-3 w-3 text-muted-foreground" />}
                  </button>
                  <span className="text-[10px]">{priorityLabel((order as any).priority || 3)}</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="truncate cursor-default">{order.order_number}</span>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[220px]">
                      <p className="font-medium">{order.products?.name}</p>
                      <p className="text-xs">Qty: {order.quantity}</p>
                      <p className="text-xs">Priority: {(order as any).priority || 3}</p>
                      {order.bom_templates && <p className="text-xs">BOM: {(order as any).bom_templates?.name}</p>}
                      <p className="text-xs capitalize">Status: {status}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="flex-1 relative h-8 bg-muted rounded overflow-hidden min-w-[200px]">
                  <div className={`absolute top-1 bottom-1 rounded text-[10px] flex items-center px-2 text-primary-foreground font-medium ${STATUS_COLORS[status] || "bg-muted-foreground"}`}
                    style={{ left: `${pos.left}%`, width: `${pos.width}%` }}>
                    <span className="truncate">{order.products?.name?.substring(0, 12)}</span>
                  </div>
                  {showAiOverlay && sugPos && (
                    <div className="absolute top-1 bottom-1 rounded border-2 border-dashed border-primary/50 bg-primary/10"
                      style={{ left: `${sugPos.left}%`, width: `${sugPos.width}%` }} />
                  )}
                </div>
                {suggestion && (
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => { setAccepted(p => new Set(p).add(order.id)); setRejected(p => { const n = new Set(p); n.delete(order.id); return n; }); }}
                      className={`p-1 rounded hover:bg-muted ${isAccepted ? "text-primary" : "text-muted-foreground"}`}><Check className="h-3.5 w-3.5" /></button>
                    <button onClick={() => { setRejected(p => new Set(p).add(order.id)); setAccepted(p => { const n = new Set(p); n.delete(order.id); return n; }); }}
                      className={`p-1 rounded hover:bg-muted ${isRejected ? "text-destructive" : "text-muted-foreground"}`}><X className="h-3.5 w-3.5" /></button>
                  </div>
                )}
                <div className="w-40 text-[10px] text-muted-foreground flex-shrink-0 hidden md:block">
                  {order.planned_start && order.planned_end ? `${format(parseISO(order.planned_start), "dd MMM")} – ${format(parseISO(order.planned_end), "dd MMM")}` : "—"}
                </div>
              </div>
            );
          })}

          {/* Date axis */}
          <div className="flex items-center gap-3 mt-2">
            <div className="w-44 flex-shrink-0" />
            <div className="flex-1 flex justify-between text-[10px] text-muted-foreground min-w-[200px]">
              <span>{format(rangeStart, "dd MMM")}</span>
              <span>{format(rangeEnd, "dd MMM")}</span>
            </div>
            <div className="w-40 flex-shrink-0 hidden md:block" />
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 pt-3 border-t">
            {LEGEND_ITEMS.map(item => (
              <div key={item.key} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className={`inline-block h-3 w-6 rounded ${item.color}`} />
                {t(item.key as any)}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* AI Explanation */}
      {result && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />{t("aiExplanation")}
              {result._fallback && <Badge variant="secondary" className="text-[10px]">Fallback</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">{result.overall_explanation}</p>
            {result.suggestions.map(s => (
              <div key={s.order_id} className="text-xs flex gap-2">
                <Badge variant="outline" className="flex-shrink-0">{s.order_number}</Badge>
                <Badge variant="secondary" className="flex-shrink-0 text-[10px]">P{s.priority}</Badge>
                <span className="text-muted-foreground">{s.explanation}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
