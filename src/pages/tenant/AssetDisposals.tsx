import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { PageHeader } from "@/components/shared/PageHeader";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/shared/ResponsiveTable";

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
      if (accum > 0) lines.push({ accountCode: "0121", debit: accum, credit: 0, description: `${t("assetsAccumDep" as any)} - ${asset.name}`, sortOrder: sortOrder++ });
      if (form.disposal_type === "sold" && salePrice > 0) lines.push({ accountCode: "2431", debit: salePrice, credit: 0, description: `${t("assetsDisposalProceeds" as any)} - ${asset.name}`, sortOrder: sortOrder++ });
      lines.push({ accountCode: "0120", debit: 0, credit: cost, description: `${t("assetsRemoveAsset" as any)} - ${asset.name}`, sortOrder: sortOrder++ });
      if (gainLoss > 0) lines.push({ accountCode: "6072", debit: 0, credit: gainLoss, description: `${t("assetsGainOnDisposal" as any)}`, sortOrder: sortOrder++ });
      else if (gainLoss < 0) lines.push({ accountCode: "5073", debit: Math.abs(gainLoss), credit: 0, description: `${t("assetsLossOnDisposal" as any)}`, sortOrder: sortOrder++ });

      const journalId = await postWithRuleOrFallback({
        tenantId, userId: user.id, entryDate: form.disposal_date,
        modelCode: "ASSET_DISPOSAL", amount: cost,
        description: `${t("assetsDisposal" as any)} (${form.disposal_type}) - ${asset.name}`,
        reference: `DISP-${asset.asset_code}`, context: {}, fallbackLines: lines,
      });

      const { error } = await supabase.from("fixed_asset_disposals").insert({
        tenant_id: tenantId, asset_id: asset.id, disposal_type: form.disposal_type,
        disposal_date: form.disposal_date, disposal_amount: salePrice,
        net_book_value_at_disposal: bookValue, gain_loss: gainLoss,
        reason: form.reason || null, journal_entry_id: journalId, created_by: user.id,
      });
      if (error) throw error;
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

  const columns: ResponsiveColumn<any>[] = [
    { key: "code", label: t("code" as any), primary: true, sortable: true, sortValue: (d) => d.assets?.asset_code || "", render: (d) => <span className="font-mono text-sm">{d.assets?.asset_code}</span> },
    { key: "name", label: t("name" as any), sortable: true, sortValue: (d) => d.assets?.name || "", render: (d) => <span className="font-medium">{d.assets?.name}</span> },
    { key: "type", label: t("assetsDisposalType" as any), render: (d) => <Badge variant="outline">{t(`assets${d.disposal_type?.charAt(0).toUpperCase()}${d.disposal_type?.slice(1)}` as any) || d.disposal_type}</Badge> },
    { key: "date", label: t("date" as any), sortable: true, sortValue: (d) => d.disposal_date, render: (d) => d.disposal_date },
    { key: "book", label: t("bookValue" as any), align: "right" as const, sortable: true, sortValue: (d) => Number(d.net_book_value_at_disposal), render: (d) => <span className="font-mono">{formatCurrency(d.net_book_value_at_disposal)}</span> },
    { key: "sale", label: t("salePrice" as any), align: "right" as const, hideOnMobile: true, render: (d) => <span className="font-mono">{formatCurrency(d.disposal_amount)}</span> },
    {
      key: "gl", label: t("assetsGainLoss" as any), align: "right" as const, sortable: true, sortValue: (d) => Number(d.gain_loss),
      render: (d) => <span className={`font-mono ${Number(d.gain_loss) >= 0 ? "text-emerald-600" : "text-destructive"}`}>{formatCurrency(d.gain_loss)}</span>,
    },
    { key: "status", label: t("status"), render: (d) => <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">{d.status}</Badge> },
  ];

  if (isLoading) {
    return <div className="flex justify-center py-8"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="space-y-6 p-1">
      <PageHeader
        title={t("assetsDisposals" as any)}
        actions={
          <Button onClick={() => { setForm({ asset_id: "", disposal_type: "scrapped", disposal_date: new Date().toISOString().split("T")[0], sale_price: 0, reason: "" }); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> {t("assetsNewDisposal" as any)}
          </Button>
        }
      />

      <ResponsiveTable
        data={disposals}
        columns={columns}
        keyExtractor={(d) => d.id}
        emptyMessage={t("noResults")}
        enableExport
        exportFilename="asset-disposals"
      />

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
