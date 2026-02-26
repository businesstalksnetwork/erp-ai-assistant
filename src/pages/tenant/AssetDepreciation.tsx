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
import { Play, CheckCircle, Calculator } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { postWithRuleOrFallback } from "@/lib/postingHelper";

export default function AssetDepreciation() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [period, setPeriod] = useState(format(new Date(), "yyyy-MM"));

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
        description: `${t("assetsDepreciation" as any)} - ${asset.name} - ${period}`,
        reference: `DEP-${asset.asset_code}-${period}`,
        context: {},
        fallbackLines: [
          { accountCode: expenseAccount, debit: amount, credit: 0, description: `${t("assetsDepExpense" as any)} - ${asset.name}`, sortOrder: 0 },
          { accountCode: accumAccount, debit: 0, credit: amount, description: `${t("assetsAccumDep" as any)} - ${asset.name}`, sortOrder: 1 },
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

      // Update current_value on asset
      await supabase.from("assets").update({ current_value: Number(asset.acquisition_cost) - accumulated }).eq("id", asset.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["depreciation-schedules", tenantId] });
      qc.invalidateQueries({ queryKey: ["depreciation-assets", tenantId] });
      qc.invalidateQueries({ queryKey: ["assets-stats", tenantId] });
      toast({ title: t("assetsDepPosted" as any) });
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
      toast({ title: `${count} ${t("assetsDepProcessed" as any)}` });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("sr-Latn-RS", { style: "decimal", minimumFractionDigits: 2 }).format(val || 0);

  const totalPending = assets.filter((a: any) => !isPeriodDone(a.id) && calcMonthlyDepreciation(a) > 0).length;

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">{t("assetsDepreciation" as any)}</h1>
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
          <Button onClick={() => batchMutation.mutate()} disabled={batchMutation.isPending || totalPending === 0}>
            <Play className="h-4 w-4 mr-1" /> {t("assetsRunBatch" as any)} ({totalPending})
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("assetsTotalAssets" as any)}</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{assets.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("assetsDepPending" as any)}</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-amber-600">{totalPending}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("assetsDepCompleted" as any)}</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-emerald-600">{assets.length - totalPending}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>{t("assetsDepSchedule" as any)} — {period}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>
          ) : assets.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">{t("noResults")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("code" as any)}</TableHead>
                  <TableHead>{t("name" as any)}</TableHead>
                  <TableHead>{t("assetsDepreciationMethod" as any)}</TableHead>
                  <TableHead className="text-right">{t("assetsAcquisitionCost" as any)}</TableHead>
                  <TableHead className="text-right">{t("assetsAccumDep" as any)}</TableHead>
                  <TableHead className="text-right">{t("bookValue" as any)}</TableHead>
                  <TableHead className="text-right">{t("assetsMonthlyDep" as any)}</TableHead>
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
                          {method === "straight_line" ? t("assetsStraightLine" as any) : t("assetsDecliningBalance" as any)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(asset.acquisition_cost)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(accumulated)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(bv)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(monthly)}</TableCell>
                      <TableCell>
                        {done ? (
                          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                            <CheckCircle className="h-3 w-3 mr-1" /> {t("done" as any)}
                          </Badge>
                        ) : monthly > 0 ? (
                          <Badge variant="outline" className="text-amber-600">{t("assetsDepPending" as any)}</Badge>
                        ) : (
                          <Badge variant="secondary">{t("fullyDepreciated" as any)}</Badge>
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
    </div>
  );
}
