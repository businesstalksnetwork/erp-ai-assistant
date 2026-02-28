import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface CategoryRow {
  id: string;
  code: string;
  code_prefix: string;
  name: string;
  name_sr: string | null;
  asset_type: string;
  default_useful_life_months: number | null;
  default_depreciation_method: string | null;
  is_active: boolean;
}

export default function AssetCategories() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [form, setForm] = useState({ code: "", code_prefix: "", name: "", name_sr: "", asset_type: "fixed_asset", default_useful_life_months: "", default_depreciation_method: "straight_line" });

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["asset-categories", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("asset_categories")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("sort_order");
      if (error) throw error;
      return data as CategoryRow[];
    },
    enabled: !!tenantId,
  });

  const openNew = () => {
    setEditing(null);
    setForm({ code: "", code_prefix: "", name: "", name_sr: "", asset_type: "fixed_asset", default_useful_life_months: "", default_depreciation_method: "straight_line" });
    setDialogOpen(true);
  };

  const openEdit = (cat: CategoryRow) => {
    setEditing(cat);
    setForm({
      code: cat.code,
      code_prefix: cat.code_prefix,
      name: cat.name,
      name_sr: cat.name_sr || "",
      asset_type: cat.asset_type,
      default_useful_life_months: cat.default_useful_life_months?.toString() || "",
      default_depreciation_method: cat.default_depreciation_method || "straight_line",
    });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("No tenant");
      const payload = {
        tenant_id: tenantId,
        code: form.code,
        code_prefix: form.code_prefix || form.code,
        name: form.name,
        name_sr: form.name_sr || form.name,
        asset_type: form.asset_type,
        default_useful_life_months: form.default_useful_life_months ? parseInt(form.default_useful_life_months) : null,
        default_depreciation_method: form.default_depreciation_method,
      };
      if (editing) {
        const { error } = await supabase.from("asset_categories").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("asset_categories").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(t("saved" as any));
      qc.invalidateQueries({ queryKey: ["asset-categories"] });
      setDialogOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("asset_categories").delete().eq("id", id).eq("tenant_id", tenantId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("deleted" as any));
      qc.invalidateQueries({ queryKey: ["asset-categories"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4 p-1">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("assetsCategories" as any)}</h1>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> {t("add" as any)}</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("code" as any)}</TableHead>
              <TableHead>{t("name" as any)}</TableHead>
              <TableHead>{t("type" as any)}</TableHead>
              <TableHead>{t("assetsUsefulLife" as any)}</TableHead>
              <TableHead>{t("assetsDepreciationMethod" as any)}</TableHead>
              <TableHead>{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((cat) => (
              <TableRow key={cat.id}>
                <TableCell className="font-mono">{cat.code}</TableCell>
                <TableCell>{cat.name}</TableCell>
                <TableCell><Badge variant="outline">{cat.asset_type}</Badge></TableCell>
                <TableCell>{cat.default_useful_life_months ? `${cat.default_useful_life_months} ${t("assetsMonths" as any)}` : "—"}</TableCell>
                <TableCell>{cat.default_depreciation_method || "—"}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(cat)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t("confirmDeleteRecord" as any)}</AlertDialogTitle>
                          <AlertDialogDescription>{cat.name}</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(cat.id)}>{t("delete" as any)}</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t("edit" as any) : t("add" as any)} {t("assetsCategory" as any)}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("code" as any)}</Label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              </div>
              <div>
                <Label>{t("assetsCodePrefix" as any)}</Label>
                <Input value={form.code_prefix} onChange={(e) => setForm({ ...form, code_prefix: e.target.value })} placeholder="e.g. EQUIP" />
              </div>
            </div>
            <div>
              <Label>{t("name" as any)}</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>{t("type" as any)}</Label>
              <Select value={form.asset_type} onValueChange={(v) => setForm({ ...form, asset_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed_asset">{t("assetsFixedAsset" as any)}</SelectItem>
                  <SelectItem value="intangible">{t("assetsIntangible" as any)}</SelectItem>
                  <SelectItem value="material_good">{t("assetsMaterialGood" as any)}</SelectItem>
                  <SelectItem value="vehicle">{t("assetsVehicle" as any)}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("assetsUsefulLife" as any)} ({t("assetsMonths" as any)})</Label>
                <Input type="number" value={form.default_useful_life_months} onChange={(e) => setForm({ ...form, default_useful_life_months: e.target.value })} />
              </div>
              <div>
                <Label>{t("assetsDepreciationMethod" as any)}</Label>
                <Select value={form.default_depreciation_method} onValueChange={(v) => setForm({ ...form, default_depreciation_method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="straight_line">{t("assetsStraightLine" as any)}</SelectItem>
                    <SelectItem value="declining_balance">{t("assetsDecliningBalance" as any)}</SelectItem>
                    <SelectItem value="units_of_production">{t("assetsUnitsOfProduction" as any)}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.code || !form.name}>
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
