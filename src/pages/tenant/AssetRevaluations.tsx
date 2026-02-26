import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { TrendingUp, TrendingDown, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { postWithRuleOrFallback } from "@/lib/postingHelper";

type EntryType = "revaluation" | "impairment";

interface EntryForm {
  asset_id: string;
  entry_date: string;
  new_value: number;
  reason: string;
}

export default function AssetRevaluations() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<EntryType>("revaluation");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<EntryType>("revaluation");
  const [form, setForm] = useState<EntryForm>({ asset_id: "", entry_date: new Date().toISOString().split("T")[0], new_value: 0, reason: "" });

  const { data: assets = [] } = useQuery({
    queryKey: ["reval-assets", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("assets")
        .select("id, name, asset_code, acquisition_cost, current_value")
        .eq("tenant_id", tenantId)
        .in("status", ["active", "in_use"])
        .in("asset_type", ["fixed_asset", "intangible"])
        .order("asset_code");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: revaluations = [] } = useQuery({
    queryKey: ["asset-revaluations", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("fixed_asset_revaluations")
        .select("*, assets(name, asset_code)")
        .eq("tenant_id", tenantId)
        .order("revaluation_date", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: impairments = [] } = useQuery({
    queryKey: ["asset-impairments", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("fixed_asset_impairments")
        .select("*, assets(name, asset_code)")
        .eq("tenant_id", tenantId)
        .order("impairment_date", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const openDialog = (type: EntryType) => {
    setDialogType(type);
    setForm({ asset_id: "", entry_date: new Date().toISOString().split("T")[0], new_value: 0, reason: "" });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !user) throw new Error("Missing context");
      const asset = assets.find((a: any) => a.id === form.asset_id);
      if (!asset) throw new Error("Asset not found");

      const oldValue = Number(asset.current_value) || Number(asset.acquisition_cost);
      const diff = form.new_value - oldValue;
      if (diff === 0) return;

      const isRevaluation = dialogType === "revaluation";
      const absAmount = Math.abs(diff);

      // Post journal entry
      let fallbackLines: any[];
      if (isRevaluation) {
        // MRS 16: Revaluation surplus to equity (3300) or reversal of prior impairment to P&L
        fallbackLines = diff > 0
          ? [
            { accountCode: "0120", debit: absAmount, credit: 0, description: `${t("assetsRevaluation" as any)} - ${asset.name}`, sortOrder: 0 },
            { accountCode: "3300", debit: 0, credit: absAmount, description: `${t("assetsRevalSurplus" as any)}`, sortOrder: 1 },
          ]
          : [
            { accountCode: "3300", debit: absAmount, credit: 0, description: `${t("assetsRevalDecrease" as any)}`, sortOrder: 0 },
            { accountCode: "0120", debit: 0, credit: absAmount, description: `${t("assetsRevaluation" as any)} - ${asset.name}`, sortOrder: 1 },
          ];
      } else {
        // MRS 36: Impairment loss to P&L (5800)
        fallbackLines = [
          { accountCode: "5800", debit: absAmount, credit: 0, description: `${t("assetsImpairmentLoss" as any)} - ${asset.name}`, sortOrder: 0 },
          { accountCode: "0120", debit: 0, credit: absAmount, description: `${t("assetsImpairment" as any)} - ${asset.name}`, sortOrder: 1 },
        ];
      }

      const journalId = await postWithRuleOrFallback({
        tenantId, userId: user.id, entryDate: form.entry_date,
        modelCode: isRevaluation ? "ASSET_REVALUATION" : "ASSET_IMPAIRMENT",
        amount: absAmount,
        description: `${isRevaluation ? t("assetsRevaluation" as any) : t("assetsImpairment" as any)} - ${asset.name}`,
        reference: `${isRevaluation ? "REVAL" : "IMP"}-${asset.asset_code}`,
        context: {},
        fallbackLines,
      });

      // Insert record
      if (isRevaluation) {
        await supabase.from("fixed_asset_revaluations").insert({
          tenant_id: tenantId,
          asset_id: asset.id,
          revaluation_date: form.entry_date,
          old_value: oldValue,
          new_value: form.new_value,
          revaluation_surplus: diff,
          reason: form.reason || null,
          journal_entry_id: journalId,
          created_by: user.id,
        });
      } else {
        await supabase.from("fixed_asset_impairments").insert({
          tenant_id: tenantId,
          asset_id: asset.id,
          impairment_date: form.entry_date,
          carrying_amount: oldValue,
          recoverable_amount: form.new_value,
          impairment_loss: absAmount,
          reason: form.reason || null,
          journal_entry_id: journalId,
          created_by: user.id,
        });
      }

      // Update asset current_value
      await supabase.from("assets").update({ current_value: form.new_value }).eq("id", asset.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["asset-revaluations", tenantId] });
      qc.invalidateQueries({ queryKey: ["asset-impairments", tenantId] });
      qc.invalidateQueries({ queryKey: ["reval-assets", tenantId] });
      toast({ title: dialogType === "revaluation" ? t("assetsRevalPosted" as any) : t("assetsImpairmentPosted" as any) });
      setDialogOpen(false);
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("sr-Latn-RS", { style: "decimal", minimumFractionDigits: 2 }).format(val || 0);

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("assetsRevalImpairment" as any)}</h1>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as EntryType)}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="revaluation"><TrendingUp className="h-4 w-4 mr-1" /> {t("assetsRevaluation" as any)}</TabsTrigger>
            <TabsTrigger value="impairment"><TrendingDown className="h-4 w-4 mr-1" /> {t("assetsImpairment" as any)}</TabsTrigger>
          </TabsList>
          <Button onClick={() => openDialog(tab)}>
            <Plus className="h-4 w-4 mr-1" /> {tab === "revaluation" ? t("assetsNewReval" as any) : t("assetsNewImpairment" as any)}
          </Button>
        </div>

        <TabsContent value="revaluation">
          <Card>
            <CardHeader><CardTitle>{t("assetsRevalHistory" as any)}</CardTitle></CardHeader>
            <CardContent>
              {revaluations.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">{t("noResults")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("code" as any)}</TableHead>
                      <TableHead>{t("name" as any)}</TableHead>
                      <TableHead>{t("date" as any)}</TableHead>
                      <TableHead className="text-right">{t("assetsOldValue" as any)}</TableHead>
                      <TableHead className="text-right">{t("assetsNewValue" as any)}</TableHead>
                      <TableHead className="text-right">{t("assetsRevalSurplus" as any)}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {revaluations.map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-sm">{r.assets?.asset_code}</TableCell>
                        <TableCell className="font-medium">{r.assets?.name}</TableCell>
                        <TableCell>{r.revaluation_date}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(r.old_value)}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(r.new_value)}</TableCell>
                        <TableCell className={`text-right font-mono ${Number(r.revaluation_surplus) >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                          {formatCurrency(r.revaluation_surplus)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="impairment">
          <Card>
            <CardHeader><CardTitle>{t("assetsImpairmentHistory" as any)}</CardTitle></CardHeader>
            <CardContent>
              {impairments.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">{t("noResults")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("code" as any)}</TableHead>
                      <TableHead>{t("name" as any)}</TableHead>
                      <TableHead>{t("date" as any)}</TableHead>
                      <TableHead className="text-right">{t("assetsOldValue" as any)}</TableHead>
                      <TableHead className="text-right">{t("assetsNewValue" as any)}</TableHead>
                      <TableHead className="text-right">{t("assetsImpairmentAmount" as any)}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {impairments.map((i: any) => (
                      <TableRow key={i.id}>
                        <TableCell className="font-mono text-sm">{i.assets?.asset_code}</TableCell>
                        <TableCell className="font-medium">{i.assets?.name}</TableCell>
                        <TableCell>{i.impairment_date}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(i.old_value)}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(i.new_value)}</TableCell>
                        <TableCell className="text-right font-mono text-destructive">{formatCurrency(i.impairment_amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogType === "revaluation" ? t("assetsNewReval" as any) : t("assetsNewImpairment" as any)}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>{t("assetsSelectAsset" as any)}</Label>
              <Select value={form.asset_id} onValueChange={(v) => {
                const asset = assets.find((a: any) => a.id === v);
                setForm({ ...form, asset_id: v, new_value: Number(asset?.current_value || asset?.acquisition_cost || 0) });
              }}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {assets.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>{a.asset_code} — {a.name} ({formatCurrency(a.current_value || a.acquisition_cost)})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("date" as any)}</Label>
                <Input type="date" value={form.entry_date} onChange={(e) => setForm({ ...form, entry_date: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>{t("assetsNewValue" as any)}</Label>
                <Input type="number" step="0.01" min={0} value={form.new_value} onChange={(e) => setForm({ ...form, new_value: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>{t("reason" as any)}</Label>
              <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.asset_id}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
