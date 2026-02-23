import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/PageHeader";
import { DateInput } from "@/components/ui/date-input";
import {
  Brain, RefreshCw, AlertCircle, AlertTriangle, Info,
  CheckCircle2, TrendingUp, Users, Package, DollarSign,
  Lightbulb, Shield, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { format, subDays } from "date-fns";
import erpAiLogo from "@/assets/erpAI.png";

/* ── helpers ── */
const fmtDate = (d: Date) => format(d, "yyyy-MM-dd");

type Preset = "today" | "7d" | "30d" | "90d" | "custom";

const statusColors = {
  green: "text-emerald-600 bg-emerald-500/10 border-emerald-500/30",
  amber: "text-amber-600 bg-amber-500/10 border-amber-500/30",
  red: "text-destructive bg-destructive/10 border-destructive/30",
  neutral: "text-muted-foreground bg-muted border-border",
};

const statusIcons = {
  green: CheckCircle2,
  amber: AlertTriangle,
  red: AlertCircle,
  neutral: Info,
};

const categoryIcons: Record<string, typeof DollarSign> = {
  financial: DollarSign,
  operations: Package,
  people: Users,
  sales: TrendingUp,
};

const severityBadge = {
  critical: "destructive" as const,
  warning: "secondary" as const,
  info: "outline" as const,
};

/* ── Date range bar ── */
function DateRangeBar({
  preset,
  setPreset,
  dateFrom,
  dateTo,
  setDateFrom,
  setDateTo,
  sr,
}: {
  preset: Preset;
  setPreset: (p: Preset) => void;
  dateFrom: string;
  dateTo: string;
  setDateFrom: (v: string) => void;
  setDateTo: (v: string) => void;
  sr: boolean;
}) {
  const presets: { key: Preset; label: string }[] = [
    { key: "today", label: sr ? "Danas" : "Today" },
    { key: "7d", label: sr ? "7 dana" : "7 days" },
    { key: "30d", label: sr ? "30 dana" : "30 days" },
    { key: "90d", label: sr ? "90 dana" : "90 days" },
    { key: "custom", label: sr ? "Prilagodi" : "Custom" },
  ];

  return (
    <div className="flex flex-wrap items-end gap-2">
      {presets.map((p) => (
        <Button
          key={p.key}
          size="sm"
          variant={preset === p.key ? "default" : "outline"}
          onClick={() => setPreset(p.key)}
        >
          {p.label}
        </Button>
      ))}
      {preset === "custom" && (
        <div className="flex items-center gap-2">
          <DateInput value={dateFrom} onChange={(e) => setDateFrom((e.target as HTMLInputElement).value)} className="w-36" />
          <span className="text-muted-foreground text-sm">–</span>
          <DateInput value={dateTo} onChange={(e) => setDateTo((e.target as HTMLInputElement).value)} className="w-36" />
        </div>
      )}
    </div>
  );
}

/* ── Main page ── */
export default function AiBriefing() {
  const { tenantId } = useTenant();
  const { t, locale } = useLanguage();
  const sr = locale === "sr";

  const [preset, setPreset] = useState<Preset>("30d");
  const [customFrom, setCustomFrom] = useState(fmtDate(subDays(new Date(), 30)));
  const [customTo, setCustomTo] = useState(fmtDate(new Date()));

  const { dateFrom, dateTo } = useMemo(() => {
    const now = new Date();
    switch (preset) {
      case "today":
        return { dateFrom: fmtDate(now), dateTo: fmtDate(now) };
      case "7d":
        return { dateFrom: fmtDate(subDays(now, 7)), dateTo: fmtDate(now) };
      case "30d":
        return { dateFrom: fmtDate(subDays(now, 30)), dateTo: fmtDate(now) };
      case "90d":
        return { dateFrom: fmtDate(subDays(now, 90)), dateTo: fmtDate(now) };
      case "custom":
        return { dateFrom: customFrom, dateTo: customTo };
    }
  }, [preset, customFrom, customTo]);

  const { data: briefing, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["ai-executive-briefing", tenantId, dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("ai-executive-briefing", {
        body: { tenant_id: tenantId, language: locale, date_from: dateFrom, date_to: dateTo },
      });
      if (error) {
        if (error.message?.includes("429")) toast.error(sr ? "AI preopterećen. Pokušajte ponovo." : "AI rate limited. Try again later.");
        else if (error.message?.includes("402")) toast.error(sr ? "Potrebni AI krediti." : "AI credits required.");
        throw error;
      }
      return data;
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const scorecard = briefing?.scorecard || [];
  const risks = briefing?.risks || [];
  const actions = briefing?.actions || [];
  const sections = briefing?.sections || [];

  const categories = ["financial", "operations", "people", "sales"];
  const groupedScorecard = categories.map(cat => ({
    category: cat,
    items: scorecard.filter((k: any) => k.category === cat),
  })).filter(g => g.items.length > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={sr ? "Brzi AI Izveštaj" : "Quick AI Report"}
        description={sr ? "Personalizovani pregled kompanije zasnovan na vašoj ulozi" : "Role-based company intelligence dashboard"}
      />

      <div className="flex justify-center">
        <img src={erpAiLogo} alt="ERP AI" className="max-w-[200px] h-auto" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <DateRangeBar
          preset={preset}
          setPreset={setPreset}
          dateFrom={customFrom}
          dateTo={customTo}
          setDateFrom={setCustomFrom}
          setDateTo={setCustomTo}
          sr={sr}
        />
        <div className="flex items-center gap-2">
          {briefing?.role && (
            <Badge variant="outline" className="capitalize">{briefing.role}</Badge>
          )}
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            {sr ? "Osveži" : "Refresh"}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
            <CardContent className="p-6 flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">
                {sr ? "AI generiše vaš briefing..." : "AI is generating your briefing..."}
              </span>
            </CardContent>
          </Card>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i}><CardContent className="p-4"><Skeleton className="h-12 w-full" /></CardContent></Card>
            ))}
          </div>
        </div>
      ) : error ? (
        <Card className="border-destructive/30">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {sr ? "Greška pri generisanju briefinga. Pokušajte ponovo." : "Failed to generate briefing. Please try again."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Executive Summary */}
          {briefing?.summary && (
            <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <Brain className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm leading-relaxed text-foreground/90">{briefing.summary}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* KPI Scorecard */}
          {groupedScorecard.length > 0 && (
            <div className="space-y-4">
              {groupedScorecard.map(group => {
                const CatIcon = categoryIcons[group.category] || DollarSign;
                return (
                  <div key={group.category}>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <CatIcon className="h-3.5 w-3.5" />
                      {sr ? { financial: "Finansije", operations: "Operacije", people: "Ljudski resursi", sales: "Prodaja" }[group.category] : group.category}
                    </h3>
                    <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
                      {group.items.map((kpi: any, i: number) => {
                        const StatusIcon = statusIcons[kpi.status as keyof typeof statusIcons] || Info;
                        return (
                          <Card key={i} className={`border ${statusColors[kpi.status as keyof typeof statusColors] || statusColors.neutral}`}>
                            <CardContent className="p-3">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-muted-foreground truncate">{kpi.label}</span>
                                <StatusIcon className="h-3.5 w-3.5 flex-shrink-0" />
                              </div>
                              <div className="text-lg font-bold tabular-nums">{kpi.value}</div>
                              {kpi.trend && <span className="text-xs text-muted-foreground">{kpi.trend}</span>}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Risks & Actions side by side */}
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            {risks.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Shield className="h-4 w-4 text-destructive" />
                    {sr ? "Rizici" : "Risks & Alerts"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {risks.map((risk: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded-md bg-muted/30">
                      <AlertTriangle className={`h-4 w-4 mt-0.5 flex-shrink-0 ${risk.severity === "critical" ? "text-destructive" : risk.severity === "warning" ? "text-amber-500" : "text-primary"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{risk.title}</span>
                          <Badge variant={severityBadge[risk.severity as keyof typeof severityBadge] || "outline"} className="text-[10px]">
                            {risk.severity}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{risk.action}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {actions.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-primary" />
                    {sr ? "Preporučene akcije" : "Recommended Actions"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {actions.map((action: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-primary font-bold mt-0.5 flex-shrink-0">{i + 1}.</span>
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Detailed Sections */}
          {sections.length > 0 && (
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
              {sections.map((section: any, i: number) => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{section.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-foreground/80 leading-relaxed">{section.narrative}</p>
                    {section.metrics?.length > 0 && (
                      <div className="grid grid-cols-2 gap-2">
                        {section.metrics.map((m: any, j: number) => (
                          <div key={j} className="bg-muted/30 rounded p-2">
                            <span className="text-xs text-muted-foreground block">{m.label}</span>
                            <span className="text-sm font-semibold">{m.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
