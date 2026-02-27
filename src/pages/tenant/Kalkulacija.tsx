import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Search, Trash2, Calculator, Send } from "lucide-react";
import { fmtNum } from "@/lib/utils";
import { AiAnalyticsNarrative } from "@/components/ai/AiAnalyticsNarrative";

interface KalkulacijaItem {
  product_id: string;
  quantity: number;
  purchase_price: number;
  markup_percent: number;
  pdv_rate: number;
  retail_price: number;
}

function calcRetailPrice(purchasePrice: number, markupPercent: number, pdvRate: number) {
  const base = purchasePrice * (1 + markupPercent / 100);
  return Math.round(base * (1 + pdvRate / 100) * 100) / 100;
}

export default function Kalkulacija() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ warehouse_id: "", notes: "" });
  const [items, setItems] = useState<KalkulacijaItem[]>([]);

  const { data: kalkulacije = [] } = useQuery({
    queryKey: ["kalkulacije", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kalkulacije")
        .select("*, warehouses(name)")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses_active", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("warehouses").select("id, name").eq("tenant_id", tenantId!).eq("is_active", true);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products_list", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name, sku, default_purchase_price, default_sale_price").eq("tenant_id", tenantId!).eq("is_active", true);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const getNextNumber = () => {
    const nums = kalkulacije.map((k: any) => parseInt(k.kalkulacija_number?.replace(/\D/g, "") || "0"));
    const max = nums.length > 0 ? Math.max(...nums) : 0;
    return `KLK-${String(max + 1).padStart(4, "0")}`;
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: doc, error } = await supabase.from("kalkulacije").insert({
        tenant_id: tenantId!, kalkulacija_number: getNextNumber(),
        warehouse_id: form.warehouse_id || null, status: "draft",
        notes: form.notes, created_by: user?.id,
      }).select().single();
      if (error) throw error;
      if (items.length > 0) {
        const { error: itemsErr } = await supabase.from("kalkulacija_items").insert(
          items.filter(i => i.product_id && i.quantity > 0).map((i, idx) => ({
            kalkulacija_id: doc.id, product_id: i.product_id, quantity: i.quantity,
            purchase_price: i.purchase_price, markup_percent: i.markup_percent,
            pdv_rate: i.pdv_rate, retail_price: i.retail_price, sort_order: idx,
          }))
        );
        if (itemsErr) throw itemsErr;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["kalkulacije"] }); toast({ title: t("success") }); setDialogOpen(false); setItems([]); },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const postMutation = useMutation({
    mutationFn: async (id: string) => {
      // 1. Post the kalkulacija (inventory movement)
      const { data, error } = await supabase.rpc("post_kalkulacija", { p_kalkulacija_id: id });
      if (error) throw error;

      // 2. Fetch items for master data sync
      const { data: postedItems } = await supabase
        .from("kalkulacija_items")
        .select("product_id, quantity, purchase_price, retail_price")
        .eq("kalkulacija_id", id);

      // 3. Fetch kalkulacija header for warehouse_id
      const { data: kalDoc } = await supabase
        .from("kalkulacije")
        .select("warehouse_id, kalkulacija_number")
        .eq("id", id)
        .single();

      if (postedItems && postedItems.length > 0) {
        // 4. Insert purchase_prices history
        await supabase.from("purchase_prices").insert(
          postedItems.map(i => ({
            tenant_id: tenantId!,
            product_id: i.product_id,
            unit_cost: i.purchase_price,
            currency: "RSD",
            purchase_date: new Date().toISOString().slice(0, 10),
            quantity: i.quantity,
            document_ref: kalDoc?.kalkulacija_number || "",
            document_type: "kalkulacija" as const,
            document_id: id,
            warehouse_id: kalDoc?.warehouse_id || null,
          }))
        );

        // 5. Update product defaults
        for (const item of postedItems) {
          await supabase.from("products").update({
            default_purchase_price: item.purchase_price,
            default_retail_price: item.retail_price,
          }).eq("id", item.product_id);
        }

        // 6. Upsert retail_prices for default list
        const { data: defaultList } = await supabase
          .from("retail_price_lists")
          .select("id")
          .eq("tenant_id", tenantId!)
          .eq("is_default", true)
          .maybeSingle();

        if (defaultList) {
          for (const item of postedItems) {
            await supabase.from("retail_prices").upsert({
              tenant_id: tenantId!,
              price_list_id: defaultList.id,
              product_id: item.product_id,
              price: item.retail_price,
            }, { onConflict: "price_list_id,product_id" });
          }
        }
      }

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kalkulacije"] });
      qc.invalidateQueries({ queryKey: ["products_list"] });
      toast({ title: t("posted") || "Posted" });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const addItem = () => setItems(prev => [...prev, { product_id: "", quantity: 1, purchase_price: 0, markup_percent: 20, pdv_rate: 20, retail_price: 0 }]);
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const updateItem = (idx: number, field: keyof KalkulacijaItem, value: any) => {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const updated = { ...it, [field]: value };
      if (field === "product_id") {
        const p = products.find((pr: any) => pr.id === value);
        if (p) {
          updated.purchase_price = Number(p.default_purchase_price) || 0;
          updated.retail_price = calcRetailPrice(updated.purchase_price, updated.markup_percent, updated.pdv_rate);
        }
      }
      if (["purchase_price", "markup_percent", "pdv_rate"].includes(field)) {
        updated.retail_price = calcRetailPrice(updated.purchase_price, updated.markup_percent, updated.pdv_rate);
      }
      return updated;
    }));
  };

  const filtered = kalkulacije.filter((k: any) => k.kalkulacija_number?.toLowerCase().includes(search.toLowerCase()));


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("kalkulacija")}</h1>
        <Button onClick={() => { setDialogOpen(true); setItems([{ product_id: "", quantity: 1, purchase_price: 0, markup_percent: 20, pdv_rate: 20, retail_price: 0 }]); setForm({ warehouse_id: "", notes: "" }); }}>
          <Plus className="h-4 w-4 mr-2" />{t("add")}
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder={t("search")} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("invoiceNumber")}</TableHead>
                <TableHead>{t("date")}</TableHead>
                 <TableHead>{t("warehouse")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((k: any) => (
                <TableRow key={k.id}>
                  <TableCell className="font-medium">{k.kalkulacija_number}</TableCell>
                  <TableCell>{new Date(k.kalkulacija_date).toLocaleDateString("sr-RS")}</TableCell>
                  <TableCell>{(k.warehouses as any)?.name || "—"}</TableCell>
                  <TableCell><Badge variant={k.status === "posted" ? "default" : "secondary"}>{k.status}</Badge></TableCell>
                  <TableCell>
                    {k.status === "draft" && (
                      <Button size="sm" variant="outline" onClick={() => postMutation.mutate(k.id)} disabled={postMutation.isPending}>
                        <Send className="h-3 w-3 mr-1" />{t("save")}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("kalkulacija")}</DialogTitle>
            <DialogDescription>{t("kalkulacijaDesc")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t("warehouse")}</Label>
                <Select value={form.warehouse_id} onValueChange={v => setForm(f => ({ ...f, warehouse_id: v }))}>
                  <SelectTrigger><SelectValue placeholder={t("warehouse")} /></SelectTrigger>
                  <SelectContent>{warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>{t("notes")}</Label><Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t("lineItems")}</Label>
                <Button variant="outline" size="sm" onClick={addItem}><Plus className="h-3 w-3 mr-1" />{t("addLine")}</Button>
              </div>
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("product")}</TableHead>
                      <TableHead className="w-20">{t("quantity")}</TableHead>
                      <TableHead className="w-28">{t("purchasePrice")}</TableHead>
                      <TableHead className="w-24">{t("markupPercent")}</TableHead>
                      <TableHead className="w-20">PDV %</TableHead>
                      <TableHead className="w-28">{t("retailPrice")}</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <Select value={item.product_id} onValueChange={v => updateItem(idx, "product_id", v)}>
                            <SelectTrigger className="min-w-[180px]"><SelectValue placeholder={t("selectProduct")} /></SelectTrigger>
                            <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name} {p.sku ? `(${p.sku})` : ""}</SelectItem>)}</SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell><Input type="number" min={1} value={item.quantity} onChange={e => updateItem(idx, "quantity", Number(e.target.value))} /></TableCell>
                        <TableCell><Input type="number" step="0.01" value={item.purchase_price} onChange={e => updateItem(idx, "purchase_price", Number(e.target.value))} /></TableCell>
                        <TableCell><Input type="number" step="0.1" value={item.markup_percent} onChange={e => updateItem(idx, "markup_percent", Number(e.target.value))} /></TableCell>
                        <TableCell><Input type="number" value={item.pdv_rate} onChange={e => updateItem(idx, "pdv_rate", Number(e.target.value))} /></TableCell>
                        <TableCell className="font-semibold">{fmtNum(item.retail_price)}</TableCell>
                        <TableCell><Button variant="ghost" size="icon" onClick={() => removeItem(idx)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {items.length > 0 && (
                <Card className="bg-muted/30">
                  <CardContent className="p-3 flex justify-between text-sm">
                    <span>{t("totalPurchaseValue")}: <strong>{fmtNum(items.reduce((s, i) => s + i.purchase_price * i.quantity, 0))}</strong></span>
                    <span>{t("totalRetailValue")}: <strong>{fmtNum(items.reduce((s, i) => s + i.retail_price * i.quantity, 0))}</strong></span>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}><Calculator className="h-4 w-4 mr-2" />{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
