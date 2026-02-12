import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { createCodeBasedJournalEntry } from "@/lib/journalUtils";

interface AssetForm {
  name: string;
  description: string;
  acquisition_date: string;
  acquisition_cost: number;
  depreciation_method: string;
  useful_life_months: number;
  salvage_value: number;
  status: string;
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
};

export default function FixedAssets() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const qc = useQueryClient();
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
      const payload = { ...form, tenant_id: tenantId };

      if (editId) {
        const { error } = await supabase.from("fixed_assets").update(payload).eq("id", editId);
        if (error) throw error;

        // Disposal journal entry when status changes to "disposed"
        if (previousStatus !== "disposed" && form.status === "disposed") {
          const accum = getAccumulated(editId);
          const cost = form.acquisition_cost;
          const bookValue = cost - accum;
          const entryDate = new Date().toISOString().split("T")[0];

          const lines: any[] = [];
          let sortOrder = 0;

          // Debit Accumulated Depreciation (clear it)
          if (accum > 0) {
            lines.push({ accountCode: "1290", debit: accum, credit: 0, description: `Clear accum. dep. - ${form.name}`, sortOrder: sortOrder++ });
          }

          // If book value > 0, it's a loss on disposal
          if (bookValue > 0) {
            lines.push({ accountCode: "8200", debit: bookValue, credit: 0, description: `Loss on disposal - ${form.name}`, sortOrder: sortOrder++ });
          }

          // Credit the asset at cost
          lines.push({ accountCode: "1200", debit: 0, credit: cost, description: `Remove asset - ${form.name}`, sortOrder: sortOrder++ });

          if (lines.length > 0) {
            await createCodeBasedJournalEntry({
              tenantId, userId: user?.id || null, entryDate,
              description: `Asset Disposal - ${form.name}`,
              reference: `DISP-${form.name}`,
              lines,
            });
          }

          // Update disposed_at
          await supabase.from("fixed_assets").update({ disposed_at: entryDate }).eq("id", editId);
        }
      } else {
        const { error } = await supabase.from("fixed_assets").insert(payload);
        if (error) throw error;
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

      // Create journal entry: Debit 8100 (Depreciation Expense) / Credit 1290 (Accumulated Depreciation)
      const journalId = await createCodeBasedJournalEntry({
        tenantId, userId: user?.id || null, entryDate,
        description: `Depreciation - ${asset.name} - ${period}`,
        reference: `DEP-${asset.name}-${period}`,
        lines: [
          { accountCode: "8100", debit: amount, credit: 0, description: `Depreciation expense - ${asset.name}`, sortOrder: 0 },
          { accountCode: "1290", debit: 0, credit: amount, description: `Accum. depreciation - ${asset.name}`, sortOrder: 1 },
        ],
      });

      // Create depreciation record with journal link
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

  const openAdd = () => { setEditId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (a: any) => {
    setEditId(a.id);
    setForm({ name: a.name, description: a.description || "", acquisition_date: a.acquisition_date, acquisition_cost: Number(a.acquisition_cost), depreciation_method: a.depreciation_method, useful_life_months: a.useful_life_months, salvage_value: Number(a.salvage_value), status: a.status });
    setDialogOpen(true);
  };

  const getAccumulated = (assetId: string) => depreciations.filter((d: any) => d.asset_id === assetId).reduce((s: number, d: any) => s + Number(d.amount), 0);

  const statusColor = (s: string) => s === "active" ? "default" as const : s === "disposed" ? "destructive" as const : "secondary" as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("fixedAssets")}</h1>
        <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4 mr-1" />{t("addAsset")}</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>{t("fixedAssets")}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">{t("loading")}</p>
          ) : assets.length === 0 ? (
            <p className="text-muted-foreground">{t("noResults")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("acquisitionDate")}</TableHead>
                  <TableHead>{t("acquisitionCost")}</TableHead>
                  <TableHead>{t("depreciationMethod")}</TableHead>
                  <TableHead>{t("usefulLife")}</TableHead>
                  <TableHead>{t("bookValue")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.map((a: any) => {
                  const accum = getAccumulated(a.id);
                  const bv = Number(a.acquisition_cost) - accum;
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell>{a.acquisition_date}</TableCell>
                      <TableCell>{Number(a.acquisition_cost).toLocaleString()} RSD</TableCell>
                      <TableCell>{a.depreciation_method === "straight_line" ? t("straightLine") : t("decliningBalance")}</TableCell>
                      <TableCell>{a.useful_life_months} {t("months")}</TableCell>
                      <TableCell>{bv.toLocaleString()} RSD</TableCell>
                      <TableCell><Badge variant={statusColor(a.status)}>{t(a.status)}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {a.status === "active" && (
                            <Button variant="ghost" size="icon" onClick={() => depreciationMutation.mutate(a)} title={t("runDepreciation")}>
                              <Play className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => openEdit(a)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(a.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("acquisitionDate")}</Label>
                <Input type="date" value={form.acquisition_date} onChange={(e) => setForm({ ...form, acquisition_date: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>{t("acquisitionCost")}</Label>
                <Input type="number" value={form.acquisition_cost} onChange={(e) => setForm({ ...form, acquisition_cost: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
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
            <div className="grid grid-cols-2 gap-4">
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
