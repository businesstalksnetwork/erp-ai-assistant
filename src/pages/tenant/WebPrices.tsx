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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil } from "lucide-react";

export default function WebPrices() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [listDialog, setListDialog] = useState(false);
  const [editingList, setEditingList] = useState<any>(null);
  const [listForm, setListForm] = useState({ name: "", web_connection_id: "", is_default: false, is_active: true });
  const [selectedList, setSelectedList] = useState<string | null>(null);
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
    queryKey: ["products_all", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name, default_sale_price").eq("tenant_id", tenantId!).eq("is_active", true);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: stockData = [] } = useQuery({
    queryKey: ["inventory_stock_totals", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("inventory_stock").select("product_id, on_hand").eq("tenant_id", tenantId!);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: prices = [] } = useQuery({
    queryKey: ["web_prices", selectedList],
    queryFn: async () => {
      if (!selectedList) return [];
      const { data } = await supabase.from("web_prices" as any).select("*").eq("price_list_id", selectedList);
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
        price_list_id: selectedList,
        product_id: priceForm.product_id,
        web_price: priceForm.web_price,
        compare_at_price: priceForm.compare_at_price || null,
        valid_from: new Date().toISOString().split("T")[0],
      } as any, { onConflict: "price_list_id,product_id,valid_from" });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["web_prices"] }); toast({ title: t("success") }); setPriceDialog(false); },
    onError: () => toast({ title: t("error"), variant: "destructive" }),
  });

  const openEditList = (pl: any) => {
    setEditingList(pl);
    setListForm({ name: pl.name, web_connection_id: pl.web_connection_id || "", is_default: pl.is_default, is_active: pl.is_active });
    setListDialog(true);
  };

  const openAddPrice = () => {
    setPriceForm({ product_id: "", web_price: 0, compare_at_price: 0 });
    setPriceDialog(true);
  };

  const getProductName = (productId: string) => {
    const p = products.find((p: any) => p.id === productId);
    return p?.name || productId;
  };

  const getProductStock = (productId: string) => {
    const entries = stockData.filter((s: any) => s.product_id === productId);
    return entries.reduce((sum: number, s: any) => sum + Number(s.on_hand || 0), 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("webPrices")}</h1>
      </div>

      <Tabs defaultValue="lists">
        <TabsList>
          <TabsTrigger value="lists">{t("webPriceList")}</TabsTrigger>
          <TabsTrigger value="prices" disabled={!selectedList}>{t("webPrices")}</TabsTrigger>
        </TabsList>

        <TabsContent value="lists" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { setEditingList(null); setListForm({ name: "", web_connection_id: "", is_default: false, is_active: true }); setListDialog(true); }}>
              <Plus className="h-4 w-4 mr-2" />{t("add")}
            </Button>
          </div>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("platform")}</TableHead>
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
                    <TableCell>
                      {pl.web_connection_id
                        ? connections.find((c: any) => c.id === pl.web_connection_id)?.platform || "-"
                        : t("allChannels")}
                    </TableCell>
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
            <p className="text-muted-foreground">{t("webPriceList")}: <strong>{priceLists.find((pl: any) => pl.id === selectedList)?.name}</strong></p>
            <Button onClick={openAddPrice}><Plus className="h-4 w-4 mr-2" />{t("add")}</Button>
          </div>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("product")}</TableHead>
                  <TableHead className="text-right">{t("onHand")}</TableHead>
                  <TableHead className="text-right">{t("wholesalePrice")}</TableHead>
                  <TableHead className="text-right">{t("webPrice")}</TableHead>
                  <TableHead className="text-right">{t("compareAtPrice")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prices.map((p: any) => {
                  const prod = products.find((pr: any) => pr.id === p.product_id);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{getProductName(p.product_id)}</TableCell>
                      <TableCell className="text-right">
                        {(() => { const stock = getProductStock(p.product_id); return <Badge variant={stock > 0 ? "default" : "destructive"}>{stock}</Badge>; })()}
                      </TableCell>
                      <TableCell className="text-right">{Number(prod?.default_sale_price || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-bold">{Number(p.web_price).toFixed(2)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {p.compare_at_price ? <span className="line-through">{Number(p.compare_at_price).toFixed(2)}</span> : "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Price List Dialog */}
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
                  {connections.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.platform} - {c.store_url}</SelectItem>
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
