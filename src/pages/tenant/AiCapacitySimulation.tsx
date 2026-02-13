import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Brain, Loader2, ArrowRight, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "@/components/ui/sonner";

interface SimKPIs {
  utilization_pct: number;
  on_time_rate_pct: number;
  wip_count: number;
  throughput_per_day: number;
}

interface SimResult {
  baseline: SimKPIs;
  scenario: SimKPIs;
  explanation: string;
}

export default function AiCapacitySimulation() {
  const { t, locale } = useLanguage();
  const { tenantId } = useTenant();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimResult | null>(null);
  const [shifts, setShifts] = useState(1);
  const [priorityBoost, setPriorityBoost] = useState("");
  const [delayDays, setDelayDays] = useState(0);

  const simulate = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("production-ai-planning", {
        body: {
          action: "simulate-scenario",
          tenant_id: tenantId,
          language: locale,
          scenario_params: {
            shift_multiplier: shifts,
            priority_boost_order: priorityBoost || undefined,
            delay_all_days: delayDays,
          },
        },
      });
      if (error) throw error;
      setResult(data as SimResult);
      toast.success(locale === "sr" ? "Simulacija završena" : "Simulation complete");
    } catch {
      toast.error(locale === "sr" ? "Greška" : "Simulation error");
    } finally {
      setLoading(false);
    }
  };

  const kpiLabel = (key: keyof SimKPIs) => {
    switch (key) {
      case "utilization_pct": return t("capacityUtilization");
      case "on_time_rate_pct": return t("scheduleAdherence");
      case "wip_count": return "WIP";
      case "throughput_per_day": return locale === "sr" ? "Propusnost/dan" : "Throughput/day";
    }
  };

  const formatVal = (key: keyof SimKPIs, val: number) =>
    key.endsWith("_pct") ? `${val}%` : val.toString();

  return (
    <div className="space-y-6">
      <PageHeader title={t("capacitySimulation")} />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{t("simulateScenario")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">{t("addShift")} / {t("removeShift")}</Label>
              <Input type="number" min={1} max={3} value={shifts} onChange={e => setShifts(Number(e.target.value))} />
              <p className="text-[10px] text-muted-foreground">{locale === "sr" ? "Množilac smena (1=bez promene)" : "Shift multiplier (1=no change)"}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{locale === "sr" ? "Prioritet naloga" : "Priority boost order"}</Label>
              <Input placeholder={locale === "sr" ? "Broj naloga" : "Order number"} value={priorityBoost} onChange={e => setPriorityBoost(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{locale === "sr" ? "Odloži sve (dana)" : "Delay all orders (days)"}</Label>
              <Input type="number" min={0} value={delayDays} onChange={e => setDelayDays(Number(e.target.value))} />
            </div>
          </div>

          <Button onClick={simulate} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            <Brain className="h-4 w-4" />
            {t("simulateScenario")}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {(Object.keys(result.baseline) as (keyof SimKPIs)[]).map(key => {
              const base = result.baseline[key];
              const scen = result.scenario[key];
              const diff = scen - base;
              const improved = key === "wip_count" ? diff < 0 : diff > 0;
              return (
                <Card key={key}>
                  <CardContent className="p-4 space-y-2">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{kpiLabel(key)}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-muted-foreground">{formatVal(key, base)}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <span className="text-lg font-bold">{formatVal(key, scen)}</span>
                    </div>
                    {diff !== 0 && (
                      <span className={`text-xs flex items-center gap-1 ${improved ? "text-primary" : "text-destructive"}`}>
                        {improved ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {diff > 0 ? "+" : ""}{key.endsWith("_pct") ? `${diff.toFixed(1)}%` : diff}
                      </span>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t("aiExplanation")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{result.explanation}</p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
