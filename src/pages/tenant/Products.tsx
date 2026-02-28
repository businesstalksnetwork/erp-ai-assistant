import { useState, useMemo } from "react";
import { ActionGuard } from "@/components/ActionGuard";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search, Package } from "lucide-react";
import { ExportButton } from "@/components/ExportButton";
import { PageHeader } from "@/components/shared/PageHeader";
import { MobileFilterBar } from "@/components/shared/MobileFilterBar";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/shared/ResponsiveTable";
import { useDebounce } from "@/hooks/useDebounce";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";

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
  default_retail_price: number;
  default_web_price: number;
  tax_rate_id: string;
  is_active: boolean;
  costing_method: string;
  category_id: string;
}

const emptyForm: ProductForm = {
  name: "", name_sr: "", sku: "", barcode: "", description: "",
  unit_of_measure: "pcs", default_purchase_price: 0, default_sale_price: 0,
  default_retail_price: 0, default_web_price: 0,
  tax_rate_id: "", is_active: true, costing_method: "weighted_average",
  category_id: "",
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

  const debouncedSearch = useDebounce(search, 300);

  const { data: products = [], isLoading, page, setPage, hasMore } = usePaginatedQuery({
    queryKey: ["products", tenantId],
    queryFn: async ({ from, to }) => {
      const { data, error } = await supabase.from("products").select("*").eq("tenant_id", tenantId!).order("name").range(from, to);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: taxRates = [] } = useQuery({
    queryKey: ["tax-rates", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("tax_rates").select("*").eq("tenant_id", tenantId!).eq("is_active", true).order("rate", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["product_categories", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("product_categories" as any).select("id, name").eq("tenant_id", tenantId!).eq("is_active", true).order("name");
      return (data as any[]) || [];
    },
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = { ...form, tenant_id: tenantId!, category_id: form.category_id || null };
      if (editId) {
        const { error } = await supabase.from("products").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); toast({ title: t("success") }); setDialogOpen(false); },
    onError: (err: any) => toast({ title: t("error"), description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); toast({ title: t("success") }); },
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
      default_retail_price: Number(p.default_retail_price || 0),
      default_web_price: Number(p.default_web_price || 0),
      tax_rate_id: p.tax_rate_id || "", is_active: p.is_active,
      costing_method: p.costing_method || "weighted_average",
      category_id: p.category_id || "",
    });
    setDialogOpen(true);
  };

  const filtered = useMemo(() => products.filter((p) =>
    `${p.name} ${p.sku || ""} ${p.barcode || ""}`.toLowerCase().includes(debouncedSearch.toLowerCase())
  ), [products, debouncedSearch]);

  const fmtNum = (n: number) => n.toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const columns: ResponsiveColumn<any>[] = [
    { key: "name", label: t("name"), primary: true, render: (p) => <Link to={`/inventory/products/${p.id}`} className="text-primary hover:underline">{p.name}</Link> },
    { key: "sku", label: "SKU", render: (p) => p.sku || "—" },
    { key: "unit_of_measure", label: t("unitOfMeasure"), hideOnMobile: true, render: (p) => p.unit_of_measure },
    { key: "costing_method", label: t("costingMethod"), hideOnMobile: true, render: (p) => <Badge variant="outline">{p.costing_method === "fifo" ? t("fifo") : t("weightedAverage")}</Badge> },
    { key: "purchase_price", label: t("purchasePrice"), align: "right" as const, render: (p) => fmtNum(Number(p.default_purchase_price)) },
    { key: "sale_price", label: t("salePrice"), align: "right" as const, render: (p) => fmtNum(Number(p.default_sale_price)) },
    { key: "retail_price", label: t("retailPrice"), align: "right" as const, hideOnMobile: true, render: (p) => fmtNum(Number(p.default_retail_price || 0)) },
    { key: "web_price", label: t("webPrice"), align: "right" as const, hideOnMobile: true, render: (p) => fmtNum(Number(p.default_web_price || 0)) },
    { key: "status", label: t("status"), render: (p) => <Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? t("active") : t("inactive")}</Badge> },
    { key: "actions", label: t("actions"), showInCard: false, align: "right" as const, render: (p) => (
      <div className="flex gap-1 justify-end">
        <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(p); }}><Pencil className="h-4 w-4" /></Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="icon" variant="ghost" onClick={(e) => e.stopPropagation()}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
      </div>
    )},
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("products")}
        icon={Package}
        actions={
          <div className="flex gap-2">
            <ExportButton
              data={filtered}
              columns={[
                { key: "name", label: t("name") },
                { key: "sku", label: "SKU" },
                { key: "unit_of_measure", label: t("unitOfMeasure") },
                { key: "default_purchase_price", label: t("purchasePrice"), formatter: (v) => Number(v).toFixed(2) },
                 { key: "default_sale_price", label: t("salePrice"), formatter: (v) => Number(v).toFixed(2) },
                 { key: "default_retail_price", label: t("retailPrice"), formatter: (v) => Number(v).toFixed(2) },
                 { key: "default_web_price", label: t("webPrice"), formatter: (v) => Number(v).toFixed(2) },
              ]}
              filename="products"
            />
            <ActionGuard module="inventory" action="create">
              <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> {t("add")}</Button>
            </ActionGuard>
          </div>
        }
      />

      <MobileFilterBar
        search={
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        }
        filters={null}
      />

      <ResponsiveTable
        data={filtered}
        columns={columns}
        keyExtractor={(p) => p.id}
        emptyMessage={t("noResults")}
      />

      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious onClick={() => setPage(Math.max(0, page - 1))} className={page === 0 ? "pointer-events-none opacity-50" : "cursor-pointer"} />
          </PaginationItem>
          <PaginationItem>
            <span className="px-3 py-2 text-sm text-muted-foreground">{t("page")} {page + 1}</span>
          </PaginationItem>
          <PaginationItem>
            <PaginationNext onClick={() => hasMore && setPage(page + 1)} className={!hasMore ? "pointer-events-none opacity-50" : "cursor-pointer"} />
          </PaginationItem>
        </PaginationContent>
      </Pagination>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? t("edit") : t("add")} {t("product")}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>{t("name")}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>{t("accountNameSr")}</Label><Input value={form.name_sr} onChange={(e) => setForm({ ...form, name_sr: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>SKU</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
              <div><Label>{t("barcode")}</Label><Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} /></div>
            </div>
            <div><Label>{t("description")}</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div>
              <Label>{t("category")}</Label>
              <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder={t("category")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>{t("retailPrice")}</Label><Input type="number" min={0} step={0.01} value={form.default_retail_price} onChange={(e) => setForm({ ...form, default_retail_price: Number(e.target.value) })} /></div>
              <div><Label>{t("webPrice")}</Label><Input type="number" min={0} step={0.01} value={form.default_web_price} onChange={(e) => setForm({ ...form, default_web_price: Number(e.target.value) })} /></div>
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