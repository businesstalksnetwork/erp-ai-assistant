import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, AlertTriangle, AlertCircle, Info, Loader2, ChevronRight } from "lucide-react";
import { insightRouteMap } from "@/lib/insightRouteMap";

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
  critical: { icon: AlertCircle, color: "text-destructive", bg: "bg-destructive/5" },
  warning: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-warning/5" },
  info: { icon: Info, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/20" },
};

export function AiModuleInsights({ tenantId, module, compact }: Props) {
  const { t, locale } = useLanguage();
  const navigate = useNavigate();

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
        {t("analyzingData")}
      </div>
    ) : null;
  }

  if (!insights?.length) return null;

  // Show all insights, no slicing
  const content = (
    <div className="space-y-1.5">
      {insights.map((insight, i) => {
        const config = severityConfig[insight.severity];
        const Icon = config.icon;
        const route = insightRouteMap[insight.insight_type];
        const isClickable = !!route;

        return (
          <button
            key={i}
            onClick={() => route && navigate(route)}
            disabled={!isClickable}
            className={`flex items-start gap-2 text-xs w-full text-left rounded-md px-1.5 py-1 transition-colors ${config.bg} ${
              isClickable ? "hover:bg-muted/60 cursor-pointer" : "cursor-default"
            }`}
          >
            <Icon className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 ${config.color}`} />
            <div className="flex-1 min-w-0">
              <span className="font-medium">{insight.title}</span>
              {!compact && <p className="text-muted-foreground mt-0.5">{insight.description}</p>}
            </div>
            {isClickable && <ChevronRight className="h-3 w-3 mt-0.5 text-muted-foreground flex-shrink-0" />}
          </button>
        );
      })}
    </div>
  );

  if (compact) {
    return (
      <ScrollArea className="max-h-[260px]">
        {content}
      </ScrollArea>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          {t("aiInsights")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {content}
      </CardContent>
    </Card>
  );
}
