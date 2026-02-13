import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Brain, Loader2, ArrowRight, TrendingUp, TrendingDown, Trash2, Sparkles } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

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

interface SavedScenario {
  name: string;
  timestamp: Date;
  params: { shifts: number; priorityBoost: string; delayDays: number; overtimeHours: number; outsourcePct: number; maintenanceDays: number; demandChangePct: number };
  result: SimResult;
}

export default function AiCapacitySimulation() {
  const { t, locale } = useLanguage();
  const { tenantId } = useTenant();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimResult | null>(null);
  const [shifts, setShifts] = useState(1);
  const [priorityBoost, setPriorityBoost] = useState("");
  const [delayDays, setDelayDays] = useState(0);
  const [overtimeHours, setOvertimeHours] = useState(0);
  const [outsourcePct, setOutsourcePct] = useState(0);
  const [maintenanceDays, setMaintenanceDays] = useState(0);
  const [demandChangePct, setDemandChangePct] = useState(0);
  const [scenarioName, setScenarioName] = useState("");
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>([]);

  const simulate = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("production-ai-planning", {
        body: {
          action: "simulate-scenario", tenant_id: tenantId, language: locale,
          scenario_params: {
            shift_multiplier: shifts, priority_boost_order: priorityBoost || undefined,
            delay_all_days: delayDays, overtime_hours: overtimeHours,
            outsource_pct: outsourcePct, maintenance_days: maintenanceDays,
            demand_change_pct: demandChangePct,
          },
        },
      });
      if (error) throw error;
      setResult(data as SimResult);
      toast.success(locale === "sr" ? "Simulacija završena" : "Simulation complete");
    } catch {
      toast.error(locale === "sr" ? "Greška" : "Simulation error");
    } finally { setLoading(false); }
  };

  const saveScenario = () => {
    if (!result || !scenarioName.trim()) return;
    setSavedScenarios(prev => [...prev, {
      name: scenarioName.trim(), timestamp: new Date(),
      params: { shifts, priorityBoost, delayDays, overtimeHours, outsourcePct, maintenanceDays, demandChangePct },
      result,
    }]);
    setScenarioName("");
    toast.success(locale === "sr" ? "Scenario sačuvan" : "Scenario saved");
  };

  const clearAll = () => { setResult(null); setShifts(1); setPriorityBoost(""); setDelayDays(0); setOvertimeHours(0); setOutsourcePct(0); setMaintenanceDays(0); setDemandChangePct(0); };

  const kpiLabel = (key: keyof SimKPIs) => {
    switch (key) {
      case "utilization_pct": return t("capacityUtilization");
      case "on_time_rate_pct": return t("scheduleAdherence");
      case "wip_count": return "WIP";
      case "throughput_per_day": return locale === "sr" ? "Propusnost/dan" : "Throughput/day";
    }
  };

  const formatVal = (key: keyof SimKPIs, val: number) => key.endsWith("_pct") ? `${val}%` : val.toString();

  // Chart data for comparison
  const chartData = result ? (Object.keys(result.baseline) as (keyof SimKPIs)[]).map(key => ({
    name: kpiLabel(key),
    [locale === "sr" ? "Osnova" : "Baseline"]: result.baseline[key],
    [locale === "sr" ? "Scenario" : "Scenario"]: result.scenario[key],
  })) : [];

  return (
    <div className="space-y-6">
      <PageHeader title={t("capacitySimulation")} />

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">{t("simulateScenario")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{t("addShift")} / {t("removeShift")}</Label>
              <Input type="number" min={1} max={3} value={shifts} onChange={e => setShifts(Number(e.target.value))} />
              <p className="text-[10px] text-muted-foreground">{locale === "sr" ? "Množilac (1=bez promene)" : "Multiplier (1=no change)"}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{locale === "sr" ? "Prioritet naloga" : "Priority boost order"}</Label>
              <Input placeholder={locale === "sr" ? "Broj naloga" : "Order number"} value={priorityBoost} onChange={e => setPriorityBoost(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{locale === "sr" ? "Odloži sve (dana)" : "Delay all (days)"}</Label>
              <Input type="number" min={0} value={delayDays} onChange={e => setDelayDays(Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("overtimeHours")}</Label>
              <Input type="number" min={0} max={8} value={overtimeHours} onChange={e => setOvertimeHours(Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("outsourcePercent")}</Label>
              <Input type="number" min={0} max={100} value={outsourcePct} onChange={e => setOutsourcePct(Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("maintenanceDays")}</Label>
              <Input type="number" min={0} value={maintenanceDays} onChange={e => setMaintenanceDays(Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("demandChange")}</Label>
              <Input type="number" min={-100} max={200} value={demandChangePct} onChange={e => setDemandChangePct(Number(e.target.value))} />
              <p className="text-[10px] text-muted-foreground">%</p>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button onClick={simulate} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              <Brain className="h-4 w-4" /> {t("simulateScenario")}
            </Button>
            <Button variant="outline" onClick={clearAll}>{locale === "sr" ? "Resetuj" : "Reset"}</Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <>
          {/* KPI Cards */}
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

          {/* Comparison Chart */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">{locale === "sr" ? "Vizuelno poredjenje" : "Visual Comparison"}</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey={locale === "sr" ? "Osnova" : "Baseline"} fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey={locale === "sr" ? "Scenario" : "Scenario"} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Save Scenario */}
          <Card>
            <CardContent className="p-4 flex gap-2 items-end">
              <div className="flex-1"><Label className="text-xs">{t("scenarioName")}</Label>
                <Input value={scenarioName} onChange={e => setScenarioName(e.target.value)} placeholder={locale === "sr" ? "Naziv scenarija..." : "Scenario name..."} />
              </div>
              <Button onClick={saveScenario} disabled={!scenarioName.trim()}>{t("save")}</Button>
            </CardContent>
          </Card>

          {/* AI Explanation */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />{t("aiExplanation")}</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-muted-foreground">{result.explanation}</p></CardContent>
          </Card>
        </>
      )}

      {/* Saved Scenarios */}
      {savedScenarios.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{t("scenarioHistory")}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {savedScenarios.map((s, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 bg-muted/50 rounded text-sm">
                <div>
                  <span className="font-medium">{s.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">{s.timestamp.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span>{t("capacityUtilization")}: {s.result.scenario.utilization_pct}%</span>
                  <span>{t("scheduleAdherence")}: {s.result.scenario.on_time_rate_pct}%</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSavedScenarios(prev => prev.filter((_, j) => j !== i))}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
