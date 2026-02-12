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
import { Plus, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

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
}

const emptyForm: SalesOrderForm = {
  order_number: "", quote_id: null, partner_id: null, partner_name: "",
  order_date: new Date().toISOString().split("T")[0], status: "pending",
  currency: "RSD", notes: "",
};

export default function SalesOrders() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
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
        .select("*, partners(name), quotes(quote_number)")
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

  const mutation = useMutation({
    mutationFn: async (f: SalesOrderForm) => {
      const payload = {
        ...f, tenant_id: tenantId!,
        partner_id: f.partner_id || null,
        quote_id: f.quote_id || null,
      };
      if (editId) {
        const { error } = await supabase.from("sales_orders").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("sales_orders").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sales-orders"] }); setOpen(false); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openAdd = () => { setEditId(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (o: any) => {
    setEditId(o.id);
    setForm({
      order_number: o.order_number, quote_id: o.quote_id, partner_id: o.partner_id,
      partner_name: o.partner_name, order_date: o.order_date, status: o.status,
      currency: o.currency, notes: o.notes || "",
    });
    setOpen(true);
  };

  const createInvoice = (o: any) => {
    navigate("/accounting/invoices/new", {
      state: {
        fromSalesOrder: {
          partner_id: o.partner_id,
          partner_name: o.partners?.name || o.partner_name,
          currency: o.currency,
          notes: `From Sales Order ${o.order_number}`,
          sales_order_id: o.id,
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("salesOrders")}</h1>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />{t("addSalesOrder")}</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("orderNumber")}</TableHead>
                <TableHead>{t("partner")}</TableHead>
                <TableHead>{t("quote")}</TableHead>
                <TableHead>{t("orderDate")}</TableHead>
                <TableHead className="text-right">{t("total")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : orders.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">{t("noResults")}</TableCell></TableRow>
              ) : orders.map((o: any) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.order_number}</TableCell>
                  <TableCell>{o.partners?.name || o.partner_name || "—"}</TableCell>
                  <TableCell>{o.quotes?.quote_number || "—"}</TableCell>
                  <TableCell>{o.order_date}</TableCell>
                  <TableCell className="text-right">{fmt(o.total, o.currency)}</TableCell>
                  <TableCell><Badge variant={statusColor(o.status) as any}>{t(o.status as any) || o.status}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(o)}>{t("edit")}</Button>
                      {(o.status === "confirmed" || o.status === "delivered") && (
                        <Button size="sm" variant="outline" onClick={() => createInvoice(o)}>
                          <FileText className="h-3 w-3 mr-1" />{t("createInvoiceFromOrder")}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? t("editSalesOrder") : t("addSalesOrder")}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
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
            <div className="grid grid-cols-2 gap-4">
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
            <div className="grid grid-cols-2 gap-4">
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
