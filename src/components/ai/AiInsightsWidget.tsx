import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, AlertTriangle, AlertCircle, Info, Loader2 } from "lucide-react";

interface Insight {
  insight_type: string;
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  data: Record<string, unknown>;
}

interface AiInsightsWidgetProps {
  tenantId: string;
}

const severityConfig = {
  critical: { icon: AlertCircle, color: "text-destructive", badge: "destructive" as const },
  warning: { icon: AlertTriangle, color: "text-amber-500", badge: "secondary" as const },
  info: { icon: Info, color: "text-primary", badge: "outline" as const },
};

export function AiInsightsWidget({ tenantId }: AiInsightsWidgetProps) {
  const { t, locale } = useLanguage();

  const { data: insights, isLoading } = useQuery({
    queryKey: ["ai-insights", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("ai-insights", {
        body: { tenant_id: tenantId, language: locale },
      });
      if (error) throw error;
      return (data?.insights || []) as Insight[];
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          {t("aiInsights")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">
              {locale === "sr" ? "Analiziranje podataka..." : "Analyzing data..."}
            </span>
          </div>
        ) : !insights?.length ? (
          <p className="text-sm text-muted-foreground">
            {locale === "sr" ? "Nema dostupnih uvida." : "No insights available."}
          </p>
        ) : (
          <div className="space-y-3">
            {insights.slice(0, 5).map((insight, i) => {
              const config = severityConfig[insight.severity];
              const Icon = config.icon;
              return (
                <div key={i} className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors">
                  <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${config.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{insight.title}</span>
                      <Badge variant={config.badge} className="text-xs">
                        {insight.severity}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{insight.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
