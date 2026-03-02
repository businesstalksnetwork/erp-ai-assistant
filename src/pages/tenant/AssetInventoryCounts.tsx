import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, ClipboardList, Eye } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface CountForm {
  count_number: string;
  count_date: string;
  year: number;
  description: string;
  asset_type_filter: string;
}

export default function AssetInventoryCounts() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const currentYear = new Date().getFullYear();
  const [form, setForm] = useState<CountForm>({
    count_number: "", count_date: new Date().toISOString().split("T")[0],
    year: currentYear, description: "", asset_type_filter: "",
  });

  const { data: counts = [], isLoading } = useQuery({
    queryKey: ["asset-inventory-counts", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("asset_inventory_counts")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("No tenant");

      let query = supabase.from("assets")
        .select("id, current_value, acquisition_cost")
        .eq("tenant_id", tenantId)
        .in("status", ["active", "in_use"]);
      
      if (form.asset_type_filter) {
        query = query.eq("asset_type", form.asset_type_filter);
      }
      const { data: assets } = await query;
      const assetList = assets || [];

      const { data: countData, error } = await supabase.from("asset_inventory_counts").insert({
        tenant_id: tenantId,
        count_number: form.count_number || `POP-${form.year}-${String(counts.length + 1).padStart(3, "0")}`,
        count_date: form.count_date,
        year: form.year,
        description: form.description || null,
        asset_type_filter: form.asset_type_filter || null,
        total_assets: assetList.length,
        created_by: user?.id,
        status: "draft",
      }).select("id").single();
      if (error) throw error;

      if (assetList.length > 0 && countData) {
        const items = assetList.map((a: any) => ({
          tenant_id: tenantId,
          count_id: countData.id,
          asset_id: a.id,
          expected: true,
          book_value: Number(a.current_value || a.acquisition_cost || 0),
          counted_value: Number(a.current_value || a.acquisition_cost || 0),
        }));
        const { error: itemError } = await supabase.from("asset_inventory_count_items").insert(items);
        if (itemError) throw itemError;
      }

      return countData?.id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["asset-inventory-counts", tenantId] });
      toast({ title: t("assetsCountCreated") });
      setDialogOpen(false);
      if (id) navigate(`/assets/inventory-count/${id}`);
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const statusColor = (s: string) => {
    if (s === "draft") return "bg-muted text-muted-foreground";
    if (s === "in_progress") return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
    if (s === "completed") return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    if (s === "posted") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
    return "";
  };

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">{t("assetsInventoryCount")}</h1>
        <Button onClick={() => {
          setForm({
            count_number: `POP-${currentYear}-${String(counts.length + 1).padStart(3, "0")}`,
            count_date: new Date().toISOString().split("T")[0],
            year: currentYear, description: "", asset_type_filter: "",
          });
          setDialogOpen(true);
        }}>
          <Plus className="h-4 w-4 mr-1" /> {t("assetsNewCount")}
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>{t("assetsCountList")}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>
          ) : counts.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">{t("noResults")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("assetsCountNumber")}</TableHead>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead>{t("year")}</TableHead>
                  <TableHead>{t("assetsTotalAssets")}</TableHead>
                  <TableHead>{t("assetsFound")}</TableHead>
                  <TableHead>{t("assetsMissing")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {counts.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono font-medium">{c.count_number}</TableCell>
                    <TableCell>{c.count_date}</TableCell>
                    <TableCell>{c.year}</TableCell>
                    <TableCell>{c.total_assets}</TableCell>
                    <TableCell className="text-emerald-600 font-medium">{c.found_count || 0}</TableCell>
                    <TableCell className="text-destructive font-medium">{c.missing_count || 0}</TableCell>
                    <TableCell><Badge className={statusColor(c.status)}>{t(`assetsCount${c.status.charAt(0).toUpperCase() + c.status.slice(1)}`) || c.status}</Badge></TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/assets/inventory-count/${c.id}`)}>
                        <Eye className="h-4 w-4 mr-1" /> {t("view")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("assetsNewCount")}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("assetsCountNumber")}</Label>
                <Input value={form.count_number} onChange={(e) => setForm({ ...form, count_number: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>{t("date")}</Label>
                <Input type="date" value={form.count_date} onChange={(e) => setForm({ ...form, count_date: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("year")}</Label>
                <Input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} />
              </div>
              <div className="grid gap-2">
                <Label>{t("assetsTypeFilter")}</Label>
                <Select value={form.asset_type_filter || "__all__"} onValueChange={(v) => setForm({ ...form, asset_type_filter: v === "__all__" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">{t("all")}</SelectItem>
                    <SelectItem value="fixed_asset">{t("assetsFixedAsset")}</SelectItem>
                    <SelectItem value="intangible">{t("assetsIntangible")}</SelectItem>
                    <SelectItem value="material_good">{t("assetsMaterialGood")}</SelectItem>
                    <SelectItem value="vehicle">{t("assetsVehicle")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>{t("description")}</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              <ClipboardList className="h-4 w-4 mr-1" /> {t("assetsStartCount")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
