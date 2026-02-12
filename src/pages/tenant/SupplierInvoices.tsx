import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
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
import { Plus, Loader2, CheckCircle, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";

const STATUSES = ["draft", "received", "approved", "paid", "cancelled"] as const;

interface SIForm {
  invoice_number: string;
  purchase_order_id: string | null;
  supplier_id: string | null;
  supplier_name: string;
  invoice_date: string;
  due_date: string;
  amount: number;
  tax_amount: number;
  total: number;
  currency: string;
  status: string;
  notes: string;
}

const emptyForm: SIForm = {
  invoice_number: "", purchase_order_id: null, supplier_id: null, supplier_name: "",
  invoice_date: new Date().toISOString().split("T")[0], due_date: "",
  amount: 0, tax_amount: 0, total: 0, currency: "RSD", status: "draft", notes: "",
};

export default function SupplierInvoices() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const qc = useQueryClient();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<SIForm>(emptyForm);

  // Handle pre-fill from PurchaseOrders navigation
  useEffect(() => {
    const state = location.state as any;
    if (state?.fromPO) {
      const po = state.fromPO;
      setEditId(null);
      setForm({
        ...emptyForm,
        purchase_order_id: po.purchase_order_id,
        supplier_id: po.supplier_id,
        supplier_name: po.supplier_name || "",
        amount: po.amount || 0,
        total: po.amount || 0,
        currency: po.currency || "RSD",
      });
      setOpen(true);
      // Clear state
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["supplier-invoices", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("supplier_invoices")
        .select("*, partners(name), purchase_orders(order_number)")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
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

  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ["po-for-si", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("purchase_orders").select("id, order_number, supplier_id, supplier_name, total, currency").eq("tenant_id", tenantId!).order("order_number");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const mutation = useMutation({
    mutationFn: async (f: SIForm) => {
      const payload = {
        tenant_id: tenantId!, invoice_number: f.invoice_number,
        purchase_order_id: f.purchase_order_id || null,
        supplier_id: f.supplier_id || null, supplier_name: f.supplier_name,
        invoice_date: f.invoice_date, due_date: f.due_date || null,
        amount: f.amount, tax_amount: f.tax_amount, total: f.total,
        currency: f.currency, status: f.status, notes: f.notes || null,
      };
      if (editId) {
        const { error } = await supabase.from("supplier_invoices").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("supplier_invoices").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["supplier-invoices"] }); setOpen(false); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const createJournalEntry = async (description: string, debitAccountType: string, creditAccountType: string, amount: number, reference: string) => {
    if (!tenantId) return;
    // Find accounts by type
    const { data: accounts } = await supabase
      .from("chart_of_accounts")
      .select("id, account_type, name")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .in("account_type", [debitAccountType, creditAccountType]);

    const debitAccount = accounts?.find(a => a.account_type === debitAccountType);
    const creditAccount = accounts?.find(a => a.account_type === creditAccountType);
    if (!debitAccount || !creditAccount) throw new Error("Required accounts not found in chart of accounts");

    const entryNumber = `JE-${Date.now().toString(36).toUpperCase()}`;
    const { data: je, error: jeError } = await supabase.from("journal_entries").insert([{
      tenant_id: tenantId,
      entry_number: entryNumber,
      entry_date: new Date().toISOString().split("T")[0],
      description,
      reference,
      status: "posted",
      posted_at: new Date().toISOString(),
      posted_by: user?.id || null,
      created_by: user?.id || null,
    }]).select("id").single();
    if (jeError) throw jeError;

    await supabase.from("journal_lines").insert([
      { journal_entry_id: je.id, account_id: debitAccount.id, debit: amount, credit: 0, description, sort_order: 0 },
      { journal_entry_id: je.id, account_id: creditAccount.id, debit: 0, credit: amount, description, sort_order: 1 },
    ]);
  };

  const approveMutation = useMutation({
    mutationFn: async (inv: any) => {
      await createJournalEntry(
        `Supplier Invoice ${inv.invoice_number} - Approval`,
        "expense", "liability",
        inv.total,
        `SI-${inv.invoice_number}`
      );
      const { error } = await supabase.from("supplier_invoices").update({ status: "approved" }).eq("id", inv.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplier-invoices"] });
      toast.success(t("journalEntryCreated"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markPaidMutation = useMutation({
    mutationFn: async (inv: any) => {
      await createJournalEntry(
        `Supplier Invoice ${inv.invoice_number} - Payment`,
        "liability", "asset",
        inv.total,
        `SI-PAY-${inv.invoice_number}`
      );
      const { error } = await supabase.from("supplier_invoices").update({ status: "paid" }).eq("id", inv.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplier-invoices"] });
      toast.success(t("journalEntryCreated"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openAdd = () => { setEditId(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (o: any) => {
    setEditId(o.id);
    setForm({
      invoice_number: o.invoice_number, purchase_order_id: o.purchase_order_id,
      supplier_id: o.supplier_id, supplier_name: o.supplier_name,
      invoice_date: o.invoice_date, due_date: o.due_date || "",
      amount: o.amount, tax_amount: o.tax_amount, total: o.total,
      currency: o.currency, status: o.status, notes: o.notes || "",
    });
    setOpen(true);
  };

  const linkPO = (poId: string) => {
    const po = purchaseOrders.find((p: any) => p.id === poId);
    if (po) {
      setForm(f => ({
        ...f, purchase_order_id: poId, supplier_id: po.supplier_id,
        supplier_name: po.supplier_name, amount: po.total, total: po.total, currency: po.currency,
      }));
    }
  };

  const statusColor = (s: string) => {
    if (s === "paid") return "default";
    if (s === "approved") return "outline";
    if (s === "cancelled") return "destructive";
    return "secondary";
  };

  const fmt = (n: number, cur: string) => new Intl.NumberFormat("sr-RS", { style: "currency", currency: cur }).format(n);

  const updateAmount = (field: "amount" | "tax_amount", val: number) => {
    const updated = { ...form, [field]: val };
    updated.total = updated.amount + updated.tax_amount;
    setForm(updated);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("supplierInvoices")}</h1>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />{t("addSupplierInvoice")}</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("invoiceNumber")}</TableHead>
                <TableHead>{t("supplier")}</TableHead>
                <TableHead>{t("purchaseOrder")}</TableHead>
                <TableHead>{t("invoiceDate")}</TableHead>
                <TableHead>{t("dueDate")}</TableHead>
                <TableHead className="text-right">{t("total")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : invoices.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">{t("noResults")}</TableCell></TableRow>
              ) : invoices.map((inv: any) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                  <TableCell>{inv.partners?.name || inv.supplier_name || "—"}</TableCell>
                  <TableCell>{inv.purchase_orders?.order_number || "—"}</TableCell>
                  <TableCell>{inv.invoice_date}</TableCell>
                  <TableCell>{inv.due_date || "—"}</TableCell>
                  <TableCell className="text-right">{fmt(inv.total, inv.currency)}</TableCell>
                  <TableCell><Badge variant={statusColor(inv.status) as any}>{t(inv.status as any) || inv.status}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(inv)}>{t("edit")}</Button>
                      {inv.status === "received" && (
                        <Button size="sm" variant="outline" onClick={() => approveMutation.mutate(inv)} disabled={approveMutation.isPending}>
                          <CheckCircle className="h-3 w-3 mr-1" />{t("approveInvoice")}
                        </Button>
                      )}
                      {inv.status === "approved" && (
                        <Button size="sm" variant="outline" onClick={() => markPaidMutation.mutate(inv)} disabled={markPaidMutation.isPending}>
                          <CreditCard className="h-3 w-3 mr-1" />{t("markAsPaidSupplier")}
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
          <DialogHeader><DialogTitle>{editId ? t("editSupplierInvoice") : t("addSupplierInvoice")}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>{t("invoiceNumber")} *</Label><Input value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} /></div>
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
                <Select value={form.purchase_order_id || "__none"} onValueChange={(v) => { if (v !== "__none") linkPO(v); else setForm({ ...form, purchase_order_id: null }); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                    {purchaseOrders.map((po: any) => <SelectItem key={po.id} value={po.id}>{po.order_number}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
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
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>{t("invoiceDate")}</Label><Input type="date" value={form.invoice_date} onChange={(e) => setForm({ ...form, invoice_date: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("dueDate")}</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2"><Label>{t("invoiceAmount")}</Label><Input type="number" value={form.amount} onChange={(e) => updateAmount("amount", +e.target.value)} /></div>
              <div className="grid gap-2"><Label>{t("taxAmount")}</Label><Input type="number" value={form.tax_amount} onChange={(e) => updateAmount("tax_amount", +e.target.value)} /></div>
              <div className="grid gap-2"><Label>{t("total")}</Label><Input type="number" value={form.total} disabled /></div>
            </div>
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
            <div className="grid gap-2"><Label>{t("notes")}</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => mutation.mutate(form)} disabled={!form.invoice_number || mutation.isPending}>
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
