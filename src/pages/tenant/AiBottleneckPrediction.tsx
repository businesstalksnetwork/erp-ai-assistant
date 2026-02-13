import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, Loader2, AlertCircle, AlertTriangle, Info, Package, CalendarDays, Clock } from "lucide-react";
import { toast } from "@/components/ui/sonner";

interface Bottleneck {
  type: "material_shortage" | "overloaded_period" | "late_order_risk";
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  suggested_action: string;
  affected_orders?: string[];
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
  const [loading, setLoading] = useState(false);
  const [bottlenecks, setBottlenecks] = useState<Bottleneck[] | null>(null);

  const analyze = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("production-ai-planning", {
        body: { action: "predict-bottlenecks", tenant_id: tenantId, language: locale },
      });
      if (error) throw error;
      setBottlenecks((data as any).bottlenecks || []);
      toast.success(locale === "sr" ? "Analiza završena" : "Analysis complete");
    } catch {
      toast.error(locale === "sr" ? "Greška pri analizi" : "Error analyzing bottlenecks");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("bottleneckPrediction")} />

      <Button onClick={analyze} disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        <Brain className="h-4 w-4" />
        {t("generateAiPlan")}
      </Button>

      {bottlenecks && bottlenecks.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {locale === "sr" ? "Nisu pronađena uska grla." : "No bottlenecks detected."}
          </CardContent>
        </Card>
      )}

      {bottlenecks && bottlenecks.length > 0 && (
        <div className="space-y-3">
          {bottlenecks.map((b, i) => {
            const sev = severityConfig[b.severity];
            const SevIcon = sev.icon;
            const TypeIcon = typeIcons[b.type];
            return (
              <Card key={i}>
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
                      </div>
                      <p className="text-xs text-muted-foreground">{b.description}</p>
                      <div className="bg-muted/50 rounded p-2">
                        <p className="text-xs"><span className="font-medium">{t("suggestedAction")}:</span> {b.suggested_action}</p>
                      </div>
                      {b.affected_orders && b.affected_orders.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {b.affected_orders.map(o => <Badge key={o} variant="outline" className="text-[10px]">{o}</Badge>)}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
