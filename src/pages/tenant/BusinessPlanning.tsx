import { useState, useMemo } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
// @ts-ignore deep instantiation
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { Target, TrendingUp, DollarSign, Percent, Lightbulb } from "lucide-react";

export default function BusinessPlanning() {
  const { locale } = useLanguage();
  const { tenantId } = useTenant();
  const sr = locale === "sr";

  const [revenueTarget, setRevenueTarget] = useState(1000000);
  const [profitTarget, setProfitTarget] = useState(200000);
  const [growthScenario, setGrowthScenario] = useState([10]);

  const { data: actuals, isLoading } = useQuery({
    queryKey: ["business-planning", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data: lines } = await (supabase
        .from("journal_lines")
        .select("amount, side, accounts:account_id(account_type), journal:journal_entry_id(status, entry_date)") as any)
        .eq("tenant_id", tenantId!);

      const year = new Date().getFullYear();
      let revenue = 0, expenses = 0, prevRevenue = 0, prevExpenses = 0;

      for (const line of (lines as any[]) || []) {
        if (line.journal?.status !== "posted") continue;
        const d = line.journal.entry_date || "";
        const lineYear = parseInt(d.substring(0, 4));
        const amt = Number(line.amount) || 0;

        if (line.accounts?.account_type === "revenue") {
          const val = line.side === "credit" ? amt : -amt;
          if (lineYear === year) revenue += val;
          else if (lineYear === year - 1) prevRevenue += val;
        } else if (line.accounts?.account_type === "expense") {
          const val = line.side === "debit" ? amt : -amt;
          if (lineYear === year) expenses += val;
          else if (lineYear === year - 1) prevExpenses += val;
        }
      }

      return { revenue, expenses, profit: revenue - expenses, prevRevenue, prevExpenses, prevProfit: prevRevenue - prevExpenses };
    },
  });

  const revProgress = revenueTarget > 0 ? Math.min(((actuals?.revenue || 0) / revenueTarget) * 100, 100) : 0;
  const profitProgress = profitTarget > 0 ? Math.min(((actuals?.profit || 0) / profitTarget) * 100, 100) : 0;
  const yoyGrowth = actuals?.prevRevenue && actuals.prevRevenue > 0
    ? ((actuals.revenue - actuals.prevRevenue) / actuals.prevRevenue * 100)
    : 0;

  // Scenario modeling
  const scenarioRevenue = (actuals?.revenue || 0) * (1 + growthScenario[0] / 100);
  const expenseRatio = actuals?.revenue && actuals.revenue > 0 ? actuals.expenses / actuals.revenue : 0.7;
  const scenarioProfit = scenarioRevenue - scenarioRevenue * expenseRatio;

  // AI-style recommendations
  const recommendations = useMemo(() => {
    const recs: string[] = [];
    if (sr) {
      if (revProgress < 50) recs.push("Prihodi su ispod 50% cilja. Razmotrite pojačanje prodajnih aktivnosti.");
      if (yoyGrowth < 0) recs.push("Prihodi su u padu u odnosu na prethodnu godinu. Analizirajte uzroke.");
      if (expenseRatio > 0.8) recs.push("Rashodi čine više od 80% prihoda. Potrebna je optimizacija troškova.");
      if (recs.length === 0) recs.push("Poslovanje je na dobrom putu ka ispunjenju ciljeva.");
    } else {
      if (revProgress < 50) recs.push("Revenue is below 50% of target. Consider ramping up sales activities.");
      if (yoyGrowth < 0) recs.push("Revenue is declining year-over-year. Investigate root causes.");
      if (expenseRatio > 0.8) recs.push("Expenses exceed 80% of revenue. Cost optimization is needed.");
      if (recs.length === 0) recs.push("Business is on track to meet its targets.");
    }
    return recs;
  }, [revProgress, yoyGrowth, expenseRatio, sr]);

  return (
    <div className="space-y-6">
      <PageHeader title={sr ? "Poslovno planiranje" : "Business Planning"} />

      {/* Targets */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase text-muted-foreground">{sr ? "Cilj prihoda" : "Revenue Target"}</Label>
              <Input type="number" className="w-36 h-8 text-right" value={revenueTarget} onChange={e => setRevenueTarget(Number(e.target.value))} />
            </div>
            <Progress value={revProgress} className="h-3" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{sr ? "Ostvareno" : "Actual"}: {Math.round(actuals?.revenue || 0).toLocaleString()} RSD</span>
              <span>{revProgress.toFixed(0)}%</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase text-muted-foreground">{sr ? "Cilj profita" : "Profit Target"}</Label>
              <Input type="number" className="w-36 h-8 text-right" value={profitTarget} onChange={e => setProfitTarget(Number(e.target.value))} />
            </div>
            <Progress value={profitProgress} className="h-3" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{sr ? "Ostvareno" : "Actual"}: {Math.round(actuals?.profit || 0).toLocaleString()} RSD</span>
              <span>{profitProgress.toFixed(0)}%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* YoY stats */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">{sr ? "Prihod YTD" : "Revenue YTD"}</p>
            <p className="text-2xl font-bold mt-1">{Math.round(actuals?.revenue || 0).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">{sr ? "Profit YTD" : "Profit YTD"}</p>
            <p className={`text-2xl font-bold mt-1 ${(actuals?.profit || 0) >= 0 ? "text-accent" : "text-destructive"}`}>
              {Math.round(actuals?.profit || 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">{sr ? "YoY rast" : "YoY Growth"}</p>
            <p className={`text-2xl font-bold mt-1 ${yoyGrowth >= 0 ? "text-accent" : "text-destructive"}`}>
              {yoyGrowth.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">{sr ? "Rashodi/Prihodi" : "Expense Ratio"}</p>
            <p className="text-2xl font-bold mt-1">{(expenseRatio * 100).toFixed(0)}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Scenario modeling */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            {sr ? "Modeliranje scenarija" : "Scenario Modeling"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Label className="text-sm whitespace-nowrap">{sr ? "Rast prihoda:" : "Revenue growth:"} {growthScenario[0]}%</Label>
            <Slider value={growthScenario} onValueChange={setGrowthScenario} min={-30} max={50} step={5} className="flex-1" />
          </div>
          <div className="grid gap-3 grid-cols-2">
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{sr ? "Projekcija prihoda" : "Projected Revenue"}</p>
                <p className="text-xl font-bold mt-1">{Math.round(scenarioRevenue).toLocaleString()} RSD</p>
              </CardContent>
            </Card>
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{sr ? "Projekcija profita" : "Projected Profit"}</p>
                <p className={`text-xl font-bold mt-1 ${scenarioProfit >= 0 ? "text-accent" : "text-destructive"}`}>
                  {Math.round(scenarioProfit).toLocaleString()} RSD
                </p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* AI Recommendations */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-warning" />
            {sr ? "AI preporuke" : "AI Recommendations"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="text-warning mt-0.5">●</span>
                {rec}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
