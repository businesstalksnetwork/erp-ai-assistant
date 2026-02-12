import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

const STATUSES = ["draft", "completed"] as const;

interface GRLine {
  product_id: string;
  quantity_ordered: number;
  quantity_received: number;
}

interface GRForm {
  receipt_number: string;
  purchase_order_id: string | null;
  warehouse_id: string | null;
  status: string;
  notes: string;
  lines: GRLine[];
}

const emptyLine: GRLine = { product_id: "", quantity_ordered: 0, quantity_received: 0 };
const emptyForm: GRForm = {
  receipt_number: "", purchase_order_id: null, warehouse_id: null,
  status: "draft", notes: "", lines: [{ ...emptyLine }],
};

export default function GoodsReceipts() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<GRForm>(emptyForm);

  const { data: receipts = [], isLoading } = useQuery({
    queryKey: ["goods-receipts", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("goods_receipts")
        .select("*, purchase_orders(order_number), warehouses(name)")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ["po-for-grn", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("purchase_orders").select("id, order_number").eq("tenant_id", tenantId!).in("status", ["confirmed", "sent"]).order("order_number");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses-list", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("warehouses").select("id, name").eq("tenant_id", tenantId!).eq("is_active", true).order("name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-list", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name").eq("tenant_id", tenantId!).eq("is_active", true).order("name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const loadPOLines = async (poId: string) => {
    const { data } = await supabase.from("purchase_order_lines").select("product_id, quantity, description").eq("purchase_order_id", poId).order("sort_order");
    if (data && data.length > 0) {
      setForm(f => ({
        ...f, purchase_order_id: poId,
        lines: data.filter(l => l.product_id).map(l => ({ product_id: l.product_id!, quantity_ordered: l.quantity, quantity_received: l.quantity })),
      }));
    }
  };

  const mutation = useMutation({
    mutationFn: async (f: GRForm) => {
      const payload = {
        tenant_id: tenantId!, receipt_number: f.receipt_number,
        purchase_order_id: f.purchase_order_id || null,
        warehouse_id: f.warehouse_id || null, status: f.status, notes: f.notes || null,
      };
      let grId = editId;
      if (editId) {
        const { error } = await supabase.from("goods_receipts").update(payload).eq("id", editId);
        if (error) throw error;
        await supabase.from("goods_receipt_lines").delete().eq("goods_receipt_id", editId);
      } else {
        const { data, error } = await supabase.from("goods_receipts").insert([payload]).select("id").single();
        if (error) throw error;
        grId = data.id;
      }
      const validLines = f.lines.filter(l => l.product_id);
      if (validLines.length > 0) {
        const { error } = await supabase.from("goods_receipt_lines").insert(
          validLines.map(l => ({ goods_receipt_id: grId!, product_id: l.product_id, quantity_ordered: l.quantity_ordered, quantity_received: l.quantity_received }))
        );
        if (error) throw error;
      }
      // If completed, adjust inventory
      if (f.status === "completed" && f.warehouse_id) {
        for (const line of validLines) {
          if (line.quantity_received > 0) {
            await supabase.rpc("adjust_inventory_stock", {
              p_tenant_id: tenantId!, p_product_id: line.product_id,
              p_warehouse_id: f.warehouse_id, p_quantity: line.quantity_received,
              p_movement_type: "in", p_reference: `GRN-${f.receipt_number}`, p_notes: "Goods receipt",
            });
          }
        }
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["goods-receipts"] }); setOpen(false); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openAdd = () => { setEditId(null); setForm(emptyForm); setOpen(true); };
  const openEdit = async (o: any) => {
    setEditId(o.id);
    const { data: lines } = await supabase.from("goods_receipt_lines").select("*").eq("goods_receipt_id", o.id);
    setForm({
      receipt_number: o.receipt_number, purchase_order_id: o.purchase_order_id,
      warehouse_id: o.warehouse_id, status: o.status, notes: o.notes || "",
      lines: lines?.map(l => ({ product_id: l.product_id, quantity_ordered: l.quantity_ordered, quantity_received: l.quantity_received })) || [{ ...emptyLine }],
    });
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("goodsReceipts")}</h1>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />{t("addGoodsReceipt")}</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("receiptNumber")}</TableHead>
                <TableHead>{t("purchaseOrder")}</TableHead>
                <TableHead>{t("warehouse")}</TableHead>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : receipts.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{t("noResults")}</TableCell></TableRow>
              ) : receipts.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.receipt_number}</TableCell>
                  <TableCell>{r.purchase_orders?.order_number || "—"}</TableCell>
                  <TableCell>{r.warehouses?.name || "—"}</TableCell>
                  <TableCell>{new Date(r.received_at).toLocaleDateString()}</TableCell>
                  <TableCell><Badge variant={r.status === "completed" ? "default" : "secondary"}>{t(r.status as any) || r.status}</Badge></TableCell>
                  <TableCell><Button size="sm" variant="ghost" onClick={() => openEdit(r)}>{t("edit")}</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? t("editGoodsReceipt") : t("addGoodsReceipt")}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>{t("receiptNumber")} *</Label><Input value={form.receipt_number} onChange={(e) => setForm({ ...form, receipt_number: e.target.value })} /></div>
              <div className="grid gap-2">
                <Label>{t("status")}</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(s => <SelectItem key={s} value={s}>{t(s as any) || s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("purchaseOrder")}</Label>
                <Select value={form.purchase_order_id || "__none"} onValueChange={(v) => { if (v !== "__none") loadPOLines(v); else setForm({ ...form, purchase_order_id: null }); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                    {purchaseOrders.map((po: any) => <SelectItem key={po.id} value={po.id}>{po.order_number}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{t("warehouse")}</Label>
                <Select value={form.warehouse_id || "__none"} onValueChange={(v) => setForm({ ...form, warehouse_id: v === "__none" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                    {warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">{t("lineItems")}</Label>
                <Button size="sm" variant="outline" onClick={() => setForm({ ...form, lines: [...form.lines, { ...emptyLine }] })}><Plus className="h-3 w-3 mr-1" />{t("addLine")}</Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("product")}</TableHead>
                    <TableHead className="w-32">{t("quantityOrdered")}</TableHead>
                    <TableHead className="w-32">{t("quantityReceived")}</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {form.lines.map((line, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <Select value={line.product_id || "__none"} onValueChange={(v) => { const lines = [...form.lines]; lines[idx].product_id = v === "__none" ? "" : v; setForm({ ...form, lines }); }}>
                          <SelectTrigger className="h-8"><SelectValue placeholder={t("selectProduct")} /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none">—</SelectItem>
                            {products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell><Input className="h-8" type="number" value={line.quantity_ordered} onChange={(e) => { const lines = [...form.lines]; lines[idx].quantity_ordered = +e.target.value; setForm({ ...form, lines }); }} /></TableCell>
                      <TableCell><Input className="h-8" type="number" value={line.quantity_received} onChange={(e) => { const lines = [...form.lines]; lines[idx].quantity_received = +e.target.value; setForm({ ...form, lines }); }} /></TableCell>
                      <TableCell>
                        {form.lines.length > 1 && (
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setForm({ ...form, lines: form.lines.filter((_, i) => i !== idx) })}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="grid gap-2"><Label>{t("notes")}</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => mutation.mutate(form)} disabled={!form.receipt_number || mutation.isPending}>
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
