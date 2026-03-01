import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { BiPageLayout } from "@/components/shared/BiPageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Loader2, RefreshCw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip } from "recharts";
import { useState } from "react";

interface ScoredSupplier {
  id: string; name: string; composite_score: number;
  delivery_score: number; price_score: number; payment_score: number; quality_score: number;
  total_spend: number; order_count: number; invoice_count: number; recommendation: string;
}

function ScoreBadge({ score }: { score: number }) {
  const variant = score >= 75 ? "default" : score >= 50 ? "secondary" : "destructive";
  return <Badge variant={variant}>{score}</Badge>;
}

function SupplierRadar({ supplier }: { supplier: ScoredSupplier }) {
  const radarData = [
    { dimension: "Delivery", value: supplier.delivery_score },
    { dimension: "Price", value: supplier.price_score },
    { dimension: "Payment", value: supplier.payment_score },
    { dimension: "Quality", value: supplier.quality_score },
  ];
  return (
    <ResponsiveContainer width={180} height={150}>
      <RadarChart data={radarData}>
        <PolarGrid />
        <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 10 }} />
        <PolarRadiusAxis domain={[0, 100]} tick={false} />
        <Radar dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.3)" />
        <Tooltip />
      </RadarChart>
    </ResponsiveContainer>
  );
}

export default function AiSupplierScoring() {
  const { tenantId } = useTenant();
  const [selected, setSelected] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["ai-supplier-scoring", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("ai-supplier-scoring", {
        body: { tenant_id: tenantId },
      });
      if (error) throw error;
      return data as { suppliers: ScoredSupplier[]; narrative: string };
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 15,
  });

  const fmt = (n: number) => new Intl.NumberFormat("sr-Latn-RS", { maximumFractionDigits: 0 }).format(n);
  const suppliers = data?.suppliers || [];
  const avgScore = suppliers.length > 0 ? Math.round(suppliers.reduce((s, x) => s + x.composite_score, 0) / suppliers.length) : 0;
  const selectedSupplier = suppliers.find(s => s.id === selected);

  return (
    <BiPageLayout
      title="AI Supplier Scoring"
      description="Composite supplier evaluation with AI-powered strategic recommendations"
      icon={Users}
      stats={[
        { label: "Suppliers Scored", value: suppliers.length, icon: Users },
        { label: "Average Score", value: avgScore, icon: Users },
        { label: "Top Performer", value: suppliers[0]?.name || "—", icon: Users },
        { label: "At Risk", value: suppliers.filter(s => s.composite_score < 50).length, icon: Users, color: suppliers.filter(s => s.composite_score < 50).length > 0 ? "text-destructive" : undefined },
      ]}
      actions={
        <Button onClick={() => refetch()} disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Refresh Scores
        </Button>
      }
    >
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-3 text-muted-foreground">Scoring suppliers...</span>
        </div>
      )}

      {data?.narrative && (
        <Card>
          <CardHeader><CardTitle className="text-sm">AI Strategic Summary</CardTitle></CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{data.narrative}</ReactMarkdown>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rank</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-center">Score</TableHead>
                    <TableHead className="text-center">Delivery</TableHead>
                    <TableHead className="text-center">Price</TableHead>
                    <TableHead className="text-center">Quality</TableHead>
                    <TableHead className="text-right">Total Spend</TableHead>
                    <TableHead>Recommendation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.map((s, i) => (
                    <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(s.id === selected ? null : s.id)}>
                      <TableCell className="font-medium">#{i + 1}</TableCell>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-center"><ScoreBadge score={s.composite_score} /></TableCell>
                      <TableCell className="text-center text-sm">{s.delivery_score}</TableCell>
                      <TableCell className="text-center text-sm">{s.price_score}</TableCell>
                      <TableCell className="text-center text-sm">{s.quality_score}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{fmt(s.total_spend)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{s.recommendation}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div>
          {selectedSupplier ? (
            <Card>
              <CardHeader><CardTitle className="text-sm">{selectedSupplier.name}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <SupplierRadar supplier={selectedSupplier} />
                <div className="text-xs space-y-1">
                  <div className="flex justify-between"><span>Orders:</span><span className="font-medium">{selectedSupplier.order_count}</span></div>
                  <div className="flex justify-between"><span>Invoices:</span><span className="font-medium">{selectedSupplier.invoice_count}</span></div>
                  <div className="flex justify-between"><span>Payment:</span><span className="font-medium">{selectedSupplier.payment_score}/100</span></div>
                </div>
                {selectedSupplier.recommendation && (
                  <p className="text-xs text-muted-foreground border-t pt-2">{selectedSupplier.recommendation}</p>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Click a supplier row to see the radar chart
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </BiPageLayout>
  );
}
