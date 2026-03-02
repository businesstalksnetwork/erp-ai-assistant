import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Brain, RefreshCw, ArrowRight, TrendingUp, ShoppingBasket } from "lucide-react";

export default function MarketBasketAnalysis() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const { data: analysis, refetch } = useQuery({
    queryKey: ["market_basket", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("ai-market-basket", {
          body: { tenant_id: tenantId, language: "sr" },
        });
        if (error) throw error;
        return data;
      } finally {
        setLoading(false);
      }
    },
    enabled: false,
  });

  const runAnalysis = async () => {
    setLoading(true);
    try {
      await refetch();
      toast({ title: "Analiza završena" });
    } catch (e: any) {
      toast({ title: t("error"), description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const liftBadge = (lift: number) => {
    if (lift >= 3) return <Badge variant="default">Jak ({lift}x)</Badge>;
    if (lift >= 1.5) return <Badge variant="secondary">Umeren ({lift}x)</Badge>;
    return <Badge variant="outline">Slab ({lift}x)</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Brain className="h-6 w-6 text-primary" />Analiza korpe</h1>
          <p className="text-sm text-muted-foreground">AI Market Basket Analysis — otkrivanje obrazaca zajedničke kupovine.</p>
        </div>
        <Button onClick={runAnalysis} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Analiziram..." : "Pokreni analizu"}
        </Button>
      </div>

      {analysis && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ShoppingBasket className="h-4 w-4 text-primary" />Analizirane transakcije</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{analysis.total_transactions}</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Pronađeni parovi</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{analysis.pairs?.length || 0}</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Period analize</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{analysis.analysis_period_days} dana</p></CardContent></Card>
          </div>

          {/* AI Recommendations */}
          {analysis.recommendations?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" />AI preporuke</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {analysis.recommendations.map((rec: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <ArrowRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Product pairs table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Parovi proizvoda po lift skoru</CardTitle>
              <CardDescription>Lift &gt; 1.0 znači da se proizvodi kupuju zajedno češće nego slučajno.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proizvod A</TableHead>
                    <TableHead></TableHead>
                    <TableHead>Proizvod B</TableHead>
                    <TableHead>Zajednička kupovina</TableHead>
                    <TableHead>Support %</TableHead>
                    <TableHead>Confidence A→B</TableHead>
                    <TableHead>Lift</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(analysis.pairs || []).map((p: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{p.product_a}</TableCell>
                      <TableCell><ArrowRight className="h-3 w-3 text-muted-foreground" /></TableCell>
                      <TableCell className="font-medium">{p.product_b}</TableCell>
                      <TableCell>{p.co_occurrences}</TableCell>
                      <TableCell>{p.support}%</TableCell>
                      <TableCell>{p.confidence_a_to_b}%</TableCell>
                      <TableCell>{liftBadge(p.lift)}</TableCell>
                    </TableRow>
                  ))}
                  {(!analysis.pairs || analysis.pairs.length === 0) && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">{analysis.message || t("noResults")}</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {!analysis && !loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Kliknite "Pokreni analizu" za analizu obrazaca kupovine iz POS transakcija.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
