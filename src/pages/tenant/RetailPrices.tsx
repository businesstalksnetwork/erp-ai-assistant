import { useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Receipt } from "lucide-react";

export default function RetailPrices() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [listDialog, setListDialog] = useState(false);
  const [editingList, setEditingList] = useState<any>(null);
  const [listForm, setListForm] = useState({ name: "", location_id: "", is_default: false, is_active: true });
  const [selectedList, setSelectedList] = useState<string | null>(null);
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
    queryKey: ["products_all", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name, default_sale_price, default_retail_price").eq("tenant_id", tenantId!).eq("is_active", true);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: prices = [] } = useQuery({
    queryKey: ["retail_prices", selectedList],
    queryFn: async () => {
      if (!selectedList) return [];
      const { data } = await supabase.from("retail_prices").select("*, products(name, default_sale_price)").eq("price_list_id", selectedList);
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
      }, { onConflict: "price_list_id,product_id,valid_from" });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["retail_prices"] }); toast({ title: t("success") }); setPriceDialog(false); },
    onError: () => toast({ title: t("error"), variant: "destructive" }),
  });

  const openEditList = (pl: any) => {
    setEditingList(pl);
    setListForm({ name: pl.name, location_id: pl.location_id || "", is_default: pl.is_default, is_active: pl.is_active });
    setListDialog(true);
  };

  const openAddPrice = () => {
    setPriceForm({ product_id: "", retail_price: 0, markup_percent: 0 });
    setPriceDialog(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("retailPrices")}</h1>
      </div>

      <Tabs defaultValue="lists">
        <TabsList>
          <TabsTrigger value="lists">{t("retailPriceList")}</TabsTrigger>
          <TabsTrigger value="prices" disabled={!selectedList}>{t("retailPrices")}</TabsTrigger>
        </TabsList>

        <TabsContent value="lists" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { setEditingList(null); setListForm({ name: "", location_id: "", is_default: false, is_active: true }); setListDialog(true); }}>
              <Plus className="h-4 w-4 mr-2" />{t("add")}
            </Button>
          </div>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("location")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
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
                      <Button variant="ghost" size="icon" onClick={() => openEditList(pl)}><Pencil className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="prices" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-muted-foreground">{t("retailPriceList")}: <strong>{priceLists.find((pl: any) => pl.id === selectedList)?.name}</strong></p>
            <Button onClick={openAddPrice}><Plus className="h-4 w-4 mr-2" />{t("add")}</Button>
          </div>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("product")}</TableHead>
                  <TableHead className="text-right">{t("wholesalePrice")}</TableHead>
                  <TableHead className="text-right">{t("retailPrice")}</TableHead>
                  <TableHead className="text-right">{t("markup")} %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prices.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.products?.name}</TableCell>
                    <TableCell className="text-right">{Number(p.products?.default_sale_price || 0).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-bold">{Number(p.retail_price).toFixed(2)}</TableCell>
                    <TableCell className="text-right">{p.markup_percent ? `${Number(p.markup_percent).toFixed(1)}%` : "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Price List Dialog */}
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

      {/* Add Price Dialog */}
      <Dialog open={priceDialog} onOpenChange={setPriceDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("add")} {t("retailPrice")}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div><Label>{t("product")}</Label>
              <Select value={priceForm.product_id} onValueChange={v => {
                const prod = products.find((p: any) => p.id === v);
                const wholesale = Number(prod?.default_sale_price || 0);
                const markup = priceForm.markup_percent;
                setPriceForm(f => ({ ...f, product_id: v, retail_price: markup > 0 ? wholesale * (1 + markup / 100) : wholesale }));
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
