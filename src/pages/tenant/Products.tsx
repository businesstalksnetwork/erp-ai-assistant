import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { ExportButton } from "@/components/ExportButton";

const UOM_OPTIONS = ["pcs", "kg", "g", "l", "ml", "m", "cm", "m2", "m3", "h"];

interface ProductForm {
  name: string;
  name_sr: string;
  sku: string;
  barcode: string;
  description: string;
  unit_of_measure: string;
  default_purchase_price: number;
  default_sale_price: number;
  tax_rate_id: string;
  is_active: boolean;
  costing_method: string;
}

const emptyForm: ProductForm = {
  name: "", name_sr: "", sku: "", barcode: "", description: "",
  unit_of_measure: "pcs", default_purchase_price: 0, default_sale_price: 0,
  tax_rate_id: "", is_active: true, costing_method: "weighted_average",
};

export default function Products() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: taxRates = [] } = useQuery({
    queryKey: ["tax-rates", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tax_rates")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("is_active", true)
        .order("rate", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...form, tenant_id: tenantId! };
      if (editId) {
        const { error } = await supabase.from("products").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast({ title: t("success") });
      setDialogOpen(false);
    },
    onError: (err: any) => toast({ title: t("error"), description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast({ title: t("success") });
    },
    onError: (err: any) => toast({ title: t("error"), description: err.message, variant: "destructive" }),
  });

  const openNew = () => {
    setEditId(null);
    const defaultTax = taxRates.find((r) => r.is_default);
    setForm({ ...emptyForm, tax_rate_id: defaultTax?.id || "" });
    setDialogOpen(true);
  };

  const openEdit = (p: any) => {
    setEditId(p.id);
    setForm({
      name: p.name, name_sr: p.name_sr || "", sku: p.sku || "", barcode: p.barcode || "",
      description: p.description || "", unit_of_measure: p.unit_of_measure,
      default_purchase_price: Number(p.default_purchase_price),
      default_sale_price: Number(p.default_sale_price),
      tax_rate_id: p.tax_rate_id || "", is_active: p.is_active,
      costing_method: p.costing_method || "weighted_average",
    });
    setDialogOpen(true);
  };

  const filtered = products.filter((p) =>
    `${p.name} ${p.sku || ""} ${p.barcode || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  const fmtNum = (n: number) => n.toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("products")}</h1>
        <div className="flex gap-2">
          <ExportButton
            data={filtered}
            columns={[
              { key: "name", label: t("name") },
              { key: "sku", label: "SKU" },
              { key: "unit_of_measure", label: t("unitOfMeasure") },
              { key: "default_purchase_price", label: t("purchasePrice"), formatter: (v) => Number(v).toFixed(2) },
              { key: "default_sale_price", label: t("salePrice"), formatter: (v) => Number(v).toFixed(2) },
            ]}
            filename="products"
          />
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> {t("add")}</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("name")}</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>{t("unitOfMeasure")}</TableHead>
                <TableHead>{t("costingMethod")}</TableHead>
                <TableHead className="text-right">{t("purchasePrice")}</TableHead>
                <TableHead className="text-right">{t("salePrice")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead className="text-right">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium"><Link to={`/inventory/products/${p.id}`} className="text-primary hover:underline">{p.name}</Link></TableCell>
                  <TableCell>{p.sku || "—"}</TableCell>
                  <TableCell>{p.unit_of_measure}</TableCell>
                  <TableCell><Badge variant="outline">{p.costing_method === "fifo" ? t("fifo") : t("weightedAverage")}</Badge></TableCell>
                  <TableCell className="text-right font-mono">{fmtNum(Number(p.default_purchase_price))}</TableCell>
                  <TableCell className="text-right font-mono">{fmtNum(Number(p.default_sale_price))}</TableCell>
                  <TableCell>
                    <Badge variant={p.is_active ? "default" : "secondary"}>
                      {p.is_active ? t("active") : t("inactive")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t("confirm")}</AlertDialogTitle>
                          <AlertDialogDescription>{t("deleteConfirmation")}</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(p.id)}>{t("delete")}</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editId ? t("edit") : t("add")} {t("product")}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t("name")}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>{t("accountNameSr")}</Label><Input value={form.name_sr} onChange={(e) => setForm({ ...form, name_sr: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>SKU</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
              <div><Label>{t("barcode")}</Label><Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} /></div>
            </div>
            <div><Label>{t("description")}</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>{t("unitOfMeasure")}</Label>
                <Select value={form.unit_of_measure} onValueChange={(v) => setForm({ ...form, unit_of_measure: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{UOM_OPTIONS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>{t("purchasePrice")}</Label><Input type="number" min={0} step={0.01} value={form.default_purchase_price} onChange={(e) => setForm({ ...form, default_purchase_price: Number(e.target.value) })} /></div>
              <div><Label>{t("salePrice")}</Label><Input type="number" min={0} step={0.01} value={form.default_sale_price} onChange={(e) => setForm({ ...form, default_sale_price: Number(e.target.value) })} /></div>
            </div>
            <div>
              <Label>{t("taxRate")}</Label>
              <Select value={form.tax_rate_id} onValueChange={(v) => setForm({ ...form, tax_rate_id: v })}>
                <SelectTrigger><SelectValue placeholder={t("taxRate")} /></SelectTrigger>
                <SelectContent>
                  {taxRates.map((tr) => (
                    <SelectItem key={tr.id} value={tr.id}>{tr.name} ({Number(tr.rate)}%)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("costingMethod")}</Label>
              <Select value={form.costing_method} onValueChange={(v) => setForm({ ...form, costing_method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weighted_average">{t("weightedAverage")}</SelectItem>
                  <SelectItem value="fifo">{t("fifo")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.name || saveMutation.isPending}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
