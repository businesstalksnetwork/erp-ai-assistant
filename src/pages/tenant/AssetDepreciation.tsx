import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Play, CheckCircle, Calculator } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { postWithRuleOrFallback } from "@/lib/postingHelper";
import { fmtNum } from "@/lib/utils";

// CR4-06: ZPDPL (Zakon o porezu na dobit pravnih lica)
const ZPDPL_GROUPS = [
  { value: "I", label: "Grupa I – 2.5%", rate: 2.5, desc: "Građevinski objekti" },
  { value: "II", label: "Grupa II – 10%", rate: 10, desc: "Oprema, nameštaj" },
  { value: "III", label: "Grupa III – 15%", rate: 15, desc: "Vozila, nematerijalna sredstva" },
  { value: "IV", label: "Grupa IV – 20%", rate: 20, desc: "Kompjuteri, elektronska oprema" },
  { value: "V", label: "Grupa V – 30%", rate: 30, desc: "Specifična oprema" },
];

export default function AssetDepreciation() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [period, setPeriod] = useState(format(new Date(), "yyyy-MM"));
  const [activeTab, setActiveTab] = useState("accounting");

  // Fetch active fixed assets with their details
  const { data: assets = [], isLoading } = useQuery({
    queryKey: ["depreciation-assets", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("assets")
        .select("*, asset_categories(name, code, default_depreciation_method, default_useful_life_months, default_depreciation_account, default_accumulation_account, default_expense_account), fixed_asset_details(*, expense_account:chart_of_accounts!fixed_asset_details_expense_account_id_fkey(account_code), accumulation_account:chart_of_accounts!fixed_asset_details_accumulation_account_id_fkey(account_code))")
        .eq("tenant_id", tenantId)
        .in("asset_type", ["fixed_asset", "intangible"])
        .in("status", ["active", "in_use"])
        .order("asset_code");
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Fetch existing depreciation schedules
  const { data: schedules = [] } = useQuery({
    queryKey: ["depreciation-schedules", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("fixed_asset_depreciation_schedules")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("period", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Fetch ZPDP tax depreciation data
  const { data: taxDepData = [] } = useQuery({
    queryKey: ["tax-depreciation", tenantId, period],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase.rpc("calculate_tax_depreciation" as any, {
        p_tenant_id: tenantId,
        p_period: period,
      });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!tenantId && activeTab === "tax",
  });

  const getAccumulated = (assetId: string) =>
    schedules
      .filter((s: any) => s.asset_id === assetId)
      .reduce((sum: number, s: any) => sum + Number(s.depreciation_amount || 0), 0);

  const isPeriodDone = (assetId: string) =>
    schedules.some((s: any) => s.asset_id === assetId && s.period_start?.startsWith(period));

  const calcMonthlyDepreciation = (asset: any) => {
    const detail = Array.isArray(asset.fixed_asset_details) ? asset.fixed_asset_details[0] : asset.fixed_asset_details;
    const cat = asset.asset_categories;
    const cost = Number(asset.acquisition_cost) || 0;
    const salvage = Number(asset.residual_value) || 0;
    const lifeMonths = detail?.useful_life_months || cat?.default_useful_life_months || 60;
    const method = detail?.depreciation_method || cat?.default_depreciation_method || "straight_line";
    const accumulated = getAccumulated(asset.id);
    const bookValue = cost - accumulated;

    if (bookValue <= salvage) return 0;

    let amount: number;
    if (method === "straight_line") {
      amount = (cost - salvage) / lifeMonths;
    } else {
      const annualRate = 2 / (lifeMonths / 12);
      amount = (bookValue * annualRate) / 12;
    }
    return Math.min(Math.round(amount * 100) / 100, bookValue - salvage);
  };

  // Run depreciation for single asset
  const singleMutation = useMutation({
    mutationFn: async (asset: any) => {
      if (!tenantId || !user) throw new Error("Missing context");
      const amount = calcMonthlyDepreciation(asset);
      if (amount <= 0) return;

      const detail = Array.isArray(asset.fixed_asset_details) ? asset.fixed_asset_details[0] : asset.fixed_asset_details;
      const cat = asset.asset_categories;
      const expenseAccount = detail?.expense_account?.account_code || cat?.default_expense_account || "5310";
      const accumAccount = detail?.accumulation_account?.account_code || cat?.default_accumulation_account || "0121";
      const entryDate = `${period}-01`;

      const journalId = await postWithRuleOrFallback({
        tenantId, userId: user.id, entryDate,
        modelCode: "ASSET_DEPRECIATION", amount,
        description: `${t("assetsDepreciation")} - ${asset.name} - ${period}`,
        reference: `DEP-${asset.asset_code}-${period}`,
        legalEntityId: asset.legal_entity_id || undefined,
        context: {},
        fallbackLines: [
          { accountCode: expenseAccount, debit: amount, credit: 0, description: `${t("assetsDepExpense")} - ${asset.name}`, sortOrder: 0 },
          { accountCode: accumAccount, debit: 0, credit: amount, description: `${t("assetsAccumDep")} - ${asset.name}`, sortOrder: 1 },
        ],
      });

      const accumulated = getAccumulated(asset.id) + amount;
      const cost = Number(asset.acquisition_cost) || 0;
      const periodStart = `${period}-01`;
      const periodEnd = new Date(Number(period.split("-")[0]), Number(period.split("-")[1]), 0).toISOString().split("T")[0];
      const { error } = await supabase.from("fixed_asset_depreciation_schedules").insert({
        tenant_id: tenantId,
        asset_id: asset.id,
        period_start: periodStart,
        period_end: periodEnd,
        depreciation_amount: amount,
        tax_depreciation_amount: amount,
        accumulated_depreciation: accumulated,
        net_book_value: cost - accumulated,
        journal_entry_id: journalId,
        status: "posted",
        posted_at: new Date().toISOString(),
        posted_by: user.id,
      });
      if (error) throw error;

      await supabase.from("assets").update({ current_value: Number(asset.acquisition_cost) - accumulated }).eq("id", asset.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["depreciation-schedules", tenantId] });
      qc.invalidateQueries({ queryKey: ["depreciation-assets", tenantId] });
      qc.invalidateQueries({ queryKey: ["assets-stats", tenantId] });
      toast({ title: t("assetsDepPosted") });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  // Batch run for all eligible assets
  const batchMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) return 0;
      let count = 0;
      for (const asset of assets) {
        if (isPeriodDone(asset.id)) continue;
        if (calcMonthlyDepreciation(asset) <= 0) continue;
        await singleMutation.mutateAsync(asset);
        count++;
      }
      return count;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ["depreciation-schedules", tenantId] });
      toast({ title: `${count} ${t("assetsDepProcessed")}` });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("sr-Latn-RS", { style: "decimal", minimumFractionDigits: 2 }).format(val || 0);

  const totalPending = assets.filter((a: any) => !isPeriodDone(a.id) && calcMonthlyDepreciation(a) > 0).length;

  // ZPDPL group update
  const updateTaxGroup = async (assetId: string, group: string) => {
    const rate = ZPDPL_GROUPS.find((g: any) => g.value === group)?.rate || 10;
    const { error } = await supabase
      .from("fixed_asset_details")
      .update({ tax_group: group, tax_depreciation_rate: rate, tax_depreciation_method: "declining_balance" })
      .eq("asset_id", assetId);
    if (error) toast({ title: t("error"), description: error.message, variant: "destructive" });
    else {
      qc.invalidateQueries({ queryKey: ["depreciation-assets"] });
      qc.invalidateQueries({ queryKey: ["tax-depreciation"] });
      toast({ title: t("success") });
    }
  };

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">{t("assetsDepreciation")}</h1>
        <div className="flex gap-2 items-center">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => {
                const d = new Date();
                d.setMonth(d.getMonth() - i);
                const p = format(d, "yyyy-MM");
                return <SelectItem key={p} value={p}>{p}</SelectItem>;
              })}
            </SelectContent>
          </Select>
          {activeTab === "accounting" && (
            <Button onClick={() => batchMutation.mutate()} disabled={batchMutation.isPending || totalPending === 0}>
              <Play className="h-4 w-4 mr-1" /> {t("assetsRunBatch")} ({totalPending})
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("assetsTotalAssets")}</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{assets.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("assetsDepPending")}</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-amber-600">{totalPending}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("assetsDepCompleted")}</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-emerald-600">{assets.length - totalPending}</div></CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="accounting">Računovodstvena amortizacija</TabsTrigger>
          <TabsTrigger value="tax">ZPDPL Poreska amortizacija</TabsTrigger>
        </TabsList>

        <TabsContent value="accounting">
          <Card>
            <CardHeader><CardTitle>{t("assetsDepSchedule")} — {period}</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>
              ) : assets.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">{t("noResults")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                       <TableHead>{t("code")}</TableHead>
                      <TableHead>{t("name")}</TableHead>
                      <TableHead>{t("assetsDepreciationMethod")}</TableHead>
                      <TableHead className="text-right">{t("assetsAcquisitionCost")}</TableHead>
                      <TableHead className="text-right">{t("assetsAccumDep")}</TableHead>
                      <TableHead className="text-right">{t("bookValue")}</TableHead>
                      <TableHead className="text-right">{t("assetsMonthlyDep")}</TableHead>
                      <TableHead>{t("status")}</TableHead>
                      <TableHead>{t("actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assets.map((asset: any) => {
                      const accumulated = getAccumulated(asset.id);
                      const bv = Number(asset.acquisition_cost) - accumulated;
                      const monthly = calcMonthlyDepreciation(asset);
                      const done = isPeriodDone(asset.id);
                      const detail = Array.isArray(asset.fixed_asset_details) ? asset.fixed_asset_details[0] : asset.fixed_asset_details;
                      const method = detail?.depreciation_method || asset.asset_categories?.default_depreciation_method || "straight_line";

                      return (
                        <TableRow key={asset.id}>
                          <TableCell className="font-mono text-sm">{asset.asset_code}</TableCell>
                          <TableCell className="font-medium">{asset.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {method === "straight_line" ? t("assetsStraightLine") : t("assetsDecliningBalance")}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(asset.acquisition_cost)}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(accumulated)}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(bv)}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(monthly)}</TableCell>
                          <TableCell>
                            {done ? (
                              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                                <CheckCircle className="h-3 w-3 mr-1" /> {t("done")}
                              </Badge>
                            ) : monthly > 0 ? (
                              <Badge variant="outline" className="text-amber-600">{t("assetsDepPending")}</Badge>
                            ) : (
                              <Badge variant="secondary">{t("fullyDepreciated")}</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {!done && monthly > 0 && (
                              <Button variant="ghost" size="icon" onClick={() => singleMutation.mutate(asset)} disabled={singleMutation.isPending}>
                                <Calculator className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tax">
          <Card>
            <CardHeader><CardTitle>ZPDPL Poreska amortizacija — {period}</CardTitle></CardHeader>
            <CardContent>
              {taxDepData.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">{t("noResults")}</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Šifra</TableHead>
                        <TableHead>Naziv</TableHead>
                        <TableHead>ZPDPL Grupa</TableHead>
                        <TableHead className="text-right">Nabavna vrednost</TableHead>
                        <TableHead className="text-right">Stopa (%)</TableHead>
                        <TableHead className="text-right">Poreska amortizacija</TableHead>
                        <TableHead className="text-right">Računovodstvena</TableHead>
                        <TableHead className="text-right">Razlika</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {taxDepData.map((row: any) => (
                        <TableRow key={row.asset_id}>
                          <TableCell className="font-mono text-sm">{row.asset_code}</TableCell>
                          <TableCell className="font-medium">{row.asset_name}</TableCell>
                          <TableCell>
                            <Select value={row.tax_group || "II"} onValueChange={(v) => updateTaxGroup(row.asset_id, v)}>
                              <SelectTrigger className="w-[120px] h-8"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {ZPDPL_GROUPS.map((g: any) => (
                                  <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right font-mono">{fmtNum(Number(row.acquisition_cost))}</TableCell>
                          <TableCell className="text-right font-mono">{Number(row.tax_depreciation_rate).toFixed(1)}%</TableCell>
                          <TableCell className="text-right font-mono">{fmtNum(Number(row.period_tax_depreciation))}</TableCell>
                          <TableCell className="text-right font-mono">{fmtNum(Number(row.accounting_depreciation))}</TableCell>
                          <TableCell className={`text-right font-mono ${Number(row.difference) > 0 ? "text-emerald-600" : Number(row.difference) < 0 ? "text-destructive" : ""}`}>
                            {fmtNum(Number(row.difference))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}