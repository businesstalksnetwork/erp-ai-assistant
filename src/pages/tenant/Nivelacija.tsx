import { useState, useEffect } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useLegalEntities } from "@/hooks/useLegalEntities";
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
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Search, Trash2, TrendingUp, TrendingDown, Send } from "lucide-react";
import { fmtNum } from "@/lib/utils";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/shared/ResponsiveTable";

interface NivelacijaItem {
  product_id: string;
  old_retail_price: number;
  new_retail_price: number;
  quantity_on_hand: number;
  pdv_rate: number;
}

export default function Nivelacija() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { entities: legalEntities } = useLegalEntities();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ warehouse_id: "", notes: "", location_id: "", legal_entity_id: "" });
  const [items, setItems] = useState<NivelacijaItem[]>([]);

  // Location's price list ID for prefilling old prices
  const [locationPriceListId, setLocationPriceListId] = useState<string | null>(null);
  const [locationPrices, setLocationPrices] = useState<Record<string, number>>({});

  const { data: nivelacije = [] } = useQuery({
    queryKey: ["nivelacije", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nivelacije")
        .select("*, warehouses(name), locations(name)")
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

  const { data: locations = [] } = useQuery({
    queryKey: ["locations_active", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("locations").select("id, name, type").eq("tenant_id", tenantId!).eq("is_active", true);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products_list", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name, sku, default_retail_price").eq("tenant_id", tenantId!).eq("is_active", true);
      return data || [];
    },
    enabled: !!tenantId,
  });

  // When location changes, fetch its price list and prices
  useEffect(() => {
    if (!form.location_id || !tenantId) {
      setLocationPriceListId(null);
      setLocationPrices({});
      return;
    }

    const fetchPrices = async () => {
      // Try location-specific list first
      let { data: locList } = await supabase
        .from("retail_price_lists")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("location_id", form.location_id)
        .eq("is_active", true)
        .maybeSingle();

      // Fallback to default
      if (!locList) {
        const { data: defList } = await supabase
          .from("retail_price_lists")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("is_default", true)
          .maybeSingle();
        locList = defList;
      }

      if (locList) {
        setLocationPriceListId(locList.id);
        const { data: prices } = await supabase
          .from("retail_prices")
          .select("product_id, retail_price")
          .eq("price_list_id", locList.id);
        const priceMap: Record<string, number> = {};
        prices?.forEach(p => { priceMap[p.product_id] = Number(p.retail_price); });
        setLocationPrices(priceMap);
      } else {
        setLocationPriceListId(null);
        setLocationPrices({});
      }
    };

    fetchPrices();
  }, [form.location_id, tenantId]);

  const getNextNumber = () => {
    const nums = nivelacije.map((n: any) => parseInt(n.nivelacija_number?.replace(/\D/g, "") || "0"));
    const max = nums.length > 0 ? Math.max(...nums) : 0;
    return `NIV-${String(max + 1).padStart(4, "0")}`;
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.location_id) throw new Error(t("selectLocation"));
      if (!form.legal_entity_id) throw new Error(t("selectLegalEntity"));

      const { data: doc, error } = await supabase.from("nivelacije").insert({
        tenant_id: tenantId!, nivelacija_number: getNextNumber(),
        warehouse_id: form.warehouse_id || null, status: "draft",
        notes: form.notes, created_by: user?.id,
        location_id: form.location_id, legal_entity_id: form.legal_entity_id,
      }).select().single();
      if (error) throw error;
      if (items.length > 0) {
        const { error: itemsErr } = await supabase.from("nivelacija_items").insert(
          items.filter(i => i.product_id).map((i, idx) => ({
            nivelacija_id: doc.id, product_id: i.product_id,
            old_retail_price: i.old_retail_price, new_retail_price: i.new_retail_price,
            quantity_on_hand: i.quantity_on_hand,
            price_difference: (i.new_retail_price - i.old_retail_price) * i.quantity_on_hand,
            pdv_rate: i.pdv_rate,
            sort_order: idx,
          }))
        );
        if (itemsErr) throw itemsErr;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["nivelacije"] }); toast({ title: t("success") }); setDialogOpen(false); setItems([]); },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const postMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("post_nivelacija", { p_nivelacija_id: id });
      if (error) throw error;

      const { data: postedItems } = await supabase
        .from("nivelacija_items")
        .select("product_id, new_retail_price")
        .eq("nivelacija_id", id);

      const { data: nivDoc } = await supabase
        .from("nivelacije")
        .select("location_id")
        .eq("id", id)
        .single();

      if (postedItems && postedItems.length > 0) {
        // Update products.default_retail_price
        for (const item of postedItems) {
          await supabase.from("products").update({
            default_retail_price: item.new_retail_price,
          }).eq("id", item.product_id);
        }

        // Upsert retail_prices for location's price list
        let priceListId: string | null = null;

        if (nivDoc?.location_id) {
          const { data: locList } = await supabase
            .from("retail_price_lists")
            .select("id")
            .eq("tenant_id", tenantId!)
            .eq("location_id", nivDoc.location_id)
            .eq("is_active", true)
            .maybeSingle();
          priceListId = locList?.id || null;
        }

        if (!priceListId) {
          const { data: defaultList } = await supabase
            .from("retail_price_lists")
            .select("id")
            .eq("tenant_id", tenantId!)
            .eq("is_default", true)
            .maybeSingle();
          priceListId = defaultList?.id || null;
        }

        if (priceListId) {
          for (const item of postedItems) {
            await supabase.from("retail_prices").upsert({
              price_list_id: priceListId,
              product_id: item.product_id,
              retail_price: item.new_retail_price,
            }, { onConflict: "price_list_id,product_id" });
          }
        }
      }

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nivelacije"] });
      qc.invalidateQueries({ queryKey: ["products_list"] });
      toast({ title: t("posted") || "Posted" });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const addItem = () => setItems(prev => [...prev, { product_id: "", old_retail_price: 0, new_retail_price: 0, quantity_on_hand: 0, pdv_rate: 20 }]);
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const updateItem = (idx: number, field: keyof NivelacijaItem, value: any) => {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const updated = { ...it, [field]: value };
      if (field === "product_id") {
        // Prefill old_retail_price from location's price list, fallback to product default
        const locPrice = locationPrices[value];
        if (locPrice !== undefined) {
          updated.old_retail_price = locPrice;
        } else {
          const p = products.find((pr: any) => pr.id === value);
          if (p) updated.old_retail_price = Number(p.default_retail_price) || 0;
        }

        // Auto-fetch quantity from inventory_stock if warehouse selected
        if (form.warehouse_id && value) {
          supabase.from("inventory_stock")
            .select("quantity_on_hand")
            .eq("warehouse_id", form.warehouse_id)
            .eq("product_id", value)
            .maybeSingle()
            .then(({ data: stock }) => {
              if (stock) {
                setItems(prev2 => prev2.map((it2, i2) =>
                  i2 === idx ? { ...it2, quantity_on_hand: Number(stock.quantity_on_hand) || 0 } : it2
                ));
              }
            });
        }
      }
      return updated;
    }));
  };

  const filtered = nivelacije.filter((n: any) => n.nivelacija_number?.toLowerCase().includes(search.toLowerCase()));
  const totalDiff = items.reduce((s, i) => s + (i.new_retail_price - i.old_retail_price) * i.quantity_on_hand, 0);

  const columns: ResponsiveColumn<any>[] = [
    { key: "number", label: t("invoiceNumber"), primary: true, sortable: true, sortValue: (n) => n.nivelacija_number, render: (n) => <span className="font-medium">{n.nivelacija_number}</span> },
    { key: "date", label: t("date"), sortable: true, sortValue: (n) => n.nivelacija_date, render: (n) => new Date(n.nivelacija_date).toLocaleDateString("sr-RS") },
    { key: "location", label: t("location"), hideOnMobile: true, render: (n) => (n.locations as any)?.name || "—" },
    { key: "warehouse", label: t("warehouse"), hideOnMobile: true, render: (n) => (n.warehouses as any)?.name || "—" },
    { key: "status", label: t("status"), sortable: true, sortValue: (n) => n.status, render: (n) => <Badge variant={n.status === "posted" ? "default" : "secondary"}>{n.status}</Badge> },
    { key: "actions", label: t("actions"), render: (n) => (
      n.status === "draft" ? (
        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); postMutation.mutate(n.id); }} disabled={postMutation.isPending}>
          <Send className="h-3 w-3 mr-1" />{t("save")}
        </Button>
      ) : null
    )},
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("nivelacija")}</h1>
        <Button onClick={() => { setDialogOpen(true); setItems([{ product_id: "", old_retail_price: 0, new_retail_price: 0, quantity_on_hand: 0, pdv_rate: 20 }]); setForm({ warehouse_id: "", notes: "", location_id: "", legal_entity_id: "" }); }}>
          <Plus className="h-4 w-4 mr-2" />{t("add")}
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder={t("search")} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <ResponsiveTable
        data={filtered}
        columns={columns}
        keyExtractor={(n) => n.id}
        emptyMessage={t("noResults")}
        enableExport
        exportFilename="nivelacije"
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("nivelacija")}</DialogTitle>
            <DialogDescription>{t("nivelacijaDesc")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("location")} *</Label>
                <Select value={form.location_id} onValueChange={v => setForm(f => ({ ...f, location_id: v }))}>
                  <SelectTrigger><SelectValue placeholder={t("selectLocation")} /></SelectTrigger>
                  <SelectContent>{locations.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("legalEntity")} *</Label>
                <Select value={form.legal_entity_id} onValueChange={v => setForm(f => ({ ...f, legal_entity_id: v }))}>
                  <SelectTrigger><SelectValue placeholder={t("selectLegalEntity")} /></SelectTrigger>
                  <SelectContent>{legalEntities.map((le: any) => <SelectItem key={le.id} value={le.id}>{le.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
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
                      <TableHead className="w-28">{t("oldPrice")}</TableHead>
                      <TableHead className="w-28">{t("newPrice")}</TableHead>
                      <TableHead className="w-20">{t("quantity")}</TableHead>
                      <TableHead className="w-28">{t("difference")}</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, idx) => {
                      const diff = (item.new_retail_price - item.old_retail_price) * item.quantity_on_hand;
                      return (
                        <TableRow key={idx}>
                          <TableCell>
                            <Select value={item.product_id} onValueChange={v => updateItem(idx, "product_id", v)}>
                              <SelectTrigger className="min-w-[180px]"><SelectValue placeholder={t("selectProduct")} /></SelectTrigger>
                              <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{fmtNum(item.old_retail_price)}</TableCell>
                          <TableCell><Input type="number" step="0.01" value={item.new_retail_price} onChange={e => updateItem(idx, "new_retail_price", Number(e.target.value))} /></TableCell>
                          <TableCell><Input type="number" min={0} value={item.quantity_on_hand} onChange={e => updateItem(idx, "quantity_on_hand", Number(e.target.value))} /></TableCell>
                          <TableCell className={`font-semibold ${diff >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {diff >= 0 ? <TrendingUp className="h-3 w-3 inline mr-1" /> : <TrendingDown className="h-3 w-3 inline mr-1" />}
                            {fmtNum(diff)}
                          </TableCell>
                          <TableCell><Button variant="ghost" size="icon" onClick={() => removeItem(idx)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {items.length > 0 && (
                <Card className={`${totalDiff >= 0 ? "bg-green-50 dark:bg-green-950/20" : "bg-red-50 dark:bg-red-950/20"}`}>
                  <CardContent className="p-3 flex justify-between text-sm">
                    <span>{t("totalPriceDifference")}:</span>
                    <strong className={totalDiff >= 0 ? "text-green-600" : "text-red-600"}>{fmtNum(totalDiff)} RSD</strong>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !form.location_id || !form.legal_entity_id}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
