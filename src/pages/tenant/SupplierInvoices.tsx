import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useLegalEntities } from "@/hooks/useLegalEntities";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, CheckCircle, CreditCard, AlertTriangle, FileInput } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { postWithRuleOrFallback } from "@/lib/postingHelper";
import { useApprovalCheck } from "@/hooks/useApprovalCheck";
import { createReverseChargeEntries, isReverseChargeField } from "@/lib/popdvAggregation";
import PostingPreviewPanel, { buildSupplierInvoicePreviewLines, buildSupplierPaymentPreviewLines } from "@/components/accounting/PostingPreviewPanel";
import { PageHeader } from "@/components/shared/PageHeader";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/shared/ResponsiveTable";

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
  type?: "quantity" | "price";
  poUnitPrice?: number;
  invoiceUnitPrice?: number;
}

export default function SupplierInvoices() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const qc = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<SIForm>({ ...emptyForm, legal_entity_id: "" } as any);
  const [previewInv, setPreviewInv] = useState<any>(null);
  const { entities: legalEntities } = useLegalEntities();

  useEffect(() => {
    if (legalEntities.length === 1 && !(form as any).legal_entity_id) {
      setForm(f => ({ ...f, legal_entity_id: legalEntities[0].id } as any));
    }
  }, [legalEntities]);

  const [matchDialogOpen, setMatchDialogOpen] = useState(false);
  const [matchDiscrepancies, setMatchDiscrepancies] = useState<Discrepancy[]>([]);
  const [pendingApproveInv, setPendingApproveInv] = useState<any>(null);
  const { checkApproval } = useApprovalCheck(tenantId, "supplier_invoice");

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

  const performThreeWayMatch = async (inv: any): Promise<Discrepancy[]> => {
    if (!inv.purchase_order_id) return [];
    const [poLinesRes, grRes, invLinesRes] = await Promise.all([
      supabase.from("purchase_order_lines").select("*, products(name)").eq("purchase_order_id", inv.purchase_order_id),
      supabase.from("goods_receipts").select("id").eq("purchase_order_id", inv.purchase_order_id).eq("status", "completed"),
      supabase.from("supplier_invoice_lines").select("product_id, unit_price").eq("supplier_invoice_id", inv.id),
    ]);
    const poLines = poLinesRes.data || [];
    const grIds = (grRes.data || []).map((g: any) => g.id);
    const invLines = invLinesRes.data || [];
    let grLines: any[] = [];
    if (grIds.length > 0) {
      const { data } = await supabase.from("goods_receipt_lines").select("product_id, quantity_received").in("goods_receipt_id", grIds);
      grLines = data || [];
    }
    const grByProduct: Record<string, number> = {};
    grLines.forEach((gl: any) => { grByProduct[gl.product_id] = (grByProduct[gl.product_id] || 0) + gl.quantity_received; });
    // P3-13: Build invoice price map for price comparison
    const invPriceByProduct: Record<string, number> = {};
    invLines.forEach((il: any) => { if (il.product_id) invPriceByProduct[il.product_id] = il.unit_price; });
    const discrepancies: Discrepancy[] = [];
    poLines.forEach((pol: any) => {
      const grQty = grByProduct[pol.product_id] || 0;
      if (pol.quantity !== grQty) {
        discrepancies.push({ productName: pol.products?.name || pol.product_id, poQty: pol.quantity, grQty, invoiceTotal: inv.total, type: "quantity" });
      }
      // P3-13: Price comparison — flag if supplier price differs by > 1%
      const invPrice = invPriceByProduct[pol.product_id];
      if (invPrice != null && pol.unit_price > 0) {
        const priceDiff = Math.abs(invPrice - pol.unit_price) / pol.unit_price;
        if (priceDiff > 0.01) {
          discrepancies.push({ productName: pol.products?.name || pol.product_id, poQty: pol.quantity, grQty, invoiceTotal: inv.total, type: "price", poUnitPrice: pol.unit_price, invoiceUnitPrice: invPrice });
        }
      }
    });
    return discrepancies;
  };

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
    } catch (e: any) { toast.error(e.message); }
  };

  const approveMutation = useMutation({
    mutationFn: async (inv: any) => {
      if (!tenantId) throw new Error("No tenant");
      const entryDate = new Date().toISOString().split("T")[0];
      // P3-02: Fixed from 7000 (Class 7 closing) to 5010 (Nabavna vrednost prodate robe)
      // P3-20: Fixed input VAT from 4700 (output VAT) to 2700 (Potraživanja za pretplatu poreza)
      const fallbackLines: any[] = [
        { accountCode: "5010", debit: inv.amount, credit: 0, description: `Nabavka - ${inv.invoice_number}`, sortOrder: 0 },
      ];
      if (inv.tax_amount > 0) {
        fallbackLines.push({ accountCode: "2700", debit: inv.tax_amount, credit: 0, description: `Ulazni PDV - ${inv.invoice_number}`, sortOrder: 1 });
      }
      fallbackLines.push({ accountCode: "2200", debit: 0, credit: inv.total, description: `Dobavljači - ${inv.invoice_number}`, sortOrder: 2 });
      const taxRate = inv.tax_amount > 0 && inv.amount > 0 ? inv.tax_amount / inv.amount : 0;
      await postWithRuleOrFallback({
        tenantId, userId: user?.id || null, entryDate,
        modelCode: "SUPPLIER_INVOICE_POST", amount: inv.total,
        description: `Supplier Invoice ${inv.invoice_number} - Approval`,
        reference: `SI-${inv.invoice_number}`,
        legalEntityId: inv.legal_entity_id || undefined,
        context: { taxRate },
        fallbackLines,
      });

      // Phase 5: Create reverse charge entries for 8g/8b lines
      try {
        const { data: siLines } = await supabase.from("supplier_invoice_lines")
          .select("id, popdv_field, line_total, tax_amount")
          .eq("supplier_invoice_id", inv.id);
        if (siLines && siLines.length > 0) {
          const rcLines = siLines.filter((l: any) => l.popdv_field && isReverseChargeField(l.popdv_field));
          if (rcLines.length > 0) {
            const vatDate = (inv as any).vat_date || inv.invoice_date;
            await createReverseChargeEntries(tenantId, inv.id, vatDate, rcLines as any);
          }
        }
      } catch (rcErr) {
        console.warn("[ReverseCharge] Failed to create entries:", rcErr);
      }

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

  const markPaidMutation = useMutation({
    mutationFn: async (inv: any) => {
      if (!tenantId) throw new Error("No tenant");
      const entryDate = new Date().toISOString().split("T")[0];
      await postWithRuleOrFallback({
        tenantId, userId: user?.id || null, entryDate,
        modelCode: "SUPPLIER_INVOICE_PAYMENT", amount: inv.total,
        description: `Supplier Invoice ${inv.invoice_number} - Payment`,
        reference: `SI-PAY-${inv.invoice_number}`,
        legalEntityId: inv.legal_entity_id || undefined,
        context: {},
        fallbackLines: [
          { accountCode: "2200", debit: inv.total, credit: 0, description: `Clear AP - ${inv.invoice_number}`, sortOrder: 0 },
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

  const openAdd = () => navigate("/purchasing/supplier-invoices/new");
  const openEdit = (o: any) => navigate(`/purchasing/supplier-invoices/${o.id}`);

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

  const [matchDetail, setMatchDetail] = useState<any>(null);
  const [matchDetailOpen, setMatchDetailOpen] = useState(false);

  const showMatchDetail = async (inv: any) => {
    if (!inv.purchase_order_id) return;
    try {
      const { data, error } = await supabase.rpc("three_way_match", { p_supplier_invoice_id: inv.id });
      if (error) throw error;
      setMatchDetail(data);
      setMatchDetailOpen(true);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const fmt = (n: number, cur: string) => new Intl.NumberFormat("sr-RS", { style: "currency", currency: cur }).format(n);

  const updateAmount = (field: "amount" | "tax_amount", val: number) => {
    const updated = { ...form, [field]: val };
    updated.total = updated.amount + updated.tax_amount;
    setForm(updated);
  };

  const columns: ResponsiveColumn<any>[] = [
    { key: "invoice_number", label: t("invoiceNumber"), primary: true, render: (inv) => inv.invoice_number },
    { key: "supplier", label: t("supplier"), render: (inv) => inv.partners?.name || inv.supplier_name || "—" },
    { key: "purchase_order", label: t("purchaseOrder"), hideOnMobile: true, render: (inv) => inv.purchase_orders?.order_number || "—" },
    { key: "invoice_date", label: t("invoiceDate"), hideOnMobile: true, render: (inv) => inv.invoice_date },
    { key: "due_date", label: t("dueDate"), hideOnMobile: true, render: (inv) => inv.due_date || "—" },
    { key: "total", label: t("total"), align: "right" as const, render: (inv) => fmt(inv.total, inv.currency) },
    { key: "match", label: t("matchStatus" as any) || "Match", render: (inv) => <Badge variant={matchBadgeVariant(inv)} className={inv.purchase_order_id ? "cursor-pointer" : ""} onClick={(e) => { e.stopPropagation(); showMatchDetail(inv); }}>{matchBadgeLabel(inv)}</Badge> },
    { key: "status", label: t("status"), render: (inv) => <Badge variant={statusColor(inv.status) as any}>{t(inv.status as any) || inv.status}</Badge> },
    { key: "actions", label: t("actions"), showInCard: false, render: (inv) => (
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(inv); }}>{t("edit")}</Button>
        {(inv.status === "draft" || inv.status === "received") && (
          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setPreviewInv(inv); }} disabled={approveMutation.isPending}>
            <CheckCircle className="h-3 w-3 mr-1" />{t("approveInvoice")}
          </Button>
        )}
        {inv.status === "approved" && (
          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); markPaidMutation.mutate(inv); }} disabled={markPaidMutation.isPending}>
            <CreditCard className="h-3 w-3 mr-1" />{t("markAsPaidSupplier")}
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
        title={t("supplierInvoices")}
        description={t("supplierInvoices")}
        icon={FileInput}
        actions={<Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />{t("addSupplierInvoice")}</Button>}
      />

      <ResponsiveTable
        data={invoices}
        columns={columns}
        keyExtractor={(inv) => inv.id}
        emptyMessage={t("noResults")}
      />

      {/* Posting Preview Dialog */}
      <Dialog open={!!previewInv} onOpenChange={(o) => { if (!o) setPreviewInv(null); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("glPostingPreview")} — {previewInv?.invoice_number}</DialogTitle>
          </DialogHeader>
          {previewInv && (
            <PostingPreviewPanel lines={buildSupplierInvoicePreviewLines(previewInv)} currency={previewInv.currency} />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewInv(null)}>{t("cancel")}</Button>
            <Button onClick={() => { const inv = previewInv; setPreviewInv(null); initiateApprove(inv); }} disabled={approveMutation.isPending}>
              <CheckCircle className="h-4 w-4 mr-2" />{t("approveInvoice")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


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
        <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
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
                <Label>{t("purchaseOrder")}</Label>
                <Select value={form.purchase_order_id || "__none"} onValueChange={(v) => { if (v !== "__none") linkPO(v); else setForm({ ...form, purchase_order_id: null }); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                    {purchaseOrders.map((po: any) => <SelectItem key={po.id} value={po.id}>{po.order_number}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {legalEntities.length > 1 && (
              <div className="grid gap-2">
                <Label>{t("legalEntity")}</Label>
                <Select value={(form as any).legal_entity_id || "__none"} onValueChange={(v) => setForm({ ...form, legal_entity_id: v === "__none" ? "" : v } as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                    {legalEntities.map((le: any) => <SelectItem key={le.id} value={le.id}>{le.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>{t("invoiceDate")}</Label><Input type="date" value={form.invoice_date} onChange={(e) => setForm({ ...form, invoice_date: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("dueDate")}</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="grid gap-2"><Label>{t("amount")}</Label><Input type="number" value={form.amount} onChange={(e) => updateAmount("amount", +e.target.value)} /></div>
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

      {/* 3-Way Match Detail Dialog */}
      <Dialog open={matchDetailOpen} onOpenChange={setMatchDetailOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("threeWayMatch" as any) || "3-Way Match"}</DialogTitle></DialogHeader>
          {matchDetail && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">{t("total")}:</span> <strong>{Number(matchDetail.invoice_total).toLocaleString("sr-RS")}</strong></div>
                <div><span className="text-muted-foreground">PO {t("total")}:</span> <strong>{Number(matchDetail.po_total).toLocaleString("sr-RS")}</strong></div>
                <div><span className="text-muted-foreground">GR {t("quantity")}:</span> <strong>{matchDetail.gr_quantity}</strong></div>
                <div><span className="text-muted-foreground">{t("variance" as any) || "Variance"}:</span> <strong>{matchDetail.variance_pct != null ? `${matchDetail.variance_pct}%` : "—"}</strong></div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{t("status")}:</span>
                <Badge variant={matchDetail.match_status === "matched" ? "default" : matchDetail.match_status === "discrepancy" ? "destructive" : "secondary"}>
                  {matchDetail.match_status === "matched" ? "✓ Matched" : matchDetail.match_status === "discrepancy" ? "⚠ Discrepancy" : "No PO"}
                </Badge>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}