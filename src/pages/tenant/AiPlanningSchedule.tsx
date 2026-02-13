import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, Loader2, Lock, Unlock, Check, X, Sparkles } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { format, parseISO, differenceInDays } from "date-fns";

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

export default function AiPlanningSchedule() {
  const { t, locale } = useLanguage();
  const { tenantId } = useTenant();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScheduleResult | null>(null);
  const [locked, setLocked] = useState<Set<string>>(new Set());
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [rejected, setRejected] = useState<Set<string>>(new Set());

  const generate = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("production-ai-planning", {
        body: { action: "generate-schedule", tenant_id: tenantId, language: locale },
      });
      if (error) throw error;
      setResult(data as ScheduleResult);
      setAccepted(new Set());
      setRejected(new Set());
      toast.success(locale === "sr" ? "Raspored generisan" : "Schedule generated");
    } catch {
      toast.error(locale === "sr" ? "Greška" : "Error generating schedule");
    } finally {
      setLoading(false);
    }
  };

  const toggleLock = (id: string) => {
    setLocked(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Find date range for Gantt
  const allDates = result?.suggestions.flatMap(s => [s.suggested_start, s.suggested_end]) || [];
  const minDate = allDates.length ? allDates.reduce((a, b) => a < b ? a : b) : "";
  const maxDate = allDates.length ? allDates.reduce((a, b) => a > b ? a : b) : "";
  const totalDays = minDate && maxDate ? Math.max(differenceInDays(parseISO(maxDate), parseISO(minDate)), 1) : 1;

  return (
    <div className="space-y-6">
      <PageHeader title={t("aiSchedule")} />

      <Button onClick={generate} disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        <Brain className="h-4 w-4" />
        {t("generateAiPlan")}
      </Button>

      {result && (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> {t("aiExplanation")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{result.overall_explanation}</p>
            </CardContent>
          </Card>

          {/* Gantt-style timeline */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t("aiSchedule")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 overflow-x-auto">
              {result.suggestions
                .sort((a, b) => a.priority - b.priority)
                .map((s) => {
                  const startOffset = minDate ? differenceInDays(parseISO(s.suggested_start), parseISO(minDate)) : 0;
                  const duration = Math.max(differenceInDays(parseISO(s.suggested_end), parseISO(s.suggested_start)), 1);
                  const leftPct = (startOffset / totalDays) * 100;
                  const widthPct = Math.max((duration / totalDays) * 100, 3);
                  const isAccepted = accepted.has(s.order_id);
                  const isRejected = rejected.has(s.order_id);
                  const isLocked = locked.has(s.order_id);

                  return (
                    <div key={s.order_id} className="flex items-center gap-3">
                      <div className="w-32 flex-shrink-0 text-xs font-medium truncate flex items-center gap-1">
                        <button onClick={() => toggleLock(s.order_id)} className="p-0.5 hover:bg-muted rounded">
                          {isLocked ? <Lock className="h-3 w-3 text-destructive" /> : <Unlock className="h-3 w-3 text-muted-foreground" />}
                        </button>
                        {s.order_number}
                      </div>
                      <div className="flex-1 relative h-8 bg-muted rounded overflow-hidden min-w-[200px]">
                        <div
                          className={`absolute top-1 bottom-1 rounded text-[10px] flex items-center px-2 text-primary-foreground font-medium ${
                            isRejected ? "bg-destructive/60" : isAccepted ? "bg-primary" : "bg-primary/70"
                          }`}
                          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                          title={s.explanation}
                        >
                          <span className="truncate">P{s.priority}</span>
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          onClick={() => { setAccepted(p => new Set(p).add(s.order_id)); setRejected(p => { const n = new Set(p); n.delete(s.order_id); return n; }); }}
                          className={`p-1 rounded hover:bg-muted ${isAccepted ? "text-primary" : "text-muted-foreground"}`}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => { setRejected(p => new Set(p).add(s.order_id)); setAccepted(p => { const n = new Set(p); n.delete(s.order_id); return n; }); }}
                          className={`p-1 rounded hover:bg-muted ${isRejected ? "text-destructive" : "text-muted-foreground"}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="w-48 text-[10px] text-muted-foreground flex-shrink-0 hidden md:block">
                        {format(parseISO(s.suggested_start), "dd MMM")} – {format(parseISO(s.suggested_end), "dd MMM")}
                      </div>
                    </div>
                  );
                })}

              {/* Date axis */}
              {minDate && maxDate && (
                <div className="flex items-center gap-3 mt-2">
                  <div className="w-32 flex-shrink-0" />
                  <div className="flex-1 flex justify-between text-[10px] text-muted-foreground min-w-[200px]">
                    <span>{format(parseISO(minDate), "dd MMM")}</span>
                    <span>{format(parseISO(maxDate), "dd MMM")}</span>
                  </div>
                  <div className="w-[68px] flex-shrink-0" />
                  <div className="w-48 flex-shrink-0 hidden md:block" />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Explanations */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t("aiExplanation")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {result.suggestions.map(s => (
                <div key={s.order_id} className="text-xs flex gap-2">
                  <Badge variant="outline" className="flex-shrink-0">{s.order_number}</Badge>
                  <span className="text-muted-foreground">{s.explanation}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
