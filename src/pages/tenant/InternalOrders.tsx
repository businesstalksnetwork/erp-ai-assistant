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
import { Plus, Search, Trash2, CheckCircle, XCircle, Truck } from "lucide-react";

const statusColors: Record<string, string> = {
  draft: "secondary", submitted: "default", approved: "default", fulfilled: "default", cancelled: "destructive",
};

export default function InternalOrders() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ requesting_location_id: "", source_warehouse_id: "", notes: "" });
  const [items, setItems] = useState<{ product_id: string; quantity_requested: number }[]>([]);

  const { data: orders = [] } = useQuery({
    queryKey: ["internal_orders", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("internal_orders")
        .select("*, locations:requesting_location_id(name), warehouses:source_warehouse_id(name)")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: locations = [] } = useQuery({
    queryKey: ["locations_active", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("locations").select("id, name").eq("tenant_id", tenantId!).eq("is_active", true);
      return data || [];
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
      const { data } = await supabase.from("products").select("id, name, sku").eq("tenant_id", tenantId!).eq("is_active", true);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const getNextNumber = () => {
    const nums = orders.map((o: any) => parseInt(o.order_number?.replace(/\D/g, "") || "0"));
    const max = nums.length > 0 ? Math.max(...nums) : 0;
    return `IO-${String(max + 1).padStart(4, "0")}`;
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: order, error } = await supabase.from("internal_orders").insert({
        tenant_id: tenantId!, order_number: getNextNumber(),
        requesting_location_id: form.requesting_location_id || null,
        source_warehouse_id: form.source_warehouse_id || null,
        status: "draft", notes: form.notes, requested_by: user?.id,
      }).select().single();
      if (error) throw error;
      if (items.length > 0) {
        const { error: itemsErr } = await supabase.from("internal_order_items").insert(
          items.filter(i => i.product_id && i.quantity_requested > 0).map(i => ({
            internal_order_id: order.id, product_id: i.product_id, quantity_requested: i.quantity_requested,
          }))
        );
        if (itemsErr) throw itemsErr;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["internal_orders"] }); toast({ title: t("success") }); setDialogOpen(false); setItems([]); setForm({ requesting_location_id: "", source_warehouse_id: "", notes: "" }); },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, approved_by }: { id: string; status: string; approved_by?: string }) => {
      const payload: any = { status, updated_at: new Date().toISOString() };
      if (approved_by) payload.approved_by = approved_by;
      const { error } = await supabase.from("internal_orders").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["internal_orders"] }); toast({ title: t("success") }); },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const addItem = () => setItems(prev => [...prev, { product_id: "", quantity_requested: 1 }]);
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const filtered = orders.filter((o: any) =>
    o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
    (o.locations as any)?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("internalOrders")}</h1>
        <Button onClick={() => { setDialogOpen(true); setItems([{ product_id: "", quantity_requested: 1 }]); }}>
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
                <TableHead>{t("orderNumber")}</TableHead>
                <TableHead>{t("requestingLocation")}</TableHead>
                <TableHead>{t("sourceWarehouse")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("createdAt")}</TableHead>
                <TableHead>{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((o: any) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.order_number}</TableCell>
                  <TableCell>{(o.locations as any)?.name || "—"}</TableCell>
                  <TableCell>{(o.warehouses as any)?.name || "—"}</TableCell>
                  <TableCell><Badge variant={(statusColors[o.status] || "secondary") as any}>{t(o.status as any) || o.status}</Badge></TableCell>
                  <TableCell>{new Date(o.created_at).toLocaleDateString("sr-RS")}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {o.status === "draft" && (
                        <Button variant="outline" size="sm" onClick={() => updateStatusMutation.mutate({ id: o.id, status: "submitted" })}>
                          {t("submit")}
                        </Button>
                      )}
                      {o.status === "submitted" && (
                        <Button variant="outline" size="sm" onClick={() => updateStatusMutation.mutate({ id: o.id, status: "approved", approved_by: user?.id })}>
                          <CheckCircle className="h-3 w-3 mr-1" />{t("approve")}
                        </Button>
                      )}
                      {o.status === "approved" && (
                        <Button variant="outline" size="sm" onClick={() => updateStatusMutation.mutate({ id: o.id, status: "fulfilled" })}>
                          <Truck className="h-3 w-3 mr-1" />{t("fulfill")}
                        </Button>
                      )}
                      {(o.status === "draft" || o.status === "submitted") && (
                        <Button variant="ghost" size="sm" onClick={() => updateStatusMutation.mutate({ id: o.id, status: "cancelled" })}>
                          <XCircle className="h-3 w-3 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Order Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("internalOrder")}</DialogTitle>
            <DialogDescription />
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t("requestingLocation")}</Label>
                <Select value={form.requesting_location_id} onValueChange={v => setForm(f => ({ ...f, requesting_location_id: v }))}>
                  <SelectTrigger><SelectValue placeholder={t("location")} /></SelectTrigger>
                  <SelectContent>{locations.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>{t("sourceWarehouse")}</Label>
                <Select value={form.source_warehouse_id} onValueChange={v => setForm(f => ({ ...f, source_warehouse_id: v }))}>
                  <SelectTrigger><SelectValue placeholder={t("warehouse")} /></SelectTrigger>
                  <SelectContent>{warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>{t("notes")}</Label><Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t("lineItems")}</Label>
                <Button variant="outline" size="sm" onClick={addItem}><Plus className="h-3 w-3 mr-1" />{t("addLine")}</Button>
              </div>
              {items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Select value={item.product_id} onValueChange={v => setItems(prev => prev.map((it, i) => i === idx ? { ...it, product_id: v } : it))}>
                      <SelectTrigger><SelectValue placeholder={t("selectProduct")} /></SelectTrigger>
                      <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name} {p.sku ? `(${p.sku})` : ""}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="w-24">
                    <Input type="number" min={1} value={item.quantity_requested} onChange={e => setItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity_requested: Number(e.target.value) } : it))} />
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeItem(idx)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
