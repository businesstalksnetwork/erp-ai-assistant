import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { BiPageLayout } from "@/components/shared/BiPageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calculator, Loader2, RefreshCw, TrendingUp, TrendingDown, Minus } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from "recharts";

export default function AiPayrollPredictor() {
  const { tenantId } = useTenant();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["ai-payroll-predict", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("ai-payroll-predict", {
        body: { tenant_id: tenantId },
      });
      if (error) throw error;
      return data as {
        projected_gross: number; projected_net: number;
        last_month_gross: number; delta_gross: number;
        continuing: { id: string; name: string; gross: number; net: number }[];
        new_hires: { id: string; name: string; gross: number; net: number }[];
        departures: { id: string; name: string; gross: number; net: number }[];
        history: { month: number; year: number; gross: number; net: number; label: string }[];
        forecast_month: string; narrative: string;
      };
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 15,
  });

  const fmt = (n: number) => new Intl.NumberFormat("sr-Latn-RS", { maximumFractionDigits: 0 }).format(n);
  const deltaPct = data && data.last_month_gross > 0 ? ((data.delta_gross / data.last_month_gross) * 100).toFixed(1) : "0";

  const chartData = data ? [
    ...(data.history || []).map(h => ({ ...h, type: "actual" })),
    { label: data.forecast_month, gross: data.projected_gross, net: data.projected_net, type: "forecast" },
  ] : [];

  return (
    <BiPageLayout
      title="AI Payroll Predictor"
      description={`Next month forecast: ${data?.forecast_month || "..."}`}
      icon={Calculator}
      stats={[
        { label: "Projected Gross", value: data ? fmt(data.projected_gross) : "—", icon: Calculator },
        { label: "Projected Net", value: data ? fmt(data.projected_net) : "—", icon: Calculator },
        { label: "Δ vs Last Month", value: data ? `${Number(deltaPct) >= 0 ? "+" : ""}${deltaPct}%` : "—", icon: data && data.delta_gross > 0 ? TrendingUp : TrendingDown, color: data && data.delta_gross > 0 ? "text-destructive" : undefined },
        { label: "Headcount", value: data ? data.continuing.length + data.new_hires.length : "—", icon: Calculator },
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
          <span className="ml-3 text-muted-foreground">Projecting payroll...</span>
        </div>
      )}

      {chartData.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Payroll Trend (6-Month History + Forecast)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <Tooltip formatter={(value: number) => fmt(value) + " RSD"} />
                <Legend />
                <Bar dataKey="gross" name="Gross" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="net" name="Net" fill="hsl(var(--primary) / 0.5)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {data?.narrative && (
          <Card>
            <CardHeader><CardTitle className="text-sm">AI Budget Impact Analysis</CardTitle></CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{data.narrative}</ReactMarkdown>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle className="text-sm">Breakdown</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Minus className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Continuing ({data?.continuing.length || 0})</span>
                </div>
                <span className="font-mono text-sm">{fmt(data?.continuing.reduce((s, e) => s + e.gross, 0) || 0)}</span>
              </div>
              {(data?.new_hires || []).length > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <span className="text-sm">New Hires ({data.new_hires.length})</span>
                  </div>
                  <span className="font-mono text-sm text-primary">+{fmt(data.new_hires.reduce((s, e) => s + e.gross, 0))}</span>
                </div>
              )}
              {(data?.departures || []).length > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-destructive" />
                    <span className="text-sm">Departures ({data.departures.length})</span>
                  </div>
                  <span className="font-mono text-sm text-destructive">-{fmt(data.departures.reduce((s, e) => s + e.gross, 0))}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {data && (data.new_hires.length > 0 || data.departures.length > 0) && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Personnel Changes</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Gross Salary</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.new_hires.map(e => (
                  <TableRow key={e.id}>
                    <TableCell>{e.name}</TableCell>
                    <TableCell><Badge variant="default">New Hire</Badge></TableCell>
                    <TableCell className="text-right font-mono">{fmt(e.gross)}</TableCell>
                  </TableRow>
                ))}
                {data.departures.map(e => (
                  <TableRow key={e.id}>
                    <TableCell>{e.name}</TableCell>
                    <TableCell><Badge variant="destructive">Departure</Badge></TableCell>
                    <TableCell className="text-right font-mono">{fmt(e.gross)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </BiPageLayout>
  );
}
