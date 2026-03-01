import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { BiPageLayout } from "@/components/shared/BiPageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Loader2, RefreshCw, AlertTriangle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

export default function AiCashFlowPredictor() {
  const { tenantId } = useTenant();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["ai-cash-flow-predict", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("ai-cash-flow-predict", {
        body: { tenant_id: tenantId },
      });
      if (error) throw error;
      return data as {
        projections: { day: number; date: string; expected: number; optimistic: number; pessimistic: number }[];
        current_balance: number; total_ar: number; total_ap: number;
        days_of_runway: number; shortfall_date: string | null;
        largest_obligations: { amount: number; due_date: string }[];
        narrative: string;
      };
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 15,
  });

  const fmt = (n: number) => new Intl.NumberFormat("sr-Latn-RS", { maximumFractionDigits: 0 }).format(n);

  return (
    <BiPageLayout
      title="AI Cash Flow Predictor"
      description="90-day cash position forecast with AI-powered risk analysis"
      icon={TrendingUp}
      stats={[
        { label: "Current Balance", value: data ? fmt(data.current_balance) : "—", icon: TrendingUp },
        { label: "Days of Runway", value: data?.days_of_runway ?? "—", icon: AlertTriangle, color: (data?.days_of_runway ?? 999) < 30 ? "text-destructive" : undefined },
        { label: "Open AR", value: data ? fmt(data.total_ar) : "—", icon: TrendingUp },
        { label: "Open AP", value: data ? fmt(data.total_ap) : "—", icon: TrendingUp },
      ]}
      actions={
        <Button onClick={() => refetch()} disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Refresh Forecast
        </Button>
      }
    >
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-3 text-muted-foreground">Generating cash flow forecast...</span>
        </div>
      )}

      {data?.shortfall_date && (
        <Card className="border-destructive">
          <CardContent className="py-3 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <span className="text-sm font-medium">Projected cash shortfall on <strong>{data.shortfall_date}</strong></span>
          </CardContent>
        </Card>
      )}

      {data?.projections && data.projections.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">90-Day Cash Position Forecast</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={data.projections}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <Tooltip formatter={(value: number) => fmt(value) + " RSD"} />
                <Legend />
                <Area type="monotone" dataKey="optimistic" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.1)" name="Optimistic" />
                <Area type="monotone" dataKey="expected" stroke="hsl(var(--foreground))" fill="hsl(var(--foreground) / 0.1)" name="Expected" strokeWidth={2} />
                <Area type="monotone" dataKey="pessimistic" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive) / 0.1)" name="Pessimistic" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {data?.narrative && (
          <Card>
            <CardHeader><CardTitle className="text-sm">AI Risk Assessment</CardTitle></CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{data.narrative}</ReactMarkdown>
            </CardContent>
          </Card>
        )}

        {data?.largest_obligations && data.largest_obligations.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Largest Upcoming Obligations</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.largest_obligations.map((o, i) => (
                  <div key={i} className="flex justify-between items-center py-1 border-b border-border last:border-0">
                    <Badge variant="outline">{o.due_date}</Badge>
                    <span className="font-mono text-sm">{fmt(o.amount)} RSD</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </BiPageLayout>
  );
}
