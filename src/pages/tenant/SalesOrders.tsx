import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useLegalEntities } from "@/hooks/useLegalEntities";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, FileText, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/shared/ResponsiveTable";

const STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"] as const;

interface SalesOrderForm {
  order_number: string;
  quote_id: string | null;
  partner_id: string | null;
  partner_name: string;
  order_date: string;
  status: string;
  currency: string;
  notes: string;
  salesperson_id: string | null;
  legal_entity_id: string | null;
  warehouse_id: string | null;
}

const emptyForm: SalesOrderForm = {
  order_number: "", quote_id: null, partner_id: null, partner_name: "",
  order_date: new Date().toISOString().split("T")[0], status: "pending",
  currency: "RSD", notes: "", salesperson_id: null, legal_entity_id: null, warehouse_id: null,
};

export default function SalesOrders() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { entities: legalEntities } = useLegalEntities();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<SalesOrderForm>(emptyForm);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["sales-orders", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("sales_orders")
        .select("*, partners(name), quotes(quote_number), salespeople(first_name, last_name), legal_entities(name), warehouses(name)")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: partners = [] } = useQuery({
    queryKey: ["partners-list", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("partners").select("id, name").eq("tenant_id", tenantId!).eq("is_active", true).order("name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: quotes = [] } = useQuery({
    queryKey: ["quotes-accepted", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("quotes").select("id, quote_number").eq("tenant_id", tenantId!).order("quote_number");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: salespeople = [] } = useQuery({
    queryKey: ["salespeople-list", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("salespeople").select("id, first_name, last_name").eq("tenant_id", tenantId!).eq("is_active", true).order("first_name");
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

  const mutation = useMutation({
    mutationFn: async (f: SalesOrderForm) => {
      const payload = {
        ...f, tenant_id: tenantId!,
        partner_id: f.partner_id || null,
        quote_id: f.quote_id || null,
        salesperson_id: f.salesperson_id || null,
        legal_entity_id: f.legal_entity_id || null,
        warehouse_id: f.warehouse_id || null,
      };
      if (editId) {
        const { error } = await supabase.from("sales_orders").update(payload).eq("id", editId);
        if (error) throw error;
        const oldOrder = orders.find((o: any) => o.id === editId);
        const oldStatus = oldOrder?.status;
        if (oldStatus !== f.status) {
          if (f.status === "confirmed" && oldStatus !== "confirmed") {
            await emitStockEvent(editId, "sales_order.confirmed");
          } else if (f.status === "cancelled" && oldStatus === "confirmed") {
            await emitStockEvent(editId, "sales_order.cancelled");
          }
        }
      } else {
        const { data: inserted, error } = await supabase.from("sales_orders").insert([payload]).select("id").single();
        if (error) throw error;
        if (f.status === "confirmed" && inserted) {
          await emitStockEvent(inserted.id, "sales_order.confirmed");
        }
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sales-orders"] }); setOpen(false); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const emitStockEvent = async (orderId: string, eventType: string) => {
    try {
      const { data: evt } = await supabase.from("module_events").insert({
        tenant_id: tenantId!,
        event_type: eventType,
        source_module: "sales",
        entity_type: "sales_order",
        entity_id: orderId,
        payload: {},
      }).select("id").single();
      if (evt) {
        await supabase.functions.invoke("process-module-event", { body: { event_id: evt.id } });
      }
    } catch { /* best effort */ }
  };

  const openAdd = () => { setEditId(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (o: any) => {
    setEditId(o.id);
    setForm({
      order_number: o.order_number, quote_id: o.quote_id, partner_id: o.partner_id,
      partner_name: o.partner_name, order_date: o.order_date, status: o.status,
      currency: o.currency, notes: o.notes || "", salesperson_id: o.salesperson_id || null,
      legal_entity_id: o.legal_entity_id || null, warehouse_id: o.warehouse_id || null,
    });
    setOpen(true);
  };

  const createInvoice = async (o: any) => {
    // Fetch sales order lines to carry over to invoice
    const { data: soLines } = await supabase.from("sales_order_lines").select("*").eq("sales_order_id", o.id).order("sort_order");
    navigate("/accounting/invoices/new", {
      state: {
        fromSalesOrder: {
          partner_id: o.partner_id,
          partner_name: o.partners?.name || o.partner_name,
          currency: o.currency,
          notes: `From Sales Order ${o.order_number}`,
          sales_order_id: o.id,
          salesperson_id: o.salesperson_id,
          legal_entity_id: o.legal_entity_id,
          lines: soLines?.map((l: any) => ({
            product_id: l.product_id,
            description: l.description,
            quantity: l.quantity,
            unit_price: l.unit_price,
          })) || [],
        },
      },
    });
  };

  const statusColor = (s: string) => {
    if (s === "delivered") return "default";
    if (s === "cancelled") return "destructive";
    if (s === "shipped") return "outline";
    return "secondary";
  };

  const fmt = (n: number, cur: string) =>
    new Intl.NumberFormat("sr-RS", { style: "currency", currency: cur }).format(n);

  const columns: ResponsiveColumn<any>[] = [
    { key: "order_number", label: t("orderNumber"), primary: true, render: (o) => (
      <button className="text-primary hover:underline font-medium" onClick={(e) => { e.stopPropagation(); navigate(`/sales/sales-orders/${o.id}`); }}>
        {o.order_number}
      </button>
    ) },
    { key: "partner", label: t("partner"), render: (o) => o.partners?.name || o.partner_name || "—" },
    { key: "salesperson", label: t("salesperson"), hideOnMobile: true, render: (o) => o.salespeople ? `${o.salespeople.first_name} ${o.salespeople.last_name}` : "—" },
    { key: "quote", label: t("quote"), hideOnMobile: true, render: (o) => o.quotes?.quote_number || "—" },
    { key: "order_date", label: t("orderDate"), render: (o) => o.order_date },
    { key: "total", label: t("total"), align: "right" as const, render: (o) => fmt(o.total, o.currency) },
    { key: "status", label: t("status"), render: (o) => <Badge variant={statusColor(o.status) as any}>{t(o.status as any) || o.status}</Badge> },
    { key: "actions", label: t("actions"), showInCard: false, render: (o) => (
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(o); }}>{t("edit")}</Button>
        {(o.status === "confirmed" || o.status === "delivered") && (
          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); createInvoice(o); }}>
            <FileText className="h-3 w-3 mr-1" />{t("createInvoiceFromOrder")}
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
        title={t("salesOrders")}
        description={t("salesOrders")}
        icon={ShoppingCart}
        actions={<Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />{t("addSalesOrder")}</Button>}
      />

      <ResponsiveTable
        data={orders}
        columns={columns}
        keyExtractor={(o) => o.id}
        emptyMessage={t("noResults")}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? t("editSalesOrder") : t("addSalesOrder")}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>{t("orderNumber")} *</Label><Input value={form.order_number} onChange={(e) => setForm({ ...form, order_number: e.target.value })} /></div>
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
                <Label>{t("partner")}</Label>
                <Select value={form.partner_id || "__none"} onValueChange={(v) => { const p = partners.find((p: any) => p.id === v); setForm({ ...form, partner_id: v === "__none" ? null : v, partner_name: p?.name || form.partner_name }); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                    {partners.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{t("quote")}</Label>
                <Select value={form.quote_id || "__none"} onValueChange={(v) => setForm({ ...form, quote_id: v === "__none" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                    {quotes.map((q: any) => <SelectItem key={q.id} value={q.id}>{q.quote_number}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>{t("orderDate")}</Label><Input type="date" value={form.order_date} onChange={(e) => setForm({ ...form, order_date: e.target.value })} /></div>
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
            <div className="grid gap-2">
              <Label>{t("salesperson")}</Label>
              <Select value={form.salesperson_id || "__none"} onValueChange={(v) => setForm({ ...form, salesperson_id: v === "__none" ? null : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  {salespeople.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.first_name} {s.last_name}</SelectItem>)}
                </SelectContent>
              </Select>
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