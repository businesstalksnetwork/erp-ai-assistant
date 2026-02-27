import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { useLegalEntities } from "@/hooks/useLegalEntities";
import { usePdvPeriodCheck } from "@/hooks/usePdvPeriodCheck";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, ArrowLeft, Save, Send, BookOpen, AlertTriangle, FileText } from "lucide-react";
import { format } from "date-fns";
import { fmtNum } from "@/lib/utils";
import GlPostingPreview from "@/components/accounting/GlPostingPreview";
import { PartnerQuickAdd } from "@/components/accounting/PartnerQuickAdd";
import { PopdvFieldSelect } from "@/components/accounting/PopdvFieldSelect";
import { postWithRuleOrFallback } from "@/lib/postingHelper";

import {
  EFAKTURA_OPTIONS,
  calcInvoiceLine,
  emptyInvoiceLine,
  type InvoiceLineCalc,
} from "@/lib/lineCalculations";

type InvoiceLine = InvoiceLineCalc;

const emptyLine = emptyInvoiceLine;
const calcLine = calcInvoiceLine;

export default function InvoiceForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dueDate, setDueDate] = useState("");
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>("");
  const [partnerName, setPartnerName] = useState("");
  const [partnerPib, setPartnerPib] = useState("");
  const [partnerAddress, setPartnerAddress] = useState("");
  const [currency, setCurrency] = useState("RSD");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("draft");
  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const [vatDate, setVatDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [invoiceType, setInvoiceType] = useState<"regular" | "advance" | "advance_final" | "proforma" | "credit_note" | "debit_note">("regular");
  const [advanceInvoiceId, setAdvanceInvoiceId] = useState<string>("");
  const [advanceAmountApplied, setAdvanceAmountApplied] = useState(0);
  const [legalEntityId, setLegalEntityId] = useState<string>("");
  const [salespersonId, setSalespersonId] = useState<string>("");
  const [salesOrderId, setSalesOrderId] = useState<string | null>(null);
  const { entities: legalEntities } = useLegalEntities();
  const [partnerQuickAddOpen, setPartnerQuickAddOpen] = useState(false);

  const { isLocked, periodName } = usePdvPeriodCheck(tenantId, vatDate);

  // Auto-select legal entity if only one exists
  useEffect(() => {
    if (legalEntities.length === 1 && !legalEntityId) {
      setLegalEntityId(legalEntities[0].id);
    }
  }, [legalEntities, legalEntityId]);

  // Fetch partners
  const { data: partners = [] } = useQuery({
    queryKey: ["partners", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partners")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // Fetch salespeople
  const { data: salespeople = [] } = useQuery({
    queryKey: ["salespeople-list", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("salespeople").select("id, first_name, last_name").eq("tenant_id", tenantId!).eq("is_active", true).order("first_name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Fetch advance invoices for linking
  const { data: advanceInvoices = [] } = useQuery({
    queryKey: ["advance_invoices", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices")
        .select("id, invoice_number, total, partner_name, status")
        .eq("tenant_id", tenantId!)
        .eq("invoice_type", "advance")
        .in("status", ["sent", "paid"]);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && invoiceType === "advance_final",
  });

  // Fetch products
  const { data: products = [] } = useQuery({
    queryKey: ["products", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, tax_rates(id, rate)")
        .eq("tenant_id", tenantId!)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // Fetch tax rates
  const { data: taxRates = [] } = useQuery({
    queryKey: ["tax-rates", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tax_rates")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("is_active", true)
        .order("rate", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const defaultTaxRate = taxRates.find((r) => r.is_default) || taxRates[0];

  // Generate invoice number for new invoices
  useEffect(() => {
    if (!isEdit && tenantId) {
      const year = new Date().getFullYear();
      supabase
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .gte("invoice_date", `${year}-01-01`)
        .then(({ count }) => {
          const num = ((count ?? 0) + 1).toString().padStart(5, "0");
          setInvoiceNumber(`INV-${year}-${num}`);
        });
    }
  }, [isEdit, tenantId]);

  // Handle pre-fill from Sales Order
  useEffect(() => {
    const state = location.state as any;
    if (!isEdit && state?.fromSalesOrder) {
      const so = state.fromSalesOrder;
      if (so.partner_id) {
        setSelectedPartnerId(so.partner_id);
        setPartnerName(so.partner_name || "");
      }
      if (so.currency) setCurrency(so.currency);
      if (so.notes) setNotes(so.notes);
      if (so.salesperson_id) setSalespersonId(so.salesperson_id);
      if (so.sales_order_id) setSalesOrderId(so.sales_order_id);
      if (so.legal_entity_id) setLegalEntityId(so.legal_entity_id);
      if (so.lines && so.lines.length > 0 && defaultTaxRate) {
        setLines(so.lines.map((l: any, i: number) => calcLine({
          product_id: l.product_id || undefined,
          description: l.description || "",
          quantity: l.quantity || 1,
          unit_price: l.unit_price || 0,
          tax_rate_id: defaultTaxRate.id,
          tax_rate_value: Number(defaultTaxRate.rate),
          line_total: 0,
          tax_amount: 0,
          total_with_tax: 0,
          sort_order: i,
          item_type: "service",
          popdv_field: "",
          efaktura_category: "",
        })));
      }
      window.history.replaceState({}, document.title);
    }
  }, [location.state, isEdit, defaultTaxRate]);

  // Init empty line when tax rates load
  useEffect(() => {
    if (!isEdit && lines.length === 0 && defaultTaxRate) {
      setLines([emptyLine(0, defaultTaxRate.id, Number(defaultTaxRate.rate))]);
    }
  }, [defaultTaxRate, isEdit, lines.length]);

  // Fetch existing invoice for edit
  const { data: existingInvoice } = useQuery({
    queryKey: ["invoice", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: isEdit,
  });

  const { data: existingLines = [] } = useQuery({
    queryKey: ["invoice-lines", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_lines")
        .select("*")
        .eq("invoice_id", id!)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: isEdit,
  });

  useEffect(() => {
    if (existingInvoice) {
      setInvoiceNumber(existingInvoice.invoice_number);
      setInvoiceDate(existingInvoice.invoice_date);
      setDueDate(existingInvoice.due_date || "");
      setPartnerName(existingInvoice.partner_name);
      setPartnerPib(existingInvoice.partner_pib || "");
      setPartnerAddress(existingInvoice.partner_address || "");
      setCurrency(existingInvoice.currency);
      setNotes(existingInvoice.notes || "");
      setStatus(existingInvoice.status);
      setVatDate((existingInvoice as any).vat_date || existingInvoice.invoice_date);
    }
  }, [existingInvoice]);

  useEffect(() => {
    if (existingLines.length > 0) {
      setLines(
        existingLines.map((l) => ({
          id: l.id,
          description: l.description,
          quantity: Number(l.quantity),
          unit_price: Number(l.unit_price),
          tax_rate_id: l.tax_rate_id || "",
          tax_rate_value: Number(l.tax_rate_value),
          line_total: Number(l.line_total),
          tax_amount: Number(l.tax_amount),
          total_with_tax: Number(l.total_with_tax),
          sort_order: l.sort_order,
          item_type: (l as any).item_type || "service",
          popdv_field: (l as any).popdv_field || "",
          efaktura_category: (l as any).efaktura_category || "",
        }))
      );
    }
  }, [existingLines]);

  const updateLine = (index: number, field: keyof InvoiceLine, value: any) => {
    setLines((prev) => {
      const updated = [...prev];
      const line = { ...updated[index], [field]: value };
      if (field === "tax_rate_id") {
        const rate = taxRates.find((r) => r.id === value);
        line.tax_rate_value = rate ? Number(rate.rate) : 0;
      }
      updated[index] = calcLine(line);
      return updated;
    });
  };

  const addLine = () => {
    if (!defaultTaxRate) return;
    setLines((prev) => [...prev, emptyLine(prev.length, defaultTaxRate.id, Number(defaultTaxRate.rate))]);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const subtotal = useMemo(() => lines.reduce((s, l) => s + l.line_total, 0), [lines]);
  const totalTax = useMemo(() => lines.reduce((s, l) => s + l.tax_amount, 0), [lines]);
  const grandTotal = subtotal + totalTax;

  // Tax breakdown by rate
  const taxBreakdown = useMemo(() => {
    const map: Record<string, { rate: number; name: string; amount: number }> = {};
    lines.forEach((l) => {
      const key = l.tax_rate_id;
      if (!map[key]) {
        const tr = taxRates.find((r) => r.id === key);
        map[key] = { rate: l.tax_rate_value, name: tr?.name || `${l.tax_rate_value}%`, amount: 0 };
      }
      map[key].amount += l.tax_amount;
    });
    return Object.values(map).filter((b) => b.amount > 0);
  }, [lines, taxRates]);

  const saveMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const invoiceData: any = {
        tenant_id: tenantId!,
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        due_date: dueDate || null,
        partner_name: partnerName,
        partner_pib: partnerPib || null,
        partner_address: partnerAddress || null,
        partner_id: selectedPartnerId && selectedPartnerId !== "__manual__" ? selectedPartnerId : null,
        salesperson_id: salespersonId || null,
        sales_order_id: salesOrderId || null,
        subtotal,
        tax_amount: totalTax,
        total: grandTotal,
        currency,
        status: newStatus,
        notes: notes || null,
        created_by: user?.id || null,
        invoice_type: invoiceType,
        advance_invoice_id: advanceInvoiceId || null,
        advance_amount_applied: advanceAmountApplied,
        legal_entity_id: legalEntityId || null,
        voucher_type: null,
        vat_date: vatDate || invoiceDate,
      };

      let invoiceId = id;

      if (isEdit) {
        const { error } = await supabase.from("invoices").update(invoiceData).eq("id", id!);
        if (error) throw error;
        await supabase.from("invoice_lines").delete().eq("invoice_id", id!);
      } else {
        const { data, error } = await supabase.from("invoices").insert(invoiceData).select("id").single();
        if (error) throw error;
        invoiceId = data.id;
      }

      // Insert lines
      const lineInserts = lines.map((l, i) => ({
        invoice_id: invoiceId!,
        product_id: l.product_id || null,
        description: l.description,
        quantity: l.quantity,
        unit_price: l.unit_price,
        tax_rate_id: l.tax_rate_id || null,
        tax_rate_value: l.tax_rate_value,
        line_total: l.line_total,
        tax_amount: l.tax_amount,
        total_with_tax: l.total_with_tax,
        sort_order: i,
        item_type: l.item_type || "service",
        popdv_field: l.popdv_field || null,
        efaktura_category: l.efaktura_category || null,
      }));

      const { error: lineError } = await supabase.from("invoice_lines").insert(lineInserts);
      if (lineError) throw lineError;

      return invoiceId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast({ title: t("success"), description: t("invoiceSaved") });
      navigate("/accounting/invoices");
    },
    onError: (err: any) => {
      toast({ title: t("error"), description: err.message, variant: "destructive" });
    },
  });

  // "Proknjizi" — Post to GL
  const postMutation = useMutation({
    mutationFn: async () => {
      if (!id || !tenantId) throw new Error("Missing invoice or tenant");

      // Build revenue lines by item type
      const revenueByType: Record<string, number> = {};
      lines.forEach((l) => {
        if (l.line_total <= 0) return;
        const type = l.item_type || "service";
        revenueByType[type] = (revenueByType[type] || 0) + l.line_total;
      });

      const revenueAccounts: Record<string, { code: string; name: string }> = {
        goods: { code: "6120", name: "Prihodi od prodaje robe" },
        service: { code: "6500", name: "Prihodi od usluga" },
        product: { code: "6100", name: "Prihodi od prodaje proizvoda" },
      };

      const fallbackLines: Array<{ accountCode: string; debit: number; credit: number; description: string; sortOrder: number }> = [];

      // DR: Kupci
      fallbackLines.push({
        accountCode: invoiceType === "advance" ? "2040" : "2040",
        debit: grandTotal, credit: 0,
        description: `${partnerName} — ${invoiceNumber}`,
        sortOrder: 0,
      });

      // CR: Revenue lines
      let sortOrder = 1;
      Object.entries(revenueByType).forEach(([type, amount]) => {
        const acc = revenueAccounts[type] || revenueAccounts.service;
        fallbackLines.push({
          accountCode: acc.code, debit: 0, credit: amount,
          description: `Prihod — ${invoiceNumber}`,
          sortOrder: sortOrder++,
        });
      });

      // CR: PDV
      if (totalTax > 0) {
        fallbackLines.push({
          accountCode: "4700", debit: 0, credit: totalTax,
          description: `PDV — ${invoiceNumber}`,
          sortOrder: sortOrder++,
        });
      }

      await postWithRuleOrFallback({
        tenantId,
        userId: user?.id || null,
        modelCode: "INVOICE_POST",
        amount: grandTotal,
        entryDate: vatDate || invoiceDate,
        description: `Knjiženje fakture ${invoiceNumber}`,
        reference: `INV:${id}`,
        legalEntityId: legalEntityId || undefined,
        context: { partnerReceivableCode: "2040" },
        currency,
        fallbackLines,
      });

      // Update invoice status to posted
      const { error } = await supabase.from("invoices").update({ status: "posted" }).eq("id", id);
      if (error) throw error;

      // FIFO: consume cost layers for each product line
      for (const line of lines) {
        if (line.product_id && line.quantity > 0) {
          try {
            await supabase.rpc("consume_fifo_layers", {
              p_tenant_id: tenantId,
              p_product_id: line.product_id,
              p_warehouse_id: (line as any).warehouse_id || null,
              p_quantity: line.quantity,
            });
          } catch (e) {
            console.warn("FIFO layer consumption failed for product:", line.product_id, e);
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      toast({ title: t("success"), description: "Faktura je proknjižena u Glavnu knjigu." });
      setStatus("posted");
    },
    onError: (err: any) => {
      toast({ title: t("error"), description: err.message, variant: "destructive" });
    },
  });

  const isReadOnly = status === "sent" || status === "paid" || status === "cancelled" || status === "posted";
  const isProforma = invoiceType === "proforma";
  const canPost = isEdit && status === "sent" && grandTotal > 0 && !isProforma;

  const INVOICE_TYPE_TABS = [
    { value: "regular", label: t("invoiceTypeFinal") },
    { value: "advance", label: t("invoiceTypeAdvance") },
    { value: "proforma", label: t("invoiceTypeProforma") },
    { value: "credit_note", label: t("invoiceTypeCreditNote") },
    { value: "debit_note", label: t("invoiceTypeDebitNote") },
  ];

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/accounting/invoices")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">{isEdit ? t("editInvoice") : t("newInvoice")}</h1>
      </div>

      {/* Invoice Type Tabs */}
      {!isReadOnly && (
        <Tabs value={invoiceType} onValueChange={(v) => setInvoiceType(v as any)} className="w-full">
          <TabsList className="w-full grid grid-cols-5">
            {INVOICE_TYPE_TABS.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value} className="text-xs sm:text-sm">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {/* Proforma notice */}
      {isProforma && (
        <Alert>
          <FileText className="h-4 w-4" />
          <AlertDescription>
            {t("proformaNotice")}
          </AlertDescription>
        </Alert>
      )}

      {/* Locked PDV period warning */}
      {isLocked && (
        <Alert variant="destructive" className="border-yellow-500 bg-yellow-50 text-yellow-900 dark:bg-yellow-950 dark:text-yellow-200">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            PDV period <strong>{periodName}</strong> je zaključen. Knjiženje u ovom periodu nije moguće bez otključavanja.
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <Card>
        <CardHeader><CardTitle>{t("invoiceDetails")}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label>{t("invoiceNumber")}</Label>
            <Input value={invoiceNumber} readOnly className="bg-muted" />
          </div>
          <div>
            <Label>{t("invoiceDate")}</Label>
            <Input type="date" value={invoiceDate} onChange={(e) => { setInvoiceDate(e.target.value); if (vatDate === invoiceDate) setVatDate(e.target.value); }} disabled={isReadOnly} />
          </div>
          <div>
            <Label className={vatDate !== invoiceDate ? "text-yellow-600 font-semibold" : ""}>
              {"Datum PDV"} {vatDate !== invoiceDate && "⚠"}
            </Label>
            <Input type="date" value={vatDate} onChange={(e) => setVatDate(e.target.value)} disabled={isReadOnly}
              className={vatDate !== invoiceDate ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-950" : ""} />
            {periodName && (
              <p className="text-xs text-muted-foreground mt-1">PDV period: <strong>{periodName}</strong></p>
            )}
          </div>
          <div>
            <Label>{t("dueDate")}</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={isReadOnly} />
          </div>
          {/* Invoice type shown as read-only badge in header since tabs control it */}
          <div>
            <Label>{t("invoiceType")}</Label>
            <Input value={INVOICE_TYPE_TABS.find(t => t.value === invoiceType)?.label || invoiceType} readOnly className="bg-muted" />
          </div>
          {invoiceType === "advance_final" && (
            <div className="md:col-span-2">
              <Label>{t("selectAdvanceInvoice")}</Label>
              <Select value={advanceInvoiceId} onValueChange={(v) => {
                setAdvanceInvoiceId(v);
                const adv = advanceInvoices.find(a => a.id === v);
                if (adv) setAdvanceAmountApplied(Number(adv.total));
              }} disabled={isReadOnly}>
                <SelectTrigger><SelectValue placeholder={t("selectAdvanceInvoice")} /></SelectTrigger>
                <SelectContent>
                  {advanceInvoices.map(ai => (
                    <SelectItem key={ai.id} value={ai.id}>{ai.invoice_number} — {ai.partner_name} — {fmtNum(Number(ai.total))}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {advanceAmountApplied > 0 && <p className="text-sm text-muted-foreground mt-1">{t("advanceAmount")}: {fmtNum(advanceAmountApplied)}</p>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legal Entity — hidden when only 1 entity */}
      {legalEntities.length > 1 && (
        <Card>
          <CardHeader><CardTitle>{t("legalEntity")}</CardTitle></CardHeader>
          <CardContent>
            <div className="max-w-sm">
              <Label>{t("selectLegalEntity")}</Label>
              <Select value={legalEntityId} onValueChange={setLegalEntityId} disabled={isReadOnly}>
                <SelectTrigger><SelectValue placeholder={t("selectLegalEntity")} /></SelectTrigger>
                <SelectContent>
                  {legalEntities.map(e => <SelectItem key={e.id} value={e.id}>{e.name} ({e.pib})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Partner */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t("partner")}</CardTitle>
            {!isReadOnly && (
              <Button size="sm" variant="outline" onClick={() => setPartnerQuickAddOpen(true)}>
                <Plus className="h-3 w-3 mr-1" /> {t("addPartner") || "Novi partner"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>{t("selectPartner")}</Label>
            <Select
              value={selectedPartnerId}
              onValueChange={(v) => {
                setSelectedPartnerId(v);
                if (v && v !== "__manual__") {
                  const p = partners.find((p) => p.id === v);
                  if (p) {
                    setPartnerName(p.name);
                    setPartnerPib(p.pib || "");
                    setPartnerAddress([p.address, p.city].filter(Boolean).join(", "));
                  }
                }
              }}
              disabled={isReadOnly}
            >
              <SelectTrigger><SelectValue placeholder={t("selectPartner")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__manual__">{t("noPartner")}</SelectItem>
                {partners.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}{p.pib ? ` (${p.pib})` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>{t("partnerName")}</Label>
              <Input value={partnerName} onChange={(e) => setPartnerName(e.target.value)} disabled={isReadOnly} />
            </div>
            <div>
              <Label>{t("pib")}</Label>
              <Input value={partnerPib} onChange={(e) => setPartnerPib(e.target.value)} disabled={isReadOnly} />
            </div>
            <div>
              <Label>{t("address")}</Label>
              <Input value={partnerAddress} onChange={(e) => setPartnerAddress(e.target.value)} disabled={isReadOnly} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Salesperson */}
      {salespeople.length > 0 && (
        <Card>
          <CardHeader><CardTitle>{t("salesperson")}</CardTitle></CardHeader>
          <CardContent>
            <div className="max-w-sm">
              <Select value={salespersonId || "__none"} onValueChange={(v) => setSalespersonId(v === "__none" ? "" : v)} disabled={isReadOnly}>
                <SelectTrigger><SelectValue placeholder={t("salesperson")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  {salespeople.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.first_name} {s.last_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Line Items */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t("lineItems")}</CardTitle>
            {!isReadOnly && (
              <Button size="sm" variant="outline" onClick={addLine}>
                <Plus className="h-3 w-3 mr-1" /> {t("addLine")}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[120px]">{t("product")}</TableHead>
                <TableHead className="min-w-[120px]">{t("description")}</TableHead>
                <TableHead className="min-w-[90px]">{t("itemType")}</TableHead>
                <TableHead className="min-w-[90px]">POPDV</TableHead>
                <TableHead className="min-w-[90px]">eFaktura</TableHead>
                <TableHead className="min-w-[60px]">{t("quantity")}</TableHead>
                <TableHead className="min-w-[80px]">{t("unitPrice")}</TableHead>
                <TableHead className="min-w-[90px]">{t("taxRate")}</TableHead>
                <TableHead className="text-right min-w-[80px]">{t("lineTotal")}</TableHead>
                <TableHead className="text-right min-w-[80px]">{t("taxAmount")}</TableHead>
                <TableHead className="text-right min-w-[80px]">{t("totalWithTax")}</TableHead>
                {!isReadOnly && <TableHead className="w-[40px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Select
                      value={line.product_id || "__none__"}
                      onValueChange={(v) => {
                        if (v === "__none__") {
                          updateLine(i, "product_id", undefined);
                          return;
                        }
                        const prod = products.find((p) => p.id === v);
                        if (prod) {
                          setLines((prev) => {
                            const updated = [...prev];
                            const l = {
                              ...updated[i],
                              product_id: prod.id,
                              description: prod.name,
                              unit_price: Number(prod.default_sale_price),
                              tax_rate_id: prod.tax_rate_id || updated[i].tax_rate_id,
                              tax_rate_value: prod.tax_rate_id && (prod as any).tax_rates ? Number((prod as any).tax_rates.rate) : updated[i].tax_rate_value,
                            };
                            updated[i] = calcLine(l);
                            return updated;
                          });
                        }
                      }}
                      disabled={isReadOnly}
                    >
                      <SelectTrigger className="h-8"><SelectValue placeholder={t("selectProduct")} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— {t("manual")}</SelectItem>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ""}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      value={line.description}
                      onChange={(e) => updateLine(i, "description", e.target.value)}
                      disabled={isReadOnly}
                      placeholder={t("description")}
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={line.item_type}
                      onValueChange={(v) => updateLine(i, "item_type" as any, v)}
                      disabled={isReadOnly}
                    >
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="goods">{t("itemTypeGoods")}</SelectItem>
                        <SelectItem value="service">{t("itemTypeService")}</SelectItem>
                        <SelectItem value="product">{t("itemTypeProduct")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  {/* POPDV Field */}
                  <TableCell>
                    <PopdvFieldSelect
                      direction="OUTPUT"
                      value={line.popdv_field}
                      onValueChange={(v) => updateLine(i, "popdv_field" as any, v)}
                      disabled={isReadOnly}
                    />
                  </TableCell>
                  {/* eFaktura Category */}
                  <TableCell>
                    <Select
                      value={line.efaktura_category || "__none__"}
                      onValueChange={(v) => updateLine(i, "efaktura_category" as any, v === "__none__" ? "" : v)}
                      disabled={isReadOnly}
                    >
                      <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">—</SelectItem>
                        {EFAKTURA_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      value={line.quantity}
                      onChange={(e) => updateLine(i, "quantity", Number(e.target.value))}
                      disabled={isReadOnly}
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={line.unit_price}
                      onChange={(e) => updateLine(i, "unit_price", Number(e.target.value))}
                      disabled={isReadOnly}
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={line.tax_rate_id}
                      onValueChange={(v) => updateLine(i, "tax_rate_id", v)}
                      disabled={isReadOnly}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {taxRates.map((tr) => (
                          <SelectItem key={tr.id} value={tr.id}>
                            {tr.name} ({Number(tr.rate)}%)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">{fmtNum(line.line_total)}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{fmtNum(line.tax_amount)}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{fmtNum(line.total_with_tax)}</TableCell>
                  {!isReadOnly && (
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => removeLine(i)} disabled={lines.length <= 1}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-end gap-2">
            <div className="flex justify-between w-64">
              <span>{t("subtotal")}:</span>
              <span className="font-mono">{fmtNum(subtotal)} {currency}</span>
            </div>
            {taxBreakdown.map((tb, i) => (
              <div key={i} className="flex justify-between w-64 text-sm text-muted-foreground">
                <span>PDV {tb.name}:</span>
                <span className="font-mono">{fmtNum(tb.amount)} {currency}</span>
              </div>
            ))}
            <Separator className="w-64" />
            <div className="flex justify-between w-64 font-bold text-lg">
              <span>{t("total")}:</span>
              <span className="font-mono">{fmtNum(grandTotal)} {currency}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardContent className="pt-6">
          <Label>{t("notes")}</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={isReadOnly} rows={3} />
        </CardContent>
      </Card>

      {/* GL Posting Preview — hidden for proforma */}
      {!isProforma && (
        <GlPostingPreview
          lines={lines}
          partnerName={partnerName}
          invoiceType={invoiceType}
          currency={currency}
          subtotal={subtotal}
          totalTax={totalTax}
          grandTotal={grandTotal}
        />
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        {!isReadOnly && (
          <>
            {/* Save Draft */}
            <Button variant="outline" onClick={() => saveMutation.mutate("draft")} disabled={saveMutation.isPending}>
              <Save className="h-4 w-4 mr-2" /> {t("saveDraft")}
            </Button>

            {/* Proknjizi (post to GL only) — not for proforma */}
            {!isProforma && (
              <Button
                onClick={() => saveMutation.mutate("sent")}
                disabled={saveMutation.isPending}
                className="bg-primary text-primary-foreground"
              >
                <BookOpen className="h-4 w-4 mr-2" /> {t("postToGL")}
              </Button>
            )}

            {/* Proknjizi i pošalji na SEF — not for proforma */}
            {!isProforma && (
              <Button
                onClick={() => saveMutation.mutate("sent")}
                disabled={saveMutation.isPending}
                variant="default"
              >
                <Send className="h-4 w-4 mr-2" /> {t("postAndSendSEF")}
              </Button>
            )}
          </>
        )}
        {canPost && (
          <Button
            onClick={() => postMutation.mutate()}
            disabled={postMutation.isPending || isLocked}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <BookOpen className="h-4 w-4 mr-2" />
            {postMutation.isPending ? "Knjiženje..." : t("postToGL")}
          </Button>
        )}
        {!isReadOnly && (
          <Button variant="ghost" onClick={() => navigate("/accounting/invoices")}>
            {t("cancel")}
          </Button>
        )}
      </div>

      {/* Partner Quick Add */}
      <PartnerQuickAdd
        open={partnerQuickAddOpen}
        onOpenChange={setPartnerQuickAddOpen}
        tenantId={tenantId!}
        onPartnerCreated={(partner) => {
          queryClient.invalidateQueries({ queryKey: ["partners"] });
          setSelectedPartnerId(partner.id);
          setPartnerName(partner.name);
          setPartnerPib(partner.pib || "");
          setPartnerAddress([partner.address, partner.city].filter(Boolean).join(", "));
        }}
      />
    </div>
  );
}
