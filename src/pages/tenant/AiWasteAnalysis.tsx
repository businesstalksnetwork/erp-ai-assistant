import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, Loader2, AlertCircle, AlertTriangle, Info, Trash2, BarChart3, Sparkles } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";

interface WasteAnalysis {
  waste_rate_pct: number;
  total_waste_qty: number;
  top_reasons: { reason: string; count: number; total_qty: number }[];
  waste_by_product: { product: string; waste_qty: number; waste_pct: number }[];
  recommendations: { severity: "critical" | "warning" | "info"; title: string; description: string }[];
}

const severityConfig = {
  critical: { icon: AlertCircle, color: "text-destructive", badge: "destructive" as const },
  warning: { icon: AlertTriangle, color: "text-accent", badge: "secondary" as const },
  info: { icon: Info, color: "text-primary", badge: "outline" as const },
};

const CHART_COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--destructive))", "hsl(var(--muted-foreground))", "hsl(var(--secondary))"];

export default function AiWasteAnalysis() {
  const { t, locale } = useLanguage();
  const { tenantId } = useTenant();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<WasteAnalysis | null>(null);

  const analyze = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("production-ai-planning", {
        body: { action: "analyze-waste", tenant_id: tenantId, language: locale },
      });
      if (error) throw error;
      setData(result as WasteAnalysis);
      toast.success(t("analysisComplete"));
    } catch {
      toast.error(t("errorAnalyzing"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 mt-4">
      <div className="flex gap-2 items-center">
        <Button onClick={analyze} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
          <Trash2 className="h-4 w-4" /> {t("analyzeWaste")}
        </Button>
      </div>

      {loading && !data && (
        <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" />
          {locale === "sr" ? "AI analizira podatke o otpadu..." : "AI analyzing waste data..."}
        </div>
      )}

      {data && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-xs text-muted-foreground">{t("wasteRate")}</p>
                <p className={`text-3xl font-bold ${data.waste_rate_pct > 5 ? "text-destructive" : "text-primary"}`}>
                  {data.waste_rate_pct.toFixed(1)}%
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-xs text-muted-foreground">{t("totalWaste")}</p>
                <p className="text-3xl font-bold">{data.total_waste_qty.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-xs text-muted-foreground">{t("topWasteReasons")}</p>
                <p className="text-3xl font-bold">{data.top_reasons.length}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top reasons */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t("topWasteReasons")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.top_reasons.map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-sm px-2 py-1.5 rounded hover:bg-muted">
                    <span>{r.reason || (locale === "sr" ? "Nepoznato" : "Unknown")}</span>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{r.count}x</span>
                      <span className="font-medium text-foreground">{r.total_qty}</span>
                    </div>
                  </div>
                ))}
                {data.top_reasons.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">{t("noResults")}</p>
                )}
              </CardContent>
            </Card>

            {/* Waste by product chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" /> {t("wasteByProduct")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.waste_by_product.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">{t("noResults")}</p>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data.waste_by_product.slice(0, 8)} layout="vertical" margin={{ left: 80 }}>
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="product" width={75} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: number) => [v, t("totalWaste")]} />
                      <Bar dataKey="waste_qty" radius={[0, 4, 4, 0]}>
                        {data.waste_by_product.slice(0, 8).map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recommendations */}
          <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> {t("wasteRecommendations")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.recommendations.map((rec, i) => {
                const config = severityConfig[rec.severity];
                const Icon = config.icon;
                return (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-background/60">
                    <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${config.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{rec.title}</span>
                        <Badge variant={config.badge} className="text-[10px]">{rec.severity}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{rec.description}</p>
                    </div>
                  </div>
                );
              })}
              {data.recommendations.length === 0 && (
                <p className="text-sm text-muted-foreground">{t("noInsightsToDisplay")}</p>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!data && !loading && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {locale === "sr"
              ? "Kliknite \"Analiziraj otpad\" za AI analizu proizvodnog otpada."
              : "Click \"Analyze Waste\" to run AI analysis on production waste data."}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
