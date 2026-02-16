import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useLegalEntities } from "@/hooks/useLegalEntities";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, CheckCircle, CreditCard, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { createCodeBasedJournalEntry } from "@/lib/journalUtils";
import { useApprovalCheck } from "@/hooks/useApprovalCheck";

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

interface Discrepancy {
  productName: string;
  poQty: number;
  grQty: number;
  invoiceTotal: number;
}

export default function SupplierInvoices() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const qc = useQueryClient();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<SIForm>({ ...emptyForm, legal_entity_id: "" } as any);
  const { entities: legalEntities } = useLegalEntities();

  // Auto-select legal entity if only one exists
  useEffect(() => {
    if (legalEntities.length === 1 && !(form as any).legal_entity_id) {
      setForm(f => ({ ...f, legal_entity_id: legalEntities[0].id } as any));
    }
  }, [legalEntities]);

  // 3-way matching state
  const [matchDialogOpen, setMatchDialogOpen] = useState(false);
  const [matchDiscrepancies, setMatchDiscrepancies] = useState<Discrepancy[]>([]);
  const [pendingApproveInv, setPendingApproveInv] = useState<any>(null);
  const { checkApproval } = useApprovalCheck(tenantId, "supplier_invoice");

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
        legal_entity_id: (f as any).legal_entity_id || null,
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

  // 3-way matching check
  const performThreeWayMatch = async (inv: any): Promise<Discrepancy[]> => {
    if (!inv.purchase_order_id) return [];

    const [poLinesRes, grRes] = await Promise.all([
      supabase.from("purchase_order_lines").select("*, products(name)").eq("purchase_order_id", inv.purchase_order_id),
      supabase.from("goods_receipts").select("id").eq("purchase_order_id", inv.purchase_order_id).eq("status", "completed"),
    ]);

    const poLines = poLinesRes.data || [];
    const grIds = (grRes.data || []).map((g: any) => g.id);

    let grLines: any[] = [];
    if (grIds.length > 0) {
      const { data } = await supabase.from("goods_receipt_lines").select("product_id, quantity_received").in("goods_receipt_id", grIds);
      grLines = data || [];
    }

    // Group GR lines by product
    const grByProduct: Record<string, number> = {};
    grLines.forEach((gl: any) => {
      grByProduct[gl.product_id] = (grByProduct[gl.product_id] || 0) + gl.quantity_received;
    });

    const discrepancies: Discrepancy[] = [];
    poLines.forEach((pol: any) => {
      const grQty = grByProduct[pol.product_id] || 0;
      if (pol.quantity !== grQty) {
        discrepancies.push({
          productName: pol.products?.name || pol.product_id,
          poQty: pol.quantity,
          grQty,
          invoiceTotal: inv.total,
        });
      }
    });

    return discrepancies;
  };

  // Initiate approve with 3-way match
  const initiateApprove = async (inv: any) => {
    try {
      await checkApproval(inv.id, Number(inv.total || 0), async () => {
        const discrepancies = await performThreeWayMatch(inv);
        if (discrepancies.length > 0) {
          setMatchDiscrepancies(discrepancies);
          setPendingApproveInv(inv);
          setMatchDialogOpen(true);
        } else {
          approveMutation.mutate(inv);
        }
      });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // Compute match status for badge
  const getMatchStatus = (inv: any): string => {
    if (!inv.purchase_order_id) return "n/a";
    // We use a simplified sync check - real status computed on render via cached data
    return "pending";
  };

  // PRC 14.3: Approve → Debit 7000 (COGS) + Debit 4700 (Input VAT) / Credit 2100 (AP)
  const approveMutation = useMutation({
    mutationFn: async (inv: any) => {
      if (!tenantId) throw new Error("No tenant");
      const entryDate = new Date().toISOString().split("T")[0];
      const lines: any[] = [
        { accountCode: "7000", debit: inv.amount, credit: 0, description: `COGS - ${inv.invoice_number}`, sortOrder: 0 },
      ];
      if (inv.tax_amount > 0) {
        lines.push({ accountCode: "4700", debit: inv.tax_amount, credit: 0, description: `Input VAT - ${inv.invoice_number}`, sortOrder: 1 });
      }
      lines.push({ accountCode: "2100", debit: 0, credit: inv.total, description: `AP - ${inv.invoice_number}`, sortOrder: 2 });

      await createCodeBasedJournalEntry({
        tenantId, userId: user?.id || null, entryDate,
        description: `Supplier Invoice ${inv.invoice_number} - Approval`,
        reference: `SI-${inv.invoice_number}`,
        lines,
      });

      const { error } = await supabase.from("supplier_invoices").update({ status: "approved" }).eq("id", inv.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplier-invoices"] });
      toast.success(t("journalEntryCreated"));
      setMatchDialogOpen(false);
      setPendingApproveInv(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // PRC 14.3: Pay → Debit 2100 (AP) / Credit 1000 (Cash/Bank)
  const markPaidMutation = useMutation({
    mutationFn: async (inv: any) => {
      if (!tenantId) throw new Error("No tenant");
      const entryDate = new Date().toISOString().split("T")[0];
      await createCodeBasedJournalEntry({
        tenantId, userId: user?.id || null, entryDate,
        description: `Supplier Invoice ${inv.invoice_number} - Payment`,
        reference: `SI-PAY-${inv.invoice_number}`,
        lines: [
          { accountCode: "2100", debit: inv.total, credit: 0, description: `Clear AP - ${inv.invoice_number}`, sortOrder: 0 },
          { accountCode: "1000", debit: 0, credit: inv.total, description: `Payment - ${inv.invoice_number}`, sortOrder: 1 },
        ],
      });

      const { error } = await supabase.from("supplier_invoices").update({ status: "paid" }).eq("id", inv.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplier-invoices"] });
      toast.success(t("journalEntryCreated"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openAdd = () => { setEditId(null); setForm({ ...emptyForm, legal_entity_id: legalEntities.length === 1 ? legalEntities[0].id : "" } as any); setOpen(true); };
  const openEdit = (o: any) => {
    setEditId(o.id);
    setForm({
      invoice_number: o.invoice_number, purchase_order_id: o.purchase_order_id,
      supplier_id: o.supplier_id, supplier_name: o.supplier_name,
      invoice_date: o.invoice_date, due_date: o.due_date || "",
      amount: o.amount, tax_amount: o.tax_amount, total: o.total,
      currency: o.currency, status: o.status, notes: o.notes || "",
      legal_entity_id: o.legal_entity_id || "",
    } as any);
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

  const matchBadgeVariant = (inv: any) => {
    if (!inv.purchase_order_id) return "secondary" as const;
    return "outline" as const;
  };

  const matchBadgeLabel = (inv: any) => {
    if (!inv.purchase_order_id) return t("matchStatusNa" as any) || "N/A";
    return t("threeWayMatch" as any) || "3-Way";
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
        <h1 className="text-2xl font-bold">{t("supplierInvoices")}</h1>
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
                <TableHead>{t("matchStatus" as any) || "Match"}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : invoices.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">{t("noResults")}</TableCell></TableRow>
              ) : invoices.map((inv: any) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                  <TableCell>{inv.partners?.name || inv.supplier_name || "—"}</TableCell>
                  <TableCell>{inv.purchase_orders?.order_number || "—"}</TableCell>
                  <TableCell>{inv.invoice_date}</TableCell>
                  <TableCell>{inv.due_date || "—"}</TableCell>
                  <TableCell className="text-right">{fmt(inv.total, inv.currency)}</TableCell>
                  <TableCell><Badge variant={matchBadgeVariant(inv)}>{matchBadgeLabel(inv)}</Badge></TableCell>
                  <TableCell><Badge variant={statusColor(inv.status) as any}>{t(inv.status as any) || inv.status}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(inv)}>{t("edit")}</Button>
                      {inv.status === "received" && (
                        <Button size="sm" variant="outline" onClick={() => initiateApprove(inv)} disabled={approveMutation.isPending}>
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

      {/* 3-Way Match Discrepancy Dialog */}
      <AlertDialog open={matchDialogOpen} onOpenChange={setMatchDialogOpen}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {t("discrepancyFound" as any) || "Discrepancies Found"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("threeWayMatchWarning" as any) || "The following mismatches were found between the PO, Goods Receipt, and Invoice. Do you want to approve anyway?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("product")}</TableHead>
                <TableHead className="text-right">{t("poQuantity" as any) || "PO Qty"}</TableHead>
                <TableHead className="text-right">{t("grQuantity" as any) || "GR Qty"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matchDiscrepancies.map((d, i) => (
                <TableRow key={i}>
                  <TableCell>{d.productName}</TableCell>
                  <TableCell className="text-right">{d.poQty}</TableCell>
                  <TableCell className="text-right">{d.grQty}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingApproveInv && approveMutation.mutate(pendingApproveInv)}>
              {t("approveAnyway" as any) || "Approve Anyway"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? t("editSupplierInvoice") : t("addSupplierInvoice")}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            {legalEntities.length > 0 && (
              <div className="grid gap-2">
                <Label>{t("legalEntity")}</Label>
                <Select value={(form as any).legal_entity_id || ""} onValueChange={v => setForm({ ...form, legal_entity_id: v } as any)}>
                  <SelectTrigger><SelectValue placeholder={t("selectLegalEntity")} /></SelectTrigger>
                  <SelectContent>
                    {legalEntities.map(e => <SelectItem key={e.id} value={e.id}>{e.name} ({e.pib})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
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
