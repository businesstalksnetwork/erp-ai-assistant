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
import { Brain, Loader2, Lock, Unlock, Check, X, Sparkles, Download, Eye } from "lucide-react";
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
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted-foreground/60",
  in_progress: "bg-primary",
  completed: "bg-accent",
  cancelled: "bg-destructive/60",
  late: "bg-destructive",
};

type DateRange = "1w" | "2w" | "1m" | "3m";

export default function AiPlanningSchedule() {
  const { t, locale } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScheduleResult | null>(null);
  const [locked, setLocked] = useState<Set<string>>(new Set());
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [rejected, setRejected] = useState<Set<string>>(new Set());
  const [dateRange, setDateRange] = useState<DateRange>("1m");
  const [showAiOverlay, setShowAiOverlay] = useState(false);

  // Load real production orders
  const { data: orders = [] } = useQuery({
    queryKey: ["production-orders-schedule", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("production_orders").select("id, order_number, status, planned_start, planned_end, quantity, product_id, products(name), bom_template_id, bom_templates(name)").eq("tenant_id", tenantId!).neq("status", "cancelled").order("planned_start");
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

  const rangeStart = addDays(now, -3); // show a few days back
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
        body: { action: "generate-schedule", tenant_id: tenantId, language: locale },
      });
      if (error) throw error;
      setResult(data as ScheduleResult);
      setAccepted(new Set()); setRejected(new Set());
      toast.success(t("scheduleGenerated"));
    } catch {
      toast.error(t("scheduleGenerationError"));
    } finally { setLoading(false); }
  };

  const applyMutation = useMutation({
    mutationFn: async () => {
      if (!result) return;
      const toApply = result.suggestions.filter(s => accepted.has(s.order_id));
      for (const s of toApply) {
        await supabase.from("production_orders").update({ planned_start: s.suggested_start, planned_end: s.suggested_end }).eq("id", s.order_id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["production-orders-schedule"] });
      toast.success(t("scheduleApplied"));
      setResult(null); setAccepted(new Set());
    },
  });

  const toggleLock = (id: string) => setLocked(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const exportSchedule = () => {
    const rows = orders.map((o: any) => ({
      order_number: o.order_number, product: o.products?.name, quantity: o.quantity,
      planned_start: o.planned_start, planned_end: o.planned_end, status: o.status,
    }));
    const cols: CsvColumn<typeof rows[0]>[] = [
      { key: "order_number", label: "Order" }, { key: "product", label: "Product" },
      { key: "quantity", label: "Qty" }, { key: "planned_start", label: "Start" },
      { key: "planned_end", label: "End" }, { key: "status", label: "Status" },
    ];
    exportToCsv(rows, cols, "production-schedule");
  };

  const getBarPosition = (start: string | null, end: string | null) => {
    if (!start || !end) return { left: 0, width: 5 };
    const s = differenceInDays(parseISO(start), rangeStart);
    const dur = Math.max(differenceInDays(parseISO(end), parseISO(start)), 1);
    return { left: Math.max((s / totalDays) * 100, 0), width: Math.max((dur / totalDays) * 100, 2) };
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("aiSchedule")} />

      <div className="flex gap-2 flex-wrap items-center">
        <Button onClick={generate} disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          <Brain className="h-4 w-4" /> {t("generateAiPlan")}
        </Button>
        {accepted.size > 0 && (
          <Button variant="secondary" onClick={() => applyMutation.mutate()} disabled={applyMutation.isPending}>
            <Check className="h-4 w-4" /> {t("applyAccepted")} ({accepted.size})
          </Button>
        )}
        <Button variant="outline" onClick={exportSchedule}><Download className="h-4 w-4" /> {t("exportCsv")}</Button>
        <div className="ml-auto flex items-center gap-2">
          {result && (
            <>
              <Switch checked={showAiOverlay} onCheckedChange={setShowAiOverlay} />
              <Label className="text-xs">{t("showAiOverlay")}</Label>
            </>
          )}
        </div>
      </div>

      {/* Date range tabs */}
      <Tabs value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
        <TabsList>
          <TabsTrigger value="1w">{t("oneWeek")}</TabsTrigger>
          <TabsTrigger value="2w">{t("twoWeeks")}</TabsTrigger>
          <TabsTrigger value="1m">{t("oneMonth")}</TabsTrigger>
          <TabsTrigger value="3m">{t("threeMonths")}</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Gantt chart with real orders */}
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

            return (
              <div key={order.id} className="flex items-center gap-3">
                <div className="w-36 flex-shrink-0 text-xs font-medium truncate flex items-center gap-1">
                  <button onClick={() => toggleLock(order.id)} className="p-0.5 hover:bg-muted rounded">
                    {isLocked ? <Lock className="h-3 w-3 text-destructive" /> : <Unlock className="h-3 w-3 text-muted-foreground" />}
                  </button>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="truncate cursor-default">{order.order_number}</span>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[200px]">
                      <p className="font-medium">{order.products?.name}</p>
                      <p className="text-xs">Qty: {order.quantity}</p>
                      {order.bom_templates && <p className="text-xs">BOM: {(order as any).bom_templates?.name}</p>}
                      <p className="text-xs capitalize">Status: {status}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="flex-1 relative h-8 bg-muted rounded overflow-hidden min-w-[200px]">
                  {/* Real order bar */}
                  <div className={`absolute top-1 bottom-1 rounded text-[10px] flex items-center px-2 text-primary-foreground font-medium ${STATUS_COLORS[status] || "bg-muted-foreground"}`}
                    style={{ left: `${pos.left}%`, width: `${pos.width}%` }}>
                    <span className="truncate">{order.products?.name?.substring(0, 12)}</span>
                  </div>
                  {/* AI overlay */}
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
            <div className="w-36 flex-shrink-0" />
            <div className="flex-1 flex justify-between text-[10px] text-muted-foreground min-w-[200px]">
              <span>{format(rangeStart, "dd MMM")}</span>
              <span>{format(rangeEnd, "dd MMM")}</span>
            </div>
            <div className="w-40 flex-shrink-0 hidden md:block" />
          </div>
        </CardContent>
      </Card>

      {/* AI Explanation */}
      {result && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />{t("aiExplanation")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">{result.overall_explanation}</p>
            {result.suggestions.map(s => (
              <div key={s.order_id} className="text-xs flex gap-2">
                <Badge variant="outline" className="flex-shrink-0">{s.order_number}</Badge>
                <span className="text-muted-foreground">{s.explanation}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
