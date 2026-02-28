import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Trash2, PackageCheck, Box } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useState } from "react";
import { postWithRuleOrFallback } from "@/lib/postingHelper";
import { useApprovalCheck } from "@/hooks/useApprovalCheck";
import { PageHeader } from "@/components/shared/PageHeader";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/shared/ResponsiveTable";

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
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<GRForm>(emptyForm);
  const { checkApproval } = useApprovalCheck(tenantId, "goods_receipt");

  const { data: receipts = [], isLoading } = useQuery({
    queryKey: ["goods-receipts", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("goods_receipts")
        .select("*, purchase_orders(order_number, supplier_id, legal_entity_id, warehouse_id), warehouses(name), partners(name), legal_entities(name)")
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
      const { data } = await supabase.from("products").select("id, name, default_purchase_price").eq("tenant_id", tenantId!).eq("is_active", true).order("name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const loadPOLines = async (poId: string) => {
    // Fetch PO header to auto-populate supplier_id, legal_entity_id, warehouse_id
    const { data: po } = await supabase.from("purchase_orders").select("supplier_id, legal_entity_id, warehouse_id").eq("id", poId).single();
    const { data } = await supabase.from("purchase_order_lines").select("product_id, quantity, description").eq("purchase_order_id", poId).order("sort_order");
    setForm(f => ({
      ...f, purchase_order_id: poId,
      warehouse_id: po?.warehouse_id || f.warehouse_id,
      lines: data && data.length > 0
        ? data.filter(l => l.product_id).map(l => ({ product_id: l.product_id!, quantity_ordered: l.quantity, quantity_received: l.quantity }))
        : f.lines,
    }));
  };

  const mutation = useMutation({
    mutationFn: async (f: GRForm) => {
      // Auto-populate supplier_id and legal_entity_id from linked PO
      let supplierId: string | null = null;
      let legalEntityId: string | null = null;
      if (f.purchase_order_id) {
        const { data: po } = await supabase.from("purchase_orders").select("supplier_id, legal_entity_id").eq("id", f.purchase_order_id).single();
        supplierId = po?.supplier_id || null;
        legalEntityId = po?.legal_entity_id || null;
      }
      const payload = {
        tenant_id: tenantId!, receipt_number: f.receipt_number,
        purchase_order_id: f.purchase_order_id || null,
        warehouse_id: f.warehouse_id || null, status: f.status, notes: f.notes || null,
        supplier_id: supplierId,
        legal_entity_id: legalEntityId,
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
          validLines.map(l => ({ goods_receipt_id: grId!, product_id: l.product_id, quantity_ordered: l.quantity_ordered, quantity_received: l.quantity_received, tenant_id: tenantId! }))
        );
        if (error) throw error;
      }
      if (f.status === "completed" && f.warehouse_id) {
        let totalValue = 0;
        for (const line of validLines) {
          if (line.quantity_received > 0) {
            await supabase.rpc("adjust_inventory_stock", {
              p_tenant_id: tenantId!, p_product_id: line.product_id,
              p_warehouse_id: f.warehouse_id, p_quantity: line.quantity_received,
              p_movement_type: "in", p_reference: `GRN-${f.receipt_number}`, p_notes: "Goods receipt",
            });
            const prod = products.find((p: any) => p.id === line.product_id);
            const price = prod?.default_purchase_price || 0;
            totalValue += line.quantity_received * price;
            if (price > 0) {
              await supabase.from("inventory_cost_layers").insert({
                tenant_id: tenantId!, product_id: line.product_id,
                warehouse_id: f.warehouse_id, layer_date: new Date().toISOString().split("T")[0],
                quantity_remaining: line.quantity_received, unit_cost: price,
                reference: `GRN-${f.receipt_number}`,
              });
            }
          }
        }
        if (totalValue > 0) {
          const entryDate = new Date().toISOString().split("T")[0];
          await postWithRuleOrFallback({
            tenantId: tenantId!, userId: user?.id || null, entryDate,
            modelCode: "GOODS_RECEIPT", amount: totalValue,
            description: `Goods Receipt ${f.receipt_number}`,
            reference: `GRN-${f.receipt_number}`,
            context: {},
            fallbackLines: [
              { accountCode: "1200", debit: totalValue, credit: 0, description: `Inventory - GRN ${f.receipt_number}`, sortOrder: 0 },
              { accountCode: "2100", debit: 0, credit: totalValue, description: `AP/GRNI - GRN ${f.receipt_number}`, sortOrder: 1 },
            ],
          });
          toast.success(t("grnJournalCreated"));
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

  const createAssetFromGR = (gr: any) => {
    const params = new URLSearchParams();
    if (gr.purchase_order_id) params.set("purchase_order_id", gr.purchase_order_id);
    if (gr.id) params.set("goods_receipt_id", gr.id);
    if (gr.warehouse_id) params.set("warehouse_id", gr.warehouse_id);
    if (gr.supplier_id) params.set("supplier_id", gr.supplier_id);
    navigate(`/assets/registry/new?${params.toString()}`);
  };

  const columns: ResponsiveColumn<any>[] = [
    { key: "receipt_number", label: t("receiptNumber"), primary: true, render: (r) => r.receipt_number },
    { key: "purchase_order", label: t("purchaseOrder"), render: (r) => r.purchase_orders?.order_number || "—" },
    { key: "warehouse", label: t("warehouse"), hideOnMobile: true, render: (r) => r.warehouses?.name || "—" },
    { key: "date", label: t("date"), render: (r) => new Date(r.received_at).toLocaleDateString() },
    { key: "status", label: t("status"), render: (r) => <Badge variant={r.status === "completed" ? "default" : "secondary"}>{t(r.status as any) || r.status}</Badge> },
    { key: "actions", label: t("actions"), showInCard: false, render: (r) => (
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(r); }}>{t("edit")}</Button>
        {r.status === "completed" && (
          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); createAssetFromGR(r); }} title={t("assetsCrossCreateFromGR" as any)}>
            <Box className="h-3 w-3 mr-1" /> {t("assetsCrossCreateFromGR" as any)}
          </Button>
        )}
      </div>
    )},
  ];

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("goodsReceipts")}
        description={t("goodsReceipts")}
        icon={PackageCheck}
        actions={<Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />{t("addGoodsReceipt")}</Button>}
      />

      <ResponsiveTable
        data={receipts}
        columns={columns}
        keyExtractor={(r) => r.id}
        emptyMessage={t("noResults")}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? t("editGoodsReceipt") : t("addGoodsReceipt")}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <Button onClick={() => {
              if (form.status === "completed") {
                // Estimate total value for approval threshold check
                const totalValue = form.lines.reduce((sum, l) => {
                  const prod = products.find((p: any) => p.id === l.product_id);
                  return sum + l.quantity_received * (prod?.default_purchase_price || 0);
                }, 0);
                checkApproval(editId || "new", totalValue, () => mutation.mutate(form));
              } else {
                mutation.mutate(form);
              }
            }} disabled={!form.receipt_number || mutation.isPending}>
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}