import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, RefreshCw } from "lucide-react";

interface Recommendation {
  member_name: string;
  card_number: string;
  recommendation: string;
  action_type: string;
  priority: string;
}

export function LoyaltyRecommendations() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("ai-loyalty-recommendations", {
        body: { tenant_id: tenantId },
      });
      if (error) throw error;
      return data?.recommendations || [];
    },
    onSuccess: (data) => setRecommendations(data),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-1">
            <Sparkles className="h-4 w-4 text-yellow-500" />
            AI Loyalty Recommendations
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
            <RefreshCw className={`h-3 w-3 mr-1 ${generateMutation.isPending ? "animate-spin" : ""}`} />
            {t("generate" as any) || "Generate"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {recommendations.length === 0 ? (
          <p className="text-sm text-muted-foreground">Click Generate to get AI-powered recommendations for your loyalty program.</p>
        ) : (
          <div className="space-y-3">
            {recommendations.map((rec, i) => (
              <div key={i} className="border border-border/40 rounded-lg p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{rec.member_name}</span>
                  <Badge variant={rec.priority === "high" ? "destructive" : rec.priority === "medium" ? "default" : "secondary"} className="text-xs">{rec.priority}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{rec.recommendation}</p>
                <Badge variant="outline" className="text-xs">{rec.action_type}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
