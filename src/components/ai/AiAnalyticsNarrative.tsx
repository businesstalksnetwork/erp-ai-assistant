import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Loader2, Lightbulb, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface Props {
  tenantId: string;
  contextType: "dashboard" | "ratios" | "cashflow" | "planning" | "budget" | "breakeven" | "profitability" | "expenses" | "working_capital" | "customer_risk" | "supplier_risk" | "margin_bridge" | "payroll_benchmark" | "vat_trap" | "inventory_health" | "early_warning" | "production" | "crm_pipeline" | "hr_overview" | "pos_performance" | "purchasing" | "sales_performance";
  data: Record<string, unknown>;
}

export function AiAnalyticsNarrative({ tenantId, contextType, data }: Props) {
  const { locale } = useLanguage();
  const sr = locale === "sr";

  const { data: result, isLoading, error } = useQuery({
    queryKey: ["ai-narrative", tenantId, contextType],
    queryFn: async () => {
      const { data: resp, error } = await supabase.functions.invoke("ai-analytics-narrative", {
        body: { tenant_id: tenantId, context_type: contextType, data, language: locale },
      });
      if (error) {
        // Handle rate limit / payment errors
        if (error.message?.includes("429")) {
          toast.error(sr ? "Preopterećenje AI servisa. Pokušajte ponovo." : "AI rate limited. Please try again later.");
        } else if (error.message?.includes("402")) {
          toast.error(sr ? "Potrebno dopuniti AI kredite." : "AI credits required. Please add funds.");
        }
        throw error;
      }
      return resp as { narrative?: string; recommendations?: string[] };
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 10, // 10 min cache
    refetchOnWindowFocus: false,
    retry: false,
  });

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
        <CardContent className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {sr ? "AI analizira podatke..." : "AI is analyzing your data..."}
        </CardContent>
      </Card>
    );
  }

  if (error || (!result?.narrative && !result?.recommendations?.length)) {
    return null; // Silently fail - AI narrative is optional enhancement
  }

  const hasRecs = result?.recommendations && result.recommendations.length > 0;

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          {sr ? "AI analiza" : "AI Analysis"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {result?.narrative && (
          <p className="text-sm text-foreground/80 leading-relaxed">{result.narrative}</p>
        )}
        {hasRecs && (
          <>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Lightbulb className="h-3.5 w-3.5 text-primary" />
              {sr ? "Preporučene akcije" : "Recommended Actions"}
            </p>
            <ul className="space-y-1.5">
              {result!.recommendations!.map((rec, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-primary mt-0.5 flex-shrink-0">●</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
