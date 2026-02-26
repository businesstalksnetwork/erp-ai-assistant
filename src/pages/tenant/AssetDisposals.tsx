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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { postWithRuleOrFallback } from "@/lib/postingHelper";

interface DisposalForm {
  asset_id: string;
  disposal_type: string;
  disposal_date: string;
  sale_price: number;
  reason: string;
}

export default function AssetDisposals() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<DisposalForm>({ asset_id: "", disposal_type: "scrapped", disposal_date: new Date().toISOString().split("T")[0], sale_price: 0, reason: "" });

  const { data: assets = [] } = useQuery({
    queryKey: ["disposal-eligible-assets", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("assets")
        .select("id, name, asset_code, acquisition_cost, current_value, asset_type")
        .eq("tenant_id", tenantId)
        .in("status", ["active", "in_use"])
        .in("asset_type", ["fixed_asset", "intangible"])
        .order("asset_code");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: disposals = [], isLoading } = useQuery({
    queryKey: ["asset-disposals", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("fixed_asset_disposals")
        .select("*, assets(name, asset_code, acquisition_cost)")
        .eq("tenant_id", tenantId)
        .order("disposal_date", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Get accumulated depreciation for an asset
  const getAccumulated = async (assetId: string) => {
    const { data } = await supabase.from("fixed_asset_depreciation_schedules")
      .select("accounting_amount")
      .eq("asset_id", assetId)
      .eq("tenant_id", tenantId!);
    return (data || []).reduce((s: number, d: any) => s + Number(d.accounting_amount || 0), 0);
  };

  const disposeMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !user) throw new Error("Missing context");
      const asset = assets.find((a: any) => a.id === form.asset_id);
      if (!asset) throw new Error("Asset not found");

      const cost = Number(asset.acquisition_cost);
      const accum = await getAccumulated(asset.id);
      const bookValue = cost - accum;
      const salePrice = form.disposal_type === "sold" ? form.sale_price : 0;
      const gainLoss = salePrice - bookValue;

      const lines: any[] = [];
      let sortOrder = 0;

      // Debit Accumulated Depreciation
      if (accum > 0) {
        lines.push({ accountCode: "0121", debit: accum, credit: 0, description: `${t("assetsAccumDep" as any)} - ${asset.name}`, sortOrder: sortOrder++ });
      }
      // Debit Cash/Bank if sold
      if (form.disposal_type === "sold" && salePrice > 0) {
        lines.push({ accountCode: "2431", debit: salePrice, credit: 0, description: `${t("assetsDisposalProceeds" as any)} - ${asset.name}`, sortOrder: sortOrder++ });
      }
      // Credit Asset at cost
      lines.push({ accountCode: "0120", debit: 0, credit: cost, description: `${t("assetsRemoveAsset" as any)} - ${asset.name}`, sortOrder: sortOrder++ });
      // Gain or Loss
      if (gainLoss > 0) {
        lines.push({ accountCode: "6072", debit: 0, credit: gainLoss, description: `${t("assetsGainOnDisposal" as any)}`, sortOrder: sortOrder++ });
      } else if (gainLoss < 0) {
        lines.push({ accountCode: "5073", debit: Math.abs(gainLoss), credit: 0, description: `${t("assetsLossOnDisposal" as any)}`, sortOrder: sortOrder++ });
      }

      const journalId = await postWithRuleOrFallback({
        tenantId, userId: user.id, entryDate: form.disposal_date,
        modelCode: "ASSET_DISPOSAL", amount: cost,
        description: `${t("assetsDisposal" as any)} (${form.disposal_type}) - ${asset.name}`,
        reference: `DISP-${asset.asset_code}`,
        context: {},
        fallbackLines: lines,
      });

      // Create disposal record
      const { error } = await supabase.from("fixed_asset_disposals").insert({
        tenant_id: tenantId,
        asset_id: asset.id,
        disposal_type: form.disposal_type,
        disposal_date: form.disposal_date,
        disposal_amount: salePrice,
        net_book_value_at_disposal: bookValue,
        gain_loss: gainLoss,
        reason: form.reason || null,
        journal_entry_id: journalId,
        created_by: user.id,
      });
      if (error) throw error;

      // Update asset status
      await supabase.from("assets").update({ status: "disposed" }).eq("id", asset.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["asset-disposals", tenantId] });
      qc.invalidateQueries({ queryKey: ["disposal-eligible-assets", tenantId] });
      qc.invalidateQueries({ queryKey: ["assets-stats", tenantId] });
      toast({ title: t("assetsDisposalPosted" as any) });
      setDialogOpen(false);
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("sr-Latn-RS", { style: "decimal", minimumFractionDigits: 2 }).format(val || 0);

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("assetsDisposals" as any)}</h1>
        <Button onClick={() => { setForm({ asset_id: "", disposal_type: "scrapped", disposal_date: new Date().toISOString().split("T")[0], sale_price: 0, reason: "" }); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> {t("assetsNewDisposal" as any)}
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>{t("assetsDisposalHistory" as any)}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>
          ) : disposals.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">{t("noResults")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("code" as any)}</TableHead>
                  <TableHead>{t("name" as any)}</TableHead>
                  <TableHead>{t("assetsDisposalType" as any)}</TableHead>
                  <TableHead>{t("date" as any)}</TableHead>
                  <TableHead className="text-right">{t("bookValue" as any)}</TableHead>
                  <TableHead className="text-right">{t("salePrice" as any)}</TableHead>
                  <TableHead className="text-right">{t("assetsGainLoss" as any)}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {disposals.map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-sm">{d.assets?.asset_code}</TableCell>
                    <TableCell className="font-medium">{d.assets?.name}</TableCell>
                    <TableCell><Badge variant="outline">{t(`assets${d.disposal_type?.charAt(0).toUpperCase()}${d.disposal_type?.slice(1)}` as any) || d.disposal_type}</Badge></TableCell>
                    <TableCell>{d.disposal_date}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(d.net_book_value_at_disposal)}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(d.disposal_amount)}</TableCell>
                    <TableCell className={`text-right font-mono ${Number(d.gain_loss) >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                      {formatCurrency(d.gain_loss)}
                    </TableCell>
                    <TableCell><Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">{d.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("assetsNewDisposal" as any)}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>{t("assetsSelectAsset" as any)}</Label>
              <Select value={form.asset_id} onValueChange={(v) => setForm({ ...form, asset_id: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {assets.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>{a.asset_code} — {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("assetsDisposalType" as any)}</Label>
                <Select value={form.disposal_type} onValueChange={(v) => setForm({ ...form, disposal_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scrapped">{t("scrapped" as any)}</SelectItem>
                    <SelectItem value="sold">{t("sold" as any)}</SelectItem>
                    <SelectItem value="transferred">{t("transferred" as any)}</SelectItem>
                    <SelectItem value="written_off">{t("assetsWrittenOff" as any)}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{t("date" as any)}</Label>
                <Input type="date" value={form.disposal_date} onChange={(e) => setForm({ ...form, disposal_date: e.target.value })} />
              </div>
            </div>
            {form.disposal_type === "sold" && (
              <div className="grid gap-2">
                <Label>{t("salePrice" as any)}</Label>
                <Input type="number" step="0.01" min={0} value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: Number(e.target.value) })} />
              </div>
            )}
            <div className="grid gap-2">
              <Label>{t("assetsDisposalReason" as any)}</Label>
              <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("cancel")}</Button>
            <Button variant="destructive" onClick={() => disposeMutation.mutate()} disabled={disposeMutation.isPending || !form.asset_id}>
              <Trash2 className="h-4 w-4 mr-1" /> {t("assetsConfirmDisposal" as any)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
