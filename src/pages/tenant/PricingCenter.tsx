import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/PageHeader";
import { Plus, Pencil, DollarSign, TrendingUp } from "lucide-react";
import { fmtNum } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function PricingCenter() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const productFilter = searchParams.get("product") || "";

  return (
    <div className="space-y-6">
      <PageHeader title={t("pricingCenter")} icon={DollarSign} />
      {productFilter && (
        <div className="text-sm text-muted-foreground">
          {t("filteredByProduct")}: <Badge variant="outline">{productFilter.slice(0, 8)}…</Badge>
          <Link to="/inventory/pricing-center" className="ml-2 text-primary hover:underline text-xs">{t("clearFilter")}</Link>
        </div>
      )}
      <Tabs defaultValue="purchase">
        <TabsList className="flex-wrap">
          <TabsTrigger value="purchase">{t("purchasePriceHistory")}</TabsTrigger>
          <TabsTrigger value="wholesale">{t("wholesalePrices")}</TabsTrigger>
          <TabsTrigger value="retail">{t("retailPrices")}</TabsTrigger>
          <TabsTrigger value="web">{t("webPrices")}</TabsTrigger>
        </TabsList>

        <TabsContent value="purchase">
          <PurchasePricesTab tenantId={tenantId} productFilter={productFilter} t={t} />
        </TabsContent>
        <TabsContent value="wholesale">
          <WholesalePricesTab tenantId={tenantId} productFilter={productFilter} t={t} toast={toast} qc={qc} />
        </TabsContent>
        <TabsContent value="retail">
          <RetailPricesTab tenantId={tenantId} productFilter={productFilter} t={t} toast={toast} qc={qc} />
        </TabsContent>
        <TabsContent value="web">
          <WebPricesTab tenantId={tenantId} productFilter={productFilter} t={t} toast={toast} qc={qc} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Purchase Prices Tab ────────────────────────────────────
function PurchasePricesTab({ tenantId, productFilter, t }: any) {
  const { data: purchasePrices = [] } = useQuery({
    queryKey: ["purchase_prices", tenantId, productFilter],
    queryFn: async () => {
      let q = supabase.from("purchase_prices" as any).select("*, products(name), partners(name)")
        .eq("tenant_id", tenantId!).order("purchase_date", { ascending: false }).limit(200);
      if (productFilter) q = q.eq("product_id", productFilter);
      const { data } = await q;
      return (data as any[]) || [];
    },
    enabled: !!tenantId,
  });

  const chartData = [...purchasePrices]
    .reverse()
    .map((p: any) => ({ date: p.purchase_date, price: Number(p.unit_cost) }));

  return (
    <div className="space-y-4">
      {chartData.length > 1 && (
        <Card>
          <CardHeader><CardTitle className="text-base">{t("purchasePriceHistory")}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Line type="monotone" dataKey="price" className="stroke-primary" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("product")}</TableHead>
              <TableHead>{t("supplier")}</TableHead>
              <TableHead className="text-right">{t("unitCost")}</TableHead>
              <TableHead className="text-right">{t("quantity")}</TableHead>
              <TableHead>{t("date")}</TableHead>
              <TableHead>{t("documentType")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {purchasePrices.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.products?.name || "—"}</TableCell>
                <TableCell>{p.partners?.name || "—"}</TableCell>
                <TableCell className="text-right font-mono">{fmtNum(Number(p.unit_cost))}</TableCell>
                <TableCell className="text-right font-mono">{fmtNum(Number(p.quantity))}</TableCell>
                <TableCell>{new Date(p.purchase_date).toLocaleDateString("sr-RS")}</TableCell>
                <TableCell><Badge variant="outline">{p.document_type}</Badge></TableCell>
              </TableRow>
            ))}
            {purchasePrices.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{t("noResults")}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Wholesale Prices Tab ───────────────────────────────────
function WholesalePricesTab({ tenantId, productFilter, t, toast, qc }: any) {
  const [selectedList, setSelectedList] = useState<string | null>(null);
  const [listDialog, setListDialog] = useState(false);
  const [editingList, setEditingList] = useState<any>(null);
  const [listForm, setListForm] = useState({ name: "", is_default: false, is_active: true });
  const [priceDialog, setPriceDialog] = useState(false);
  const [priceForm, setPriceForm] = useState({ product_id: "", price: 0, min_quantity: 1, discount_percent: 0 });

  const { data: priceLists = [] } = useQuery({
    queryKey: ["wholesale_price_lists", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("wholesale_price_lists" as any).select("*").eq("tenant_id", tenantId!);
      return (data as any[]) || [];
    },
    enabled: !!tenantId,
  });

  const { data: prices = [] } = useQuery({
    queryKey: ["wholesale_prices", selectedList, productFilter],
    queryFn: async () => {
      if (!selectedList) return [];
      let q = supabase.from("wholesale_prices" as any).select("*, products(name, default_sale_price)").eq("price_list_id", selectedList);
      if (productFilter) q = q.eq("product_id", productFilter);
      const { data } = await q;
      return (data as any[]) || [];
    },
    enabled: !!selectedList,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products_active", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name, default_sale_price").eq("tenant_id", tenantId!).eq("is_active", true);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const saveList = useMutation({
    mutationFn: async () => {
      const payload: any = { name: listForm.name, is_default: listForm.is_default, is_active: listForm.is_active };
      if (editingList) {
        const { error } = await supabase.from("wholesale_price_lists" as any).update(payload).eq("id", editingList.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("wholesale_price_lists" as any).insert({ ...payload, tenant_id: tenantId! });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["wholesale_price_lists"] }); toast({ title: t("success") }); setListDialog(false); },
    onError: () => toast({ title: t("error"), variant: "destructive" }),
  });

  const savePrice = useMutation({
    mutationFn: async () => {
      if (!selectedList) return;
      const { error } = await supabase.from("wholesale_prices" as any).upsert({
        price_list_id: selectedList,
        product_id: priceForm.product_id,
        price: priceForm.price,
        min_quantity: priceForm.min_quantity,
        discount_percent: priceForm.discount_percent,
        tenant_id: tenantId!,
      } as any, { onConflict: "price_list_id,product_id,min_quantity" });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["wholesale_prices"] }); toast({ title: t("success") }); setPriceDialog(false); },
    onError: () => toast({ title: t("error"), variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEditingList(null); setListForm({ name: "", is_default: false, is_active: true }); setListDialog(true); }}>
          <Plus className="h-4 w-4 mr-2" />{t("add")} {t("priceList")}
        </Button>
      </div>
      <div className="border rounded-lg">
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t("name")}</TableHead>
            <TableHead>{t("status")}</TableHead>
            <TableHead>{t("actions")}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {priceLists.map((pl: any) => (
              <TableRow key={pl.id} className={selectedList === pl.id ? "bg-accent" : ""}>
                <TableCell className="font-medium">
                  <button className="text-left hover:underline" onClick={() => setSelectedList(pl.id)}>{pl.name}</button>
                  {pl.is_default && <Badge variant="outline" className="ml-2">{t("primary")}</Badge>}
                </TableCell>
                <TableCell><Badge variant={pl.is_active ? "default" : "secondary"}>{pl.is_active ? t("active") : t("inactive")}</Badge></TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => { setEditingList(pl); setListForm({ name: pl.name, is_default: pl.is_default, is_active: pl.is_active }); setListDialog(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {selectedList && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-muted-foreground">{t("priceList")}: <strong>{priceLists.find((pl: any) => pl.id === selectedList)?.name}</strong></p>
            <Button onClick={() => { setPriceForm({ product_id: "", price: 0, min_quantity: 1, discount_percent: 0 }); setPriceDialog(true); }}>
              <Plus className="h-4 w-4 mr-2" />{t("add")}
            </Button>
          </div>
          <div className="border rounded-lg">
            <Table>
              <TableHeader><TableRow>
                <TableHead>{t("product")}</TableHead>
                <TableHead className="text-right">{t("price")}</TableHead>
                <TableHead className="text-right">{t("minQuantity")}</TableHead>
                <TableHead className="text-right">{t("discount")} %</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {prices.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.products?.name || "—"}</TableCell>
                    <TableCell className="text-right font-mono">{fmtNum(Number(p.price))}</TableCell>
                    <TableCell className="text-right font-mono">{Number(p.min_quantity)}</TableCell>
                    <TableCell className="text-right">{Number(p.discount_percent) > 0 ? `${Number(p.discount_percent)}%` : "—"}</TableCell>
                  </TableRow>
                ))}
                {prices.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">{t("noResults")}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Wholesale List Dialog */}
      <Dialog open={listDialog} onOpenChange={setListDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingList ? t("edit") : t("add")} {t("priceList")}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div><Label>{t("name")}</Label><Input value={listForm.name} onChange={e => setListForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2"><Switch checked={listForm.is_default} onCheckedChange={v => setListForm(f => ({ ...f, is_default: v }))} /><Label>{t("primary")}</Label></div>
              <div className="flex items-center gap-2"><Switch checked={listForm.is_active} onCheckedChange={v => setListForm(f => ({ ...f, is_active: v }))} /><Label>{t("active")}</Label></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setListDialog(false)}>{t("cancel")}</Button>
            <Button onClick={() => saveList.mutate()} disabled={!listForm.name}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Wholesale Price Dialog */}
      <Dialog open={priceDialog} onOpenChange={setPriceDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("add")} {t("wholesalePrice")}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div><Label>{t("product")}</Label>
              <Select value={priceForm.product_id} onValueChange={v => {
                const prod = products.find((p: any) => p.id === v);
                setPriceForm(f => ({ ...f, product_id: v, price: Number(prod?.default_sale_price || 0) }));
              }}>
                <SelectTrigger><SelectValue placeholder={t("selectProduct")} /></SelectTrigger>
                <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>{t("price")}</Label><Input type="number" value={priceForm.price} onChange={e => setPriceForm(f => ({ ...f, price: Number(e.target.value) }))} /></div>
              <div><Label>{t("minQuantity")}</Label><Input type="number" min={1} value={priceForm.min_quantity} onChange={e => setPriceForm(f => ({ ...f, min_quantity: Number(e.target.value) }))} /></div>
              <div><Label>{t("discount")} %</Label><Input type="number" value={priceForm.discount_percent} onChange={e => setPriceForm(f => ({ ...f, discount_percent: Number(e.target.value) }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPriceDialog(false)}>{t("cancel")}</Button>
            <Button onClick={() => savePrice.mutate()} disabled={!priceForm.product_id}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Retail Prices Tab ──────────────────────────────────────
function RetailPricesTab({ tenantId, productFilter, t, toast, qc }: any) {
  const [selectedList, setSelectedList] = useState<string | null>(null);
  const [listDialog, setListDialog] = useState(false);
  const [editingList, setEditingList] = useState<any>(null);
  const [listForm, setListForm] = useState({ name: "", location_id: "", is_default: false, is_active: true });
  const [priceDialog, setPriceDialog] = useState(false);
  const [priceForm, setPriceForm] = useState({ product_id: "", retail_price: 0, markup_percent: 0 });

  const { data: priceLists = [] } = useQuery({
    queryKey: ["retail_price_lists", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("retail_price_lists").select("*").eq("tenant_id", tenantId!);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: locations = [] } = useQuery({
    queryKey: ["locations_all", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("locations").select("id, name, type").eq("tenant_id", tenantId!);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products_active_retail", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name, default_sale_price").eq("tenant_id", tenantId!).eq("is_active", true);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: prices = [] } = useQuery({
    queryKey: ["retail_prices", selectedList, productFilter],
    queryFn: async () => {
      if (!selectedList) return [];
      let q = supabase.from("retail_prices").select("*, products(name, default_sale_price)").eq("price_list_id", selectedList);
      if (productFilter) q = q.eq("product_id", productFilter);
      const { data } = await q;
      return data || [];
    },
    enabled: !!selectedList,
  });

  const saveList = useMutation({
    mutationFn: async () => {
      const payload = { name: listForm.name, is_default: listForm.is_default, is_active: listForm.is_active, location_id: listForm.location_id || null };
      if (editingList) {
        const { error } = await supabase.from("retail_price_lists").update(payload).eq("id", editingList.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("retail_price_lists").insert({ ...payload, tenant_id: tenantId! });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["retail_price_lists"] }); toast({ title: t("success") }); setListDialog(false); },
    onError: () => toast({ title: t("error"), variant: "destructive" }),
  });

  const savePrice = useMutation({
    mutationFn: async () => {
      if (!selectedList) return;
      const { error } = await supabase.from("retail_prices").upsert({
        price_list_id: selectedList,
        product_id: priceForm.product_id,
        retail_price: priceForm.retail_price,
        markup_percent: priceForm.markup_percent || null,
        valid_from: new Date().toISOString().split("T")[0],
        tenant_id: tenantId!,
      }, { onConflict: "price_list_id,product_id,valid_from" });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["retail_prices"] }); toast({ title: t("success") }); setPriceDialog(false); },
    onError: () => toast({ title: t("error"), variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEditingList(null); setListForm({ name: "", location_id: "", is_default: false, is_active: true }); setListDialog(true); }}>
          <Plus className="h-4 w-4 mr-2" />{t("add")} {t("retailPriceList")}
        </Button>
      </div>
      <div className="border rounded-lg">
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t("name")}</TableHead>
            <TableHead>{t("location")}</TableHead>
            <TableHead>{t("status")}</TableHead>
            <TableHead>{t("actions")}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {priceLists.map((pl: any) => (
              <TableRow key={pl.id} className={selectedList === pl.id ? "bg-accent" : ""}>
                <TableCell className="font-medium">
                  <button className="text-left hover:underline" onClick={() => setSelectedList(pl.id)}>{pl.name}</button>
                  {pl.is_default && <Badge variant="outline" className="ml-2">{t("primary")}</Badge>}
                </TableCell>
                <TableCell>{locations.find((l: any) => l.id === pl.location_id)?.name || t("allLocations")}</TableCell>
                <TableCell><Badge variant={pl.is_active ? "default" : "secondary"}>{pl.is_active ? t("active") : t("inactive")}</Badge></TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => { setEditingList(pl); setListForm({ name: pl.name, location_id: pl.location_id || "", is_default: pl.is_default, is_active: pl.is_active }); setListDialog(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {selectedList && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-muted-foreground">{t("retailPriceList")}: <strong>{priceLists.find((pl: any) => pl.id === selectedList)?.name}</strong></p>
            <Button onClick={() => { setPriceForm({ product_id: "", retail_price: 0, markup_percent: 0 }); setPriceDialog(true); }}>
              <Plus className="h-4 w-4 mr-2" />{t("add")}
            </Button>
          </div>
          <div className="border rounded-lg">
            <Table>
              <TableHeader><TableRow>
                <TableHead>{t("product")}</TableHead>
                <TableHead className="text-right">{t("wholesalePrice")}</TableHead>
                <TableHead className="text-right">{t("retailPrice")}</TableHead>
                <TableHead className="text-right">{t("markup")} %</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {prices.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.products?.name}</TableCell>
                    <TableCell className="text-right">{Number(p.products?.default_sale_price || 0).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-bold">{Number(p.retail_price).toFixed(2)}</TableCell>
                    <TableCell className="text-right">{p.markup_percent ? `${Number(p.markup_percent).toFixed(1)}%` : "—"}</TableCell>
                  </TableRow>
                ))}
                {prices.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">{t("noResults")}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <Dialog open={listDialog} onOpenChange={setListDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingList ? t("edit") : t("add")} {t("retailPriceList")}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div><Label>{t("name")}</Label><Input value={listForm.name} onChange={e => setListForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>{t("location")}</Label>
              <Select value={listForm.location_id} onValueChange={v => setListForm(f => ({ ...f, location_id: v === "all" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder={t("allLocations")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allLocations")}</SelectItem>
                  {locations.filter((l: any) => l.type === "shop" || l.type === "branch").map((l: any) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2"><Switch checked={listForm.is_default} onCheckedChange={v => setListForm(f => ({ ...f, is_default: v }))} /><Label>{t("primary")}</Label></div>
              <div className="flex items-center gap-2"><Switch checked={listForm.is_active} onCheckedChange={v => setListForm(f => ({ ...f, is_active: v }))} /><Label>{t("active")}</Label></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setListDialog(false)}>{t("cancel")}</Button>
            <Button onClick={() => saveList.mutate()} disabled={!listForm.name}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={priceDialog} onOpenChange={setPriceDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("add")} {t("retailPrice")}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div><Label>{t("product")}</Label>
              <Select value={priceForm.product_id} onValueChange={v => {
                const prod = products.find((p: any) => p.id === v);
                setPriceForm(f => ({ ...f, product_id: v, retail_price: Number(prod?.default_sale_price || 0) }));
              }}>
                <SelectTrigger><SelectValue placeholder={t("selectProduct")} /></SelectTrigger>
                <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t("retailPrice")}</Label><Input type="number" value={priceForm.retail_price} onChange={e => setPriceForm(f => ({ ...f, retail_price: Number(e.target.value) }))} /></div>
              <div><Label>{t("markup")} %</Label><Input type="number" value={priceForm.markup_percent} onChange={e => {
                const m = Number(e.target.value);
                const prod = products.find((p: any) => p.id === priceForm.product_id);
                const wholesale = Number(prod?.default_sale_price || 0);
                setPriceForm(f => ({ ...f, markup_percent: m, retail_price: wholesale * (1 + m / 100) }));
              }} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPriceDialog(false)}>{t("cancel")}</Button>
            <Button onClick={() => savePrice.mutate()} disabled={!priceForm.product_id}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Web Prices Tab ─────────────────────────────────────────
function WebPricesTab({ tenantId, productFilter, t, toast, qc }: any) {
  const [selectedList, setSelectedList] = useState<string | null>(null);
  const [listDialog, setListDialog] = useState(false);
  const [editingList, setEditingList] = useState<any>(null);
  const [listForm, setListForm] = useState({ name: "", web_connection_id: "", is_default: false, is_active: true });
  const [priceDialog, setPriceDialog] = useState(false);
  const [priceForm, setPriceForm] = useState({ product_id: "", web_price: 0, compare_at_price: 0 });

  const { data: priceLists = [] } = useQuery({
    queryKey: ["web_price_lists", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("web_price_lists" as any).select("*").eq("tenant_id", tenantId!);
      return (data as any[]) || [];
    },
    enabled: !!tenantId,
  });

  const { data: connections = [] } = useQuery({
    queryKey: ["web_connections", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("web_connections" as any).select("id, store_url, platform").eq("tenant_id", tenantId!);
      return (data as any[]) || [];
    },
    enabled: !!tenantId,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products_active_web", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name, default_sale_price").eq("tenant_id", tenantId!).eq("is_active", true);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: prices = [] } = useQuery({
    queryKey: ["web_prices", selectedList, productFilter],
    queryFn: async () => {
      if (!selectedList) return [];
      let q = supabase.from("web_prices" as any).select("*").eq("web_price_list_id", selectedList);
      if (productFilter) q = q.eq("product_id", productFilter);
      const { data } = await q;
      return (data as any[]) || [];
    },
    enabled: !!selectedList,
  });

  const saveList = useMutation({
    mutationFn: async () => {
      const payload: any = { name: listForm.name, is_default: listForm.is_default, is_active: listForm.is_active, web_connection_id: listForm.web_connection_id || null };
      if (editingList) {
        const { error } = await supabase.from("web_price_lists" as any).update(payload).eq("id", editingList.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("web_price_lists" as any).insert({ ...payload, tenant_id: tenantId! });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["web_price_lists"] }); toast({ title: t("success") }); setListDialog(false); },
    onError: () => toast({ title: t("error"), variant: "destructive" }),
  });

  const savePrice = useMutation({
    mutationFn: async () => {
      if (!selectedList) return;
      const { error } = await supabase.from("web_prices" as any).upsert({
        web_price_list_id: selectedList,
        product_id: priceForm.product_id,
        web_price: priceForm.web_price,
        compare_at_price: priceForm.compare_at_price || null,
        valid_from: new Date().toISOString().split("T")[0],
      } as any, { onConflict: "web_price_list_id,product_id,valid_from" });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["web_prices"] }); toast({ title: t("success") }); setPriceDialog(false); },
    onError: () => toast({ title: t("error"), variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEditingList(null); setListForm({ name: "", web_connection_id: "", is_default: false, is_active: true }); setListDialog(true); }}>
          <Plus className="h-4 w-4 mr-2" />{t("add")} {t("webPriceList")}
        </Button>
      </div>
      <div className="border rounded-lg">
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t("name")}</TableHead>
            <TableHead>{t("platform")}</TableHead>
            <TableHead>{t("status")}</TableHead>
            <TableHead>{t("actions")}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {priceLists.map((pl: any) => (
              <TableRow key={pl.id} className={selectedList === pl.id ? "bg-accent" : ""}>
                <TableCell className="font-medium">
                  <button className="text-left hover:underline" onClick={() => setSelectedList(pl.id)}>{pl.name}</button>
                  {pl.is_default && <Badge variant="outline" className="ml-2">{t("primary")}</Badge>}
                </TableCell>
                <TableCell>{pl.web_connection_id ? connections.find((c: any) => c.id === pl.web_connection_id)?.platform || "—" : t("allChannels")}</TableCell>
                <TableCell><Badge variant={pl.is_active ? "default" : "secondary"}>{pl.is_active ? t("active") : t("inactive")}</Badge></TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => { setEditingList(pl); setListForm({ name: pl.name, web_connection_id: pl.web_connection_id || "", is_default: pl.is_default, is_active: pl.is_active }); setListDialog(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {selectedList && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-muted-foreground">{t("webPriceList")}: <strong>{priceLists.find((pl: any) => pl.id === selectedList)?.name}</strong></p>
            <Button onClick={() => { setPriceForm({ product_id: "", web_price: 0, compare_at_price: 0 }); setPriceDialog(true); }}>
              <Plus className="h-4 w-4 mr-2" />{t("add")}
            </Button>
          </div>
          <div className="border rounded-lg">
            <Table>
              <TableHeader><TableRow>
                <TableHead>{t("product")}</TableHead>
                <TableHead className="text-right">{t("webPrice")}</TableHead>
                <TableHead className="text-right">{t("compareAtPrice")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {prices.map((p: any) => {
                  const prod = products.find((pr: any) => pr.id === p.product_id);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{prod?.name || "—"}</TableCell>
                      <TableCell className="text-right font-bold">{Number(p.web_price || p.price).toFixed(2)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {p.compare_at_price ? <span className="line-through">{Number(p.compare_at_price).toFixed(2)}</span> : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {prices.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">{t("noResults")}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <Dialog open={listDialog} onOpenChange={setListDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingList ? t("edit") : t("add")} {t("webPriceList")}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div><Label>{t("name")}</Label><Input value={listForm.name} onChange={e => setListForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>{t("webConnection")}</Label>
              <Select value={listForm.web_connection_id} onValueChange={v => setListForm(f => ({ ...f, web_connection_id: v === "all" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder={t("allChannels")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allChannels")}</SelectItem>
                  {connections.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.platform} - {c.store_url}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2"><Switch checked={listForm.is_default} onCheckedChange={v => setListForm(f => ({ ...f, is_default: v }))} /><Label>{t("primary")}</Label></div>
              <div className="flex items-center gap-2"><Switch checked={listForm.is_active} onCheckedChange={v => setListForm(f => ({ ...f, is_active: v }))} /><Label>{t("active")}</Label></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setListDialog(false)}>{t("cancel")}</Button>
            <Button onClick={() => saveList.mutate()} disabled={!listForm.name}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={priceDialog} onOpenChange={setPriceDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("add")} {t("webPrice")}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div><Label>{t("product")}</Label>
              <Select value={priceForm.product_id} onValueChange={v => {
                const prod = products.find((p: any) => p.id === v);
                setPriceForm(f => ({ ...f, product_id: v, web_price: Number(prod?.default_sale_price || 0) }));
              }}>
                <SelectTrigger><SelectValue placeholder={t("selectProduct")} /></SelectTrigger>
                <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t("webPrice")}</Label><Input type="number" value={priceForm.web_price} onChange={e => setPriceForm(f => ({ ...f, web_price: Number(e.target.value) }))} /></div>
              <div><Label>{t("compareAtPrice")}</Label><Input type="number" value={priceForm.compare_at_price} onChange={e => setPriceForm(f => ({ ...f, compare_at_price: Number(e.target.value) }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPriceDialog(false)}>{t("cancel")}</Button>
            <Button onClick={() => savePrice.mutate()} disabled={!priceForm.product_id}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
