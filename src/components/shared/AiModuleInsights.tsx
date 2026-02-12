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
}

interface Props {
  tenantId: string;
  module?: string;
  compact?: boolean;
}

const severityConfig = {
  critical: { icon: AlertCircle, color: "text-destructive", badge: "destructive" as const },
  warning: { icon: AlertTriangle, color: "text-accent", badge: "secondary" as const },
  info: { icon: Info, color: "text-primary", badge: "outline" as const },
};

export function AiModuleInsights({ tenantId, module, compact }: Props) {
  const { t, locale } = useLanguage();

  const { data: insights, isLoading } = useQuery({
    queryKey: ["ai-insights", tenantId, module],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("ai-insights", {
        body: { tenant_id: tenantId, language: locale, module },
      });
      if (error) throw error;
      return (data?.insights || []) as Insight[];
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return compact ? (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Loader2 className="h-3 w-3 animate-spin" />
        {locale === "sr" ? "Analiziranje..." : "Analyzing..."}
      </div>
    ) : null;
  }

  if (!insights?.length) return null;

  const items = compact ? insights.slice(0, 2) : insights.slice(0, 5);

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          {t("aiInsights")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((insight, i) => {
          const config = severityConfig[insight.severity];
          const Icon = config.icon;
          return (
            <div key={i} className="flex items-start gap-2 text-xs">
              <Icon className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 ${config.color}`} />
              <div className="flex-1 min-w-0">
                <span className="font-medium">{insight.title}</span>
                {!compact && <p className="text-muted-foreground mt-0.5">{insight.description}</p>}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
