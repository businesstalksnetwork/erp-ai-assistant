import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { useLegalEntities } from "@/hooks/useLegalEntities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { postWithRuleOrFallback } from "@/lib/postingHelper";
import { DollarSign, TrendingUp, TrendingDown, ArrowLeftRight, Download, AlertTriangle, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface RevalLine {
  open_item_id: string;
  partner_name: string;
  document_number: string;
  currency: string;
  remaining_amount: number;
  original_rate: number;
  new_rate: number;
  original_amount_rsd: number;
  revalued_amount_rsd: number;
  difference: number;
  direction: string;
}

export default function FxRevaluation() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { entities } = useLegalEntities();
  const [revalDate, setRevalDate] = useState(new Date().toISOString().split("T")[0]);
  const [legalEntityFilter, setLegalEntityFilter] = useState("__all__");
  const [previewLines, setPreviewLines] = useState<RevalLine[]>([]);
  const [previewed, setPreviewed] = useState(false);
  const [useLatestRate, setUseLatestRate] = useState(false);
  const [fetchingRates, setFetchingRates] = useState(false);

  const { data: history = [] } = useQuery({
    queryKey: ["fx-revaluations", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fx_revaluations")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("revaluation_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // Check rate availability for the selected date
  const { data: availableRates = [] } = useQuery({
    queryKey: ["fx-rates-availability", tenantId, revalDate],
    queryFn: async () => {
      const { data } = await supabase
        .from("exchange_rates")
        .select("from_currency, rate, rate_date, source")
        .eq("tenant_id", tenantId!)
        .eq("to_currency", "RSD")
        .eq("rate_date", revalDate);
      return data || [];
    },
    enabled: !!tenantId && !!revalDate,
  });

  const fetchNbsRates = async () => {
    setFetchingRates(true);
    try {
      const { data, error } = await supabase.functions.invoke("nbs-exchange-rates", {
        body: { tenant_id: tenantId, date: revalDate },
      });
      if (error) throw error;
      const count = data?.imported || 0;
      toast({ title: t("success"), description: `${count} ${t("ratesImported")}` });
      // Refresh rate availability
      qc.invalidateQueries({ queryKey: ["fx-rates-availability"] });
    } catch (e: any) {
      toast({ title: t("error"), description: e.message, variant: "destructive" });
    } finally {
      setFetchingRates(false);
    }
  };

  const previewMutation = useMutation({
    mutationFn: async () => {
      // Fetch open items in foreign currencies
      let query = supabase
        .from("open_items")
        .select("*, partners(name)")
        .eq("tenant_id", tenantId!)
        .neq("currency", "RSD")
        .gt("remaining_amount", 0)
        .in("status", ["open", "partial"]);
      
      const { data: openItems, error } = await query;
      if (error) throw error;
      if (!openItems || openItems.length === 0) return [];

      // Fetch exchange rates for the revaluation date
      const currencies = [...new Set(openItems.map(oi => oi.currency))];
      const { data: rates } = await supabase
        .from("exchange_rates")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("to_currency", "RSD")
        .in("from_currency", currencies)
        .eq("rate_date", revalDate);

      const rateMap: Record<string, number> = {};
      rates?.forEach(r => { rateMap[r.from_currency] = Number(r.rate); });

      // Fallback: use latest available rate for missing currencies
      if (useLatestRate) {
        const missingCurrencies = currencies.filter(c => !rateMap[c]);
        if (missingCurrencies.length > 0) {
          for (const cur of missingCurrencies) {
            const { data: latestRate } = await supabase
              .from("exchange_rates")
              .select("rate, rate_date")
              .eq("tenant_id", tenantId!)
              .eq("to_currency", "RSD")
              .eq("from_currency", cur)
              .lte("rate_date", revalDate)
              .order("rate_date", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (latestRate) {
              rateMap[cur] = Number(latestRate.rate);
            }
          }
        }
      }

      const lines: RevalLine[] = [];
      for (const oi of openItems) {
        const newRate = rateMap[oi.currency];
        if (!newRate) continue;
        const originalRate = Number((oi as any).exchange_rate) || newRate;
        const remaining = Number(oi.remaining_amount);
        const originalRsd = remaining * originalRate;
        const revaluedRsd = remaining * newRate;
        const diff = revaluedRsd - originalRsd;
        // For payables, the sign is inverted (if we owe more, it's a loss)
        const adjustedDiff = oi.direction === "payable" ? -diff : diff;

        if (Math.abs(adjustedDiff) < 0.01) continue;

        lines.push({
          open_item_id: oi.id,
          partner_name: (oi.partners as any)?.name || "—",
          document_number: oi.document_number || "—",
          currency: oi.currency,
          remaining_amount: remaining,
          original_rate: originalRate,
          new_rate: newRate,
          original_amount_rsd: originalRsd,
          revalued_amount_rsd: revaluedRsd,
          difference: adjustedDiff,
          direction: oi.direction,
        });
      }
      return lines;
    },
    onSuccess: (lines) => {
      setPreviewLines(lines || []);
      setPreviewed(true);
      if (!lines || lines.length === 0) {
        toast({ title: t("noForeignCurrencyItems") });
      }
    },
    onError: (err: any) => toast({ title: t("error"), description: err.message, variant: "destructive" }),
  });

  const postMutation = useMutation({
    mutationFn: async () => {
      if (previewLines.length === 0) return;

      const totalGain = previewLines.filter(l => l.difference > 0).reduce((s, l) => s + l.difference, 0);
      const totalLoss = previewLines.filter(l => l.difference < 0).reduce((s, l) => s + Math.abs(l.difference), 0);

      // Build journal entry lines
      const journalLines: any[] = [];
      let sortOrder = 0;

      // Group gains and losses
      if (totalGain > 0) {
        // Gains: Debit AR/AP offset, Credit 6700 (FX Gain)
        const arGain = previewLines.filter(l => l.difference > 0 && l.direction === "receivable").reduce((s, l) => s + l.difference, 0);
        const apGain = previewLines.filter(l => l.difference > 0 && l.direction === "payable").reduce((s, l) => s + l.difference, 0);
        if (arGain > 0) journalLines.push({ accountCode: "2040", debit: arGain, credit: 0, description: `FX Reval Gain - AR`, sortOrder: sortOrder++ });
        if (apGain > 0) journalLines.push({ accountCode: "4350", debit: apGain, credit: 0, description: `FX Reval Gain - AP`, sortOrder: sortOrder++ });
        journalLines.push({ accountCode: "6072", debit: 0, credit: totalGain, description: `FX Gain - ${revalDate}`, sortOrder: sortOrder++ });
      }
      if (totalLoss > 0) {
        journalLines.push({ accountCode: "5072", debit: totalLoss, credit: 0, description: `FX Loss - ${revalDate}`, sortOrder: sortOrder++ });
        const arLoss = previewLines.filter(l => l.difference < 0 && l.direction === "receivable").reduce((s, l) => s + Math.abs(l.difference), 0);
        const apLoss = previewLines.filter(l => l.difference < 0 && l.direction === "payable").reduce((s, l) => s + Math.abs(l.difference), 0);
        if (arLoss > 0) journalLines.push({ accountCode: "2040", debit: 0, credit: arLoss, description: `FX Reval Loss - AR`, sortOrder: sortOrder++ });
        if (apLoss > 0) journalLines.push({ accountCode: "4350", debit: 0, credit: apLoss, description: `FX Reval Loss - AP`, sortOrder: sortOrder++ });
      }

      const journalId = await postWithRuleOrFallback({
        tenantId: tenantId!,
        userId: user?.id || null,
        entryDate: revalDate,
        modelCode: totalGain >= totalLoss ? "FX_GAIN" : "FX_LOSS",
        amount: Math.max(totalGain, totalLoss),
        description: `FX Revaluation - ${revalDate}`,
        reference: `FXREVAL-${revalDate}`,
        context: {},
        fallbackLines: journalLines,
      });

      // Create revaluation record
      const { data: reval, error: revalErr } = await supabase.from("fx_revaluations").insert({
        tenant_id: tenantId!,
        legal_entity_id: legalEntityFilter !== "__all__" ? legalEntityFilter : null,
        revaluation_date: revalDate,
        total_gain: totalGain,
        total_loss: totalLoss,
        journal_entry_id: journalId,
        created_by: user?.id || null,
      }).select("id").single();
      if (revalErr) throw revalErr;

      // Create revaluation lines
      const { error: linesErr } = await supabase.from("fx_revaluation_lines").insert(
        previewLines.map(l => ({
          revaluation_id: reval.id,
          open_item_id: l.open_item_id,
          currency: l.currency,
          original_rate: l.original_rate,
          new_rate: l.new_rate,
          original_amount_rsd: l.original_amount_rsd,
          revalued_amount_rsd: l.revalued_amount_rsd,
          difference: l.difference,
        }))
      );
      if (linesErr) throw linesErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fx-revaluations"] });
      toast({ title: t("success") });
      setPreviewLines([]);
      setPreviewed(false);
    },
    onError: (err: any) => toast({ title: t("error"), description: err.message, variant: "destructive" }),
  });

  const totalGain = previewLines.filter(l => l.difference > 0).reduce((s, l) => s + l.difference, 0);
  const totalLoss = previewLines.filter(l => l.difference < 0).reduce((s, l) => s + Math.abs(l.difference), 0);
  const netEffect = totalGain - totalLoss;
  const fmtNum = (n: number) => n.toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("fxRevaluation")}</h1>

      <Tabs defaultValue="revaluation">
        <TabsList>
          <TabsTrigger value="revaluation">{t("fxRevaluation")}</TabsTrigger>
          <TabsTrigger value="history">{t("revaluationHistory")}</TabsTrigger>
        </TabsList>

        <TabsContent value="revaluation" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <Label>{t("revaluationDate")}</Label>
                  <Input type="date" value={revalDate} onChange={(e) => setRevalDate(e.target.value)} className="w-48" />
                </div>
                <div className="w-48">
                  <Label>{t("legalEntity")}</Label>
                  <Select value={legalEntityFilter} onValueChange={setLegalEntityFilter}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">{t("allLegalEntities")}</SelectItem>
                      {entities.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={fetchNbsRates} disabled={fetchingRates} variant="outline">
                  {fetchingRates ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
                  {t("fetchNbsRates")}
                </Button>
                <div className="flex items-center gap-2">
                  <Switch checked={useLatestRate} onCheckedChange={setUseLatestRate} />
                  <span className="text-sm text-muted-foreground">{t("useLatestRate")}</span>
                </div>
                <Button onClick={() => previewMutation.mutate()} disabled={previewMutation.isPending}>
                  {t("search")}
                </Button>
              </div>
              {availableRates.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {availableRates.map((r: any) => (
                    <Badge key={r.from_currency} variant="outline" className="text-xs">{r.from_currency}: {Number(r.rate).toFixed(4)}</Badge>
                  ))}
                </div>
              )}
            </CardHeader>
          </Card>

          {previewed && previewLines.length > 0 && (
            <>
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6 flex items-center gap-3">
                    <TrendingUp className="h-8 w-8 text-green-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">{t("fxGain")}</p>
                      <p className="text-xl font-bold">{fmtNum(totalGain)} RSD</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 flex items-center gap-3">
                    <TrendingDown className="h-8 w-8 text-red-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">{t("fxLoss")}</p>
                      <p className="text-xl font-bold">{fmtNum(totalLoss)} RSD</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 flex items-center gap-3">
                    <ArrowLeftRight className="h-8 w-8 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">{t("netEffect")}</p>
                      <p className={`text-xl font-bold ${netEffect >= 0 ? "text-green-600" : "text-red-600"}`}>{fmtNum(netEffect)} RSD</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("partner")}</TableHead>
                        <TableHead>{t("documentNumber")}</TableHead>
                        <TableHead>{t("currency")}</TableHead>
                        <TableHead className="text-right">{t("originalRate")}</TableHead>
                        <TableHead className="text-right">{t("newRate")}</TableHead>
                        <TableHead className="text-right">Original RSD</TableHead>
                        <TableHead className="text-right">{t("revaluedAmount")}</TableHead>
                        <TableHead className="text-right">{t("balance")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewLines.map((l, i) => (
                        <TableRow key={i}>
                          <TableCell>{l.partner_name}</TableCell>
                          <TableCell>{l.document_number}</TableCell>
                          <TableCell><Badge variant="outline">{l.currency}</Badge></TableCell>
                          <TableCell className="text-right font-mono">{fmtNum(l.original_rate)}</TableCell>
                          <TableCell className="text-right font-mono">{fmtNum(l.new_rate)}</TableCell>
                          <TableCell className="text-right font-mono">{fmtNum(l.original_amount_rsd)}</TableCell>
                          <TableCell className="text-right font-mono">{fmtNum(l.revalued_amount_rsd)}</TableCell>
                          <TableCell className={`text-right font-mono font-bold ${l.difference >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {l.difference >= 0 ? "+" : ""}{fmtNum(l.difference)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button onClick={() => postMutation.mutate()} disabled={postMutation.isPending} size="lg">
                  {t("postRevaluation")}
                </Button>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("date")}</TableHead>
                    <TableHead className="text-right">{t("fxGain")}</TableHead>
                    <TableHead className="text-right">{t("fxLoss")}</TableHead>
                    <TableHead className="text-right">{t("netEffect")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((h: any) => (
                    <TableRow key={h.id}>
                      <TableCell>{h.revaluation_date}</TableCell>
                      <TableCell className="text-right font-mono text-green-600">{fmtNum(Number(h.total_gain))}</TableCell>
                      <TableCell className="text-right font-mono text-red-600">{fmtNum(Number(h.total_loss))}</TableCell>
                      <TableCell className="text-right font-mono font-bold">{fmtNum(Number(h.total_gain) - Number(h.total_loss))}</TableCell>
                    </TableRow>
                  ))}
                  {history.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
