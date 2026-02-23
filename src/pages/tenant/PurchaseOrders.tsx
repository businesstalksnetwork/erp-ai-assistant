import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useLegalEntities } from "@/hooks/useLegalEntities";
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
import { Plus, Loader2, Trash2, Package, FileText, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApprovalCheck } from "@/hooks/useApprovalCheck";
import { PageHeader } from "@/components/shared/PageHeader";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/shared/ResponsiveTable";

const STATUSES = ["draft", "sent", "confirmed", "received", "cancelled"] as const;

interface POLine {
  id?: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface POForm {
  order_number: string;
  supplier_id: string | null;
  supplier_name: string;
  order_date: string;
  expected_date: string;
  status: string;
  currency: string;
  notes: string;
  lines: POLine[];
  legal_entity_id: string | null;
  warehouse_id: string | null;
}

const emptyLine: POLine = { product_id: null, description: "", quantity: 1, unit_price: 0, total: 0 };
const emptyForm: POForm = {
  order_number: "", supplier_id: null, supplier_name: "",
  order_date: new Date().toISOString().split("T")[0], expected_date: "",
  status: "draft", currency: "RSD", notes: "", lines: [{ ...emptyLine }],
  legal_entity_id: null, warehouse_id: null,
};

export default function PurchaseOrders() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const { entities: legalEntities } = useLegalEntities();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<POForm>(emptyForm);
  const { checkApproval } = useApprovalCheck(tenantId, "purchase_order");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["purchase-orders", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("purchase_orders")
        .select("*, partners(name), legal_entities(name), warehouses(name)")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
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

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-list", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("partners").select("id, name").eq("tenant_id", tenantId!).eq("is_active", true).in("type", ["supplier", "both"]).order("name");
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

  const mutation = useMutation({
    mutationFn: async (f: POForm) => {
      const subtotal = f.lines.reduce((s, l) => s + l.total, 0);
      const payload = {
        tenant_id: tenantId!, order_number: f.order_number,
        supplier_id: f.supplier_id || null, supplier_name: f.supplier_name,
        order_date: f.order_date, expected_date: f.expected_date || null,
        status: f.status, currency: f.currency, notes: f.notes || null,
        subtotal, tax_amount: 0, total: subtotal,
        legal_entity_id: f.legal_entity_id || null,
        warehouse_id: f.warehouse_id || null,
      };
      let poId = editId;
      if (editId) {
        const { error } = await supabase.from("purchase_orders").update(payload).eq("id", editId);
        if (error) throw error;
        await supabase.from("purchase_order_lines").delete().eq("purchase_order_id", editId);
      } else {
        const { data, error } = await supabase.from("purchase_orders").insert([payload]).select("id").single();
        if (error) throw error;
        poId = data.id;
      }
      if (f.lines.length > 0) {
        const lines = f.lines.map((l, i) => ({
          purchase_order_id: poId!, product_id: l.product_id || null,
          description: l.description, quantity: l.quantity, unit_price: l.unit_price,
          total: l.total, sort_order: i,
        }));
        const { error } = await supabase.from("purchase_order_lines").insert(lines);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["purchase-orders"] }); setOpen(false); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const createGRN = async (o: any) => {
    try {
      const { data: lines } = await supabase.from("purchase_order_lines").select("*").eq("purchase_order_id", o.id);
      const receiptNumber = `GRN-${Date.now().toString(36).toUpperCase()}`;
      const { data: grn, error: grnError } = await supabase.from("goods_receipts").insert([{
        tenant_id: tenantId!, receipt_number: receiptNumber, purchase_order_id: o.id, status: "draft",
        warehouse_id: o.warehouse_id || null,
        supplier_id: o.supplier_id || null,
        legal_entity_id: o.legal_entity_id || null,
      }]).select("id").single();
      if (grnError) throw grnError;
      if (lines && lines.length > 0) {
        const grnLines = lines.map(l => ({
          goods_receipt_id: grn.id, product_id: l.product_id,
          quantity_ordered: l.quantity, quantity_received: l.quantity,
        }));
        await supabase.from("goods_receipt_lines").insert(grnLines);
      }
      qc.invalidateQueries({ queryKey: ["goods-receipts"] });
      toast.success(t("conversionSuccess"));
      navigate("/purchasing/goods-receipts");
    } catch (e: any) { toast.error(e.message); }
  };

  const createSupplierInvoice = (o: any) => {
    navigate("/purchasing/supplier-invoices", {
      state: {
        fromPO: {
          purchase_order_id: o.id, supplier_id: o.supplier_id,
          supplier_name: o.partners?.name || o.supplier_name,
          amount: o.total, currency: o.currency,
        },
      },
    });
  };

  const openAdd = () => { setEditId(null); setForm(emptyForm); setOpen(true); };
  const openEdit = async (o: any) => {
    setEditId(o.id);
    const { data: lines } = await supabase.from("purchase_order_lines").select("*").eq("purchase_order_id", o.id).order("sort_order");
    setForm({
      order_number: o.order_number, supplier_id: o.supplier_id, supplier_name: o.supplier_name,
      order_date: o.order_date, expected_date: o.expected_date || "",
      status: o.status, currency: o.currency, notes: o.notes || "",
      legal_entity_id: o.legal_entity_id || null, warehouse_id: o.warehouse_id || null,
      lines: lines?.map(l => ({ id: l.id, product_id: l.product_id, description: l.description, quantity: l.quantity, unit_price: l.unit_price, total: l.total })) || [{ ...emptyLine }],
    });
    setOpen(true);
  };

  const updateLine = (idx: number, field: string, val: any) => {
    const lines = [...form.lines];
    (lines[idx] as any)[field] = val;
    if (field === "quantity" || field === "unit_price") {
      lines[idx].total = lines[idx].quantity * lines[idx].unit_price;
    }
    if (field === "product_id" && val) {
      const p = products.find((p: any) => p.id === val);
      if (p) { lines[idx].description = p.name; lines[idx].unit_price = p.default_purchase_price; lines[idx].total = lines[idx].quantity * p.default_purchase_price; }
    }
    setForm({ ...form, lines });
  };

  const statusColor = (s: string) => {
    if (s === "confirmed" || s === "received") return "default";
    if (s === "cancelled") return "destructive";
    if (s === "sent") return "outline";
    return "secondary";
  };

  const fmt = (n: number, cur: string) => new Intl.NumberFormat("sr-RS", { style: "currency", currency: cur }).format(n);

  const columns: ResponsiveColumn<any>[] = [
    { key: "order_number", label: t("orderNumber"), primary: true, render: (o) => o.order_number },
    { key: "supplier", label: t("supplier"), render: (o) => o.partners?.name || o.supplier_name || "—" },
    { key: "order_date", label: t("orderDate"), render: (o) => o.order_date },
    { key: "expected_date", label: t("expectedDate"), hideOnMobile: true, render: (o) => o.expected_date || "—" },
    { key: "total", label: t("total"), align: "right" as const, render: (o) => fmt(o.total, o.currency) },
    { key: "status", label: t("status"), render: (o) => <Badge variant={statusColor(o.status) as any}>{t(o.status as any) || o.status}</Badge> },
    { key: "actions", label: t("actions"), showInCard: false, render: (o) => (
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(o); }}>{t("edit")}</Button>
        {(o.status === "confirmed" || o.status === "sent") && (
          <>
            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); createGRN(o); }}>
              <Package className="h-3 w-3 mr-1" />{t("createGRN")}
            </Button>
            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); createSupplierInvoice(o); }}>
              <FileText className="h-3 w-3 mr-1" />{t("createSupplierInvoice")}
            </Button>
          </>
        )}
        {o.status === "draft" && (
          <Button size="sm" variant="outline" onClick={(e) => {
            e.stopPropagation();
            checkApproval(o.id, Number(o.total || 0), async () => {
              const { error } = await supabase.from("purchase_orders").update({ status: "confirmed" }).eq("id", o.id);
              if (error) { toast.error(error.message); return; }
              qc.invalidateQueries({ queryKey: ["purchase-orders"] });
              toast.success(t("confirmed"));
            });
          }}>
            {t("confirm")}
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
        title={t("purchaseOrders")}
        description={t("purchaseOrders")}
        icon={ClipboardList}
        actions={<Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />{t("addPurchaseOrder")}</Button>}
      />

      <ResponsiveTable
        data={orders}
        columns={columns}
        keyExtractor={(o) => o.id}
        emptyMessage={t("noResults")}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? t("editPurchaseOrder") : t("addPurchaseOrder")}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="grid gap-2"><Label>{t("orderNumber")} *</Label><Input value={form.order_number} onChange={(e) => setForm({ ...form, order_number: e.target.value })} /></div>
              <div className="grid gap-2">
                <Label>{t("supplier")}</Label>
                <Select value={form.supplier_id || "__none"} onValueChange={(v) => { const s = suppliers.find((s: any) => s.id === v); setForm({ ...form, supplier_id: v === "__none" ? null : v, supplier_name: s?.name || form.supplier_name }); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                    {suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="grid gap-2"><Label>{t("orderDate")}</Label><Input type="date" value={form.order_date} onChange={(e) => setForm({ ...form, order_date: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("expectedDate")}</Label><Input type="date" value={form.expected_date} onChange={(e) => setForm({ ...form, expected_date: e.target.value })} /></div>
              <div className="grid gap-2">
                <Label>{t("currency")}</Label>
                <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RSD">RSD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
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
                    <TableHead>{t("description")}</TableHead>
                    <TableHead className="w-24">{t("quantity")}</TableHead>
                    <TableHead className="w-28">{t("unitPrice")}</TableHead>
                    <TableHead className="w-28 text-right">{t("total")}</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {form.lines.map((line, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <Select value={line.product_id || "__none"} onValueChange={(v) => updateLine(idx, "product_id", v === "__none" ? null : v)}>
                          <SelectTrigger className="h-8"><SelectValue placeholder={t("selectProduct")} /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none">{t("manual")}</SelectItem>
                            {products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell><Input className="h-8" value={line.description} onChange={(e) => updateLine(idx, "description", e.target.value)} /></TableCell>
                      <TableCell><Input className="h-8" type="number" value={line.quantity} onChange={(e) => updateLine(idx, "quantity", +e.target.value)} /></TableCell>
                      <TableCell><Input className="h-8" type="number" value={line.unit_price} onChange={(e) => updateLine(idx, "unit_price", +e.target.value)} /></TableCell>
                      <TableCell className="text-right font-medium">{fmt(line.total, form.currency)}</TableCell>
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
              <div className="text-right font-semibold">{t("total")}: {fmt(form.lines.reduce((s, l) => s + l.total, 0), form.currency)}</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {legalEntities.length > 0 && (
                <div className="grid gap-2">
                  <Label>{t("legalEntity")}</Label>
                  <Select value={form.legal_entity_id || "__none"} onValueChange={(v) => setForm({ ...form, legal_entity_id: v === "__none" ? null : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">—</SelectItem>
                      {legalEntities.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.name} ({e.pib})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
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
            <div className="grid gap-2"><Label>{t("notes")}</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => mutation.mutate(form)} disabled={!form.order_number || mutation.isPending}>
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
