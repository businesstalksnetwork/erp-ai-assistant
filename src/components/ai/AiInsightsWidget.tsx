import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, AlertTriangle, AlertCircle, Info, Loader2, ChevronRight } from "lucide-react";

const insightRouteMap: Record<string, string> = {
  overdue_invoices: "/accounting/invoices?filter=overdue",
  large_invoices: "/accounting/invoices?filter=sent",
  zero_stock: "/inventory/stock?filter=zero_stock",
  low_stock: "/inventory/stock?filter=low_stock",
  draft_journals: "/accounting/journal?filter=draft",
  payroll_anomaly: "/hr/payroll",
  excessive_overtime: "/hr/overtime",
  leave_balance_warning: "/hr/annual-leave",
  stale_leads: "/crm/leads?filter=new",
  high_value_at_risk: "/crm/opportunities?filter=at_risk",
  budget_variance: "/analytics/budget",
  revenue_declining: "/analytics",
  slow_moving: "/analytics/inventory-health",
  reorder_suggestion: "/purchasing/orders",
  expense_spike: "/analytics/expenses",
  duplicate_invoices: "/purchasing/invoices",
  weekend_postings: "/accounting/journal",
  dormant_accounts: "/crm/companies",
  at_risk_accounts: "/crm/companies",
};

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
  critical: { icon: AlertCircle, color: "text-destructive", badge: "destructive" as const, bg: "bg-destructive/5" },
  warning: { icon: AlertTriangle, color: "text-amber-500", badge: "warning" as const, bg: "bg-warning/5" },
  info: { icon: Info, color: "text-blue-500", badge: "info" as const, bg: "bg-blue-50 dark:bg-blue-950/20" },
};

export function AiInsightsWidget({ tenantId }: AiInsightsWidgetProps) {
  const { t, locale } = useLanguage();
  const severityLabels: Record<string, string> = {
    critical: t("critical"),
    warning: t("severityWarning"),
    info: t("severityInfo"),
  };
  const navigate = useNavigate();

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
              {t("analyzingData")}
            </span>
          </div>
        ) : !insights?.length ? (
          <p className="text-sm text-muted-foreground">
            {t("noInsightsAvailable")}
          </p>
        ) : (
          <div className="space-y-2">
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
                  className={`flex items-start gap-3 p-2 rounded-md w-full text-left transition-colors ${config.bg} ${
                    isClickable ? "hover:bg-muted/50 cursor-pointer" : "cursor-default"
                  }`}
                >
                  <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${config.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{insight.title}</span>
                      <Badge variant={config.badge} className="text-xs">
                        {severityLabels[insight.severity]}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{insight.description}</p>
                  </div>
                  {isClickable && <ChevronRight className="h-4 w-4 mt-1 text-muted-foreground flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
