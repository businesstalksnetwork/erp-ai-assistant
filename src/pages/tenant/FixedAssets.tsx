import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Play } from "lucide-react";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { postWithRuleOrFallback } from "@/lib/postingHelper";
import { useLegalEntities } from "@/hooks/useLegalEntities";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/shared/ResponsiveTable";

interface AssetForm {
  name: string;
  description: string;
  acquisition_date: string;
  acquisition_cost: number;
  depreciation_method: string;
  useful_life_months: number;
  salvage_value: number;
  status: string;
  disposal_type: string;
  sale_price: number;
  legal_entity_id: string;
}

const emptyForm: AssetForm = {
  name: "",
  description: "",
  acquisition_date: new Date().toISOString().split("T")[0],
  acquisition_cost: 0,
  depreciation_method: "straight_line",
  useful_life_months: 60,
  salvage_value: 0,
  status: "active",
  disposal_type: "",
  sale_price: 0,
  legal_entity_id: "",
};

export default function FixedAssets() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { entities } = useLegalEntities();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<AssetForm>(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ["fixed_assets", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase.from("fixed_assets").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: depreciations = [] } = useQuery({
    queryKey: ["fixed_asset_depreciation", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase.from("fixed_asset_depreciation").select("*").eq("tenant_id", tenantId).order("period", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) return;
      const previousStatus = editId ? assets.find((a: any) => a.id === editId)?.status : null;
      const payload = { ...form, tenant_id: tenantId, legal_entity_id: form.legal_entity_id || null };

      if (editId) {
        const { error } = await supabase.from("fixed_assets").update(payload).eq("id", editId);
        if (error) throw error;

        if (previousStatus !== "disposed" && form.status === "disposed") {
          const accum = getAccumulated(editId);
          const cost = form.acquisition_cost;
          const bookValue = cost - accum;
          const salePrice = form.disposal_type === "sold" ? form.sale_price : 0;
          const gainLoss = salePrice - bookValue;
          const entryDate = new Date().toISOString().split("T")[0];

          const lines: any[] = [];
          let sortOrder = 0;

          if (accum > 0) {
            lines.push({ accountCode: "0121", debit: accum, credit: 0, description: `Clear accum. dep. - ${form.name}`, sortOrder: sortOrder++ });
          }
          if (form.disposal_type === "sold" && salePrice > 0) {
            lines.push({ accountCode: "2431", debit: salePrice, credit: 0, description: `Sale proceeds - ${form.name}`, sortOrder: sortOrder++ });
          }
          lines.push({ accountCode: "0120", debit: 0, credit: cost, description: `Remove asset - ${form.name}`, sortOrder: sortOrder++ });
          if (gainLoss > 0) {
            lines.push({ accountCode: "6072", debit: 0, credit: gainLoss, description: `${t("gainOnDisposal")} - ${form.name}`, sortOrder: sortOrder++ });
          } else if (gainLoss < 0) {
            lines.push({ accountCode: "5073", debit: Math.abs(gainLoss), credit: 0, description: `${t("lossOnDisposal")} - ${form.name}`, sortOrder: sortOrder++ });
          }

          if (lines.length > 0) {
            await postWithRuleOrFallback({
              tenantId: tenantId!, userId: user?.id || null, entryDate,
              modelCode: "ASSET_DISPOSAL", amount: cost,
              description: `Asset Disposal (${form.disposal_type || "scrapped"}) - ${form.name}`,
              reference: `DISP-${form.name}`,
              context: {},
              fallbackLines: lines,
            });
          }

          await supabase.from("fixed_assets").update({ disposed_at: entryDate, disposal_type: form.disposal_type || "scrapped", sale_price: salePrice }).eq("id", editId);
        }
      } else {
        const { data: newAsset, error } = await supabase.from("fixed_assets").insert(payload).select("id").single();
        if (error) throw error;

        // ── P1-10: Create GL entry for asset acquisition ──
        if (form.acquisition_cost > 0) {
          const entryDate = form.acquisition_date || new Date().toISOString().split("T")[0];
          await postWithRuleOrFallback({
            tenantId: tenantId!, userId: user?.id || null, entryDate,
            modelCode: "ASSET_ACQUISITION", amount: form.acquisition_cost,
            description: `Asset Acquisition - ${form.name}`,
            reference: `ACQ-${newAsset.id.slice(0, 8)}`,
            context: {},
            fallbackLines: [
              { accountCode: "0230", debit: form.acquisition_cost, credit: 0, description: `Osnovno sredstvo - ${form.name}`, sortOrder: 1 },
              { accountCode: "4310", debit: 0, credit: form.acquisition_cost, description: `Obaveze prema dobavljačima - ${form.name}`, sortOrder: 2 },
            ],
          });
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fixed_assets", tenantId] });
      toast({ title: t("assetSaved") });
      setDialogOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fixed_assets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fixed_assets", tenantId] });
      toast({ title: t("assetDeleted") });
      setDeleteId(null);
    },
  });

  const depreciationMutation = useMutation({
    mutationFn: async (asset: any) => {
      if (!tenantId) return;
      const cost = Number(asset.acquisition_cost);
      const salvage = Number(asset.salvage_value);
      const lifeMonths = asset.useful_life_months;
      const assetDepreciations = depreciations.filter((d: any) => d.asset_id === asset.id);
      const accumulated = assetDepreciations.reduce((s: number, d: any) => s + Number(d.amount), 0);
      const bookValue = cost - accumulated;

      let amount: number;
      if (asset.depreciation_method === "straight_line") {
        amount = (cost - salvage) / lifeMonths;
      } else {
        const annualRate = 2 / (lifeMonths / 12);
        amount = (bookValue * annualRate) / 12;
      }
      amount = Math.min(amount, bookValue - salvage);
      if (amount <= 0) return;

      const period = format(new Date(), "yyyy-MM");
      const entryDate = new Date().toISOString().split("T")[0];

      const journalId = await postWithRuleOrFallback({
        tenantId: tenantId!, userId: user?.id || null, entryDate,
        modelCode: "ASSET_DEPRECIATION", amount,
        description: `Depreciation - ${asset.name} - ${period}`,
        reference: `DEP-${asset.name}-${period}`,
        context: {},
        fallbackLines: [
          { accountCode: "5310", debit: amount, credit: 0, description: `Depreciation expense - ${asset.name}`, sortOrder: 0 },
          { accountCode: "0121", debit: 0, credit: amount, description: `Accum. depreciation - ${asset.name}`, sortOrder: 1 },
        ],
      });

      const { error } = await supabase.from("fixed_asset_depreciation").insert({
        tenant_id: tenantId,
        asset_id: asset.id,
        period,
        amount,
        accumulated_total: accumulated + amount,
        journal_entry_id: journalId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fixed_asset_depreciation", tenantId] });
      toast({ title: t("depreciationPosted" as any) || t("depreciationRun") });
    },
  });

  const batchDepreciationMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) return 0;
      const currentPeriod = format(new Date(), "yyyy-MM");
      const activeAssets = assets.filter((a: any) => a.status === "active");
      let processed = 0;
      for (const asset of activeAssets) {
        const alreadyDone = depreciations.some((d: any) => d.asset_id === asset.id && d.period === currentPeriod);
        if (alreadyDone) continue;
        const accum = getAccumulated(asset.id);
        const bv = Number(asset.acquisition_cost) - accum;
        if (bv <= Number(asset.salvage_value)) continue;
        await depreciationMutation.mutateAsync(asset);
        processed++;
      }
      return processed;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ["fixed_asset_depreciation", tenantId] });
      toast({ title: `${count} ${t("depreciationRun")}` });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const openAdd = () => { setEditId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (a: any) => {
    setEditId(a.id);
    setForm({ name: a.name, description: a.description || "", acquisition_date: a.acquisition_date, acquisition_cost: Number(a.acquisition_cost), depreciation_method: a.depreciation_method, useful_life_months: a.useful_life_months, salvage_value: Number(a.salvage_value), status: a.status, disposal_type: a.disposal_type || "", sale_price: Number(a.sale_price || 0), legal_entity_id: a.legal_entity_id || "" });
    setDialogOpen(true);
  };

  const getAccumulated = (assetId: string) => depreciations.filter((d: any) => d.asset_id === assetId).reduce((s: number, d: any) => s + Number(d.amount), 0);

  const statusColor = (s: string) => s === "active" ? "default" as const : s === "disposed" ? "destructive" as const : "secondary" as const;

  const columns: ResponsiveColumn<any>[] = [
    { key: "name", label: t("name"), primary: true, sortable: true, sortValue: (a) => a.name, render: (a) => <span className="font-medium">{a.name}</span> },
    { key: "acqDate", label: t("acquisitionDate"), sortable: true, sortValue: (a) => a.acquisition_date, render: (a) => a.acquisition_date },
    { key: "acqCost", label: t("acquisitionCost"), align: "right" as const, sortable: true, sortValue: (a) => Number(a.acquisition_cost), render: (a) => `${Number(a.acquisition_cost).toLocaleString()} RSD` },
    { key: "method", label: t("depreciationMethod"), hideOnMobile: true, render: (a) => a.depreciation_method === "straight_line" ? t("straightLine") : t("decliningBalance") },
    { key: "life", label: t("usefulLife"), hideOnMobile: true, render: (a) => `${a.useful_life_months} ${t("months")}` },
    { key: "bookValue", label: t("bookValue"), align: "right" as const, sortable: true, sortValue: (a) => Number(a.acquisition_cost) - getAccumulated(a.id), render: (a) => `${(Number(a.acquisition_cost) - getAccumulated(a.id)).toLocaleString()} RSD` },
    { key: "depRun", label: t("depreciationRun"), hideOnMobile: true, render: (a) => {
      const currentPeriod = format(new Date(), "yyyy-MM");
      const done = depreciations.some((d: any) => d.asset_id === a.id && d.period === currentPeriod);
      return done ? <Badge variant="default">✓</Badge> : <Badge variant="outline">—</Badge>;
    }},
    { key: "status", label: t("status"), sortable: true, sortValue: (a) => a.status, render: (a) => <Badge variant={statusColor(a.status)}>{t(a.status)}</Badge> },
    { key: "actions", label: t("actions"), render: (a) => (
      <div className="flex gap-1">
        {a.status === "active" && (
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); depreciationMutation.mutate(a); }} title={t("runDepreciation")}>
            <Play className="h-4 w-4" />
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEdit(a); }}><Pencil className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setDeleteId(a.id); }}><Trash2 className="h-4 w-4" /></Button>
      </div>
    )},
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("fixedAssets")}</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => batchDepreciationMutation.mutate()} disabled={batchDepreciationMutation.isPending}>
            <Play className="h-4 w-4 mr-1" />{t("depreciationRun")}
          </Button>
          <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4 mr-1" />{t("addAsset")}</Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">{t("loading")}</p>
      ) : (
        <ResponsiveTable
          data={assets}
          columns={columns}
          keyExtractor={(a) => a.id}
          emptyMessage={t("noResults")}
          enableExport
          exportFilename="fixed-assets"
          enableColumnToggle
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? t("editAsset") : t("addAsset")}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>{t("name")}</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>{t("description")}</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("acquisitionDate")}</Label>
                <Input type="date" value={form.acquisition_date} onChange={(e) => setForm({ ...form, acquisition_date: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>{t("acquisitionCost")}</Label>
                <Input type="number" value={form.acquisition_cost} onChange={(e) => setForm({ ...form, acquisition_cost: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("depreciationMethod")}</Label>
                <Select value={form.depreciation_method} onValueChange={(v) => setForm({ ...form, depreciation_method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="straight_line">{t("straightLine")}</SelectItem>
                    <SelectItem value="declining_balance">{t("decliningBalance")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{t("usefulLife")} ({t("months")})</Label>
                <Input type="number" value={form.useful_life_months} onChange={(e) => setForm({ ...form, useful_life_months: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("salvageValue")}</Label>
                <Input type="number" value={form.salvage_value} onChange={(e) => setForm({ ...form, salvage_value: Number(e.target.value) })} />
              </div>
              <div className="grid gap-2">
                <Label>{t("status")}</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t("active")}</SelectItem>
                    <SelectItem value="disposed">{t("disposed")}</SelectItem>
                    <SelectItem value="fully_depreciated">{t("fullyDepreciated")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.status === "disposed" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>{t("disposalType")}</Label>
                  <Select value={form.disposal_type} onValueChange={(v) => setForm({ ...form, disposal_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sold">{t("sold")}</SelectItem>
                      <SelectItem value="scrapped">{t("scrapped")}</SelectItem>
                      <SelectItem value="donated">{t("donated" as any)}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.disposal_type === "sold" && (
                  <div className="grid gap-2">
                    <Label>{t("salePrice")}</Label>
                    <Input type="number" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: Number(e.target.value) })} />
                  </div>
                )}
              </div>
            )}
            {entities.length > 1 && (
              <div className="grid gap-2">
                <Label>{t("legalEntity")}</Label>
                <Select value={form.legal_entity_id} onValueChange={(v) => setForm({ ...form, legal_entity_id: v })}>
                  <SelectTrigger><SelectValue placeholder={t("selectLegalEntity")} /></SelectTrigger>
                  <SelectContent>
                    {entities.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmation")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteConfirmation")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>{t("delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
