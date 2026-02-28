import { useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { EntitySelector } from "@/components/shared/EntitySelector";
import { invoiceFormSchema, type InvoiceFormValues } from "@/lib/invoiceSchema";

import {
  EFAKTURA_OPTIONS,
  calcInvoiceLine,
  emptyInvoiceLine,
} from "@/lib/lineCalculations";

import { useState } from "react";

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
  const { entities: legalEntities } = useLegalEntities();
  const [partnerQuickAddOpen, setPartnerQuickAddOpen] = useState(false);

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      invoiceNumber: "",
      invoiceDate: format(new Date(), "yyyy-MM-dd"),
      dueDate: "",
      vatDate: format(new Date(), "yyyy-MM-dd"),
      selectedPartnerId: "",
      partnerName: "",
      partnerPib: "",
      partnerAddress: "",
      currency: "RSD",
      notes: "",
      status: "draft",
      invoiceType: "regular",
      advanceInvoiceId: "",
      advanceAmountApplied: 0,
      legalEntityId: "",
      salespersonId: "",
      salesOrderId: null,
      lines: [],
    },
  });

  const { fields, append, remove, replace, update } = useFieldArray({
    control: form.control,
    name: "lines",
  });

  const watchedLines = useWatch({ control: form.control, name: "lines" });
  const watchedVatDate = useWatch({ control: form.control, name: "vatDate" });
  const watchedInvoiceType = useWatch({ control: form.control, name: "invoiceType" });
  const watchedInvoiceDate = useWatch({ control: form.control, name: "invoiceDate" });
  const watchedStatus = useWatch({ control: form.control, name: "status" });
  const watchedCurrency = useWatch({ control: form.control, name: "currency" });

  const { isLocked, periodName } = usePdvPeriodCheck(tenantId, watchedVatDate);

  // Auto-select legal entity if only one exists
  useEffect(() => {
    if (legalEntities.length === 1 && !form.getValues("legalEntityId")) {
      form.setValue("legalEntityId", legalEntities[0].id);
    }
  }, [legalEntities, form]);

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
    enabled: !!tenantId && watchedInvoiceType === "advance_final",
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

  // Fetch wholesale default prices for price resolution
  const { data: wholesaleDefaultPrices = [] } = useQuery({
    queryKey: ["wholesale_default_prices", tenantId],
    queryFn: async () => {
      const { data: defaultList } = await supabase
        .from("wholesale_price_lists")
        .select("id")
        .eq("tenant_id", tenantId!)
        .eq("is_default", true)
        .eq("is_active", true)
        .maybeSingle();
      if (!defaultList) return [];
      const { data } = await supabase
        .from("wholesale_prices")
        .select("product_id, price")
        .eq("price_list_id", defaultList.id);
      return data || [];
    },
    enabled: !!tenantId,
  });

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
          form.setValue("invoiceNumber", `INV-${year}-${num}`);
        });
    }
  }, [isEdit, tenantId, form]);

  // Handle pre-fill from Sales Order
  useEffect(() => {
    const state = location.state as any;
    if (!isEdit && state?.fromSalesOrder) {
      const so = state.fromSalesOrder;
      if (so.partner_id) {
        form.setValue("selectedPartnerId", so.partner_id);
        form.setValue("partnerName", so.partner_name || "");
      }
      if (so.currency) form.setValue("currency", so.currency);
      if (so.notes) form.setValue("notes", so.notes);
      if (so.salesperson_id) form.setValue("salespersonId", so.salesperson_id);
      if (so.sales_order_id) form.setValue("salesOrderId", so.sales_order_id);
      if (so.legal_entity_id) form.setValue("legalEntityId", so.legal_entity_id);
      if (so.lines && so.lines.length > 0 && defaultTaxRate) {
        replace(so.lines.map((l: any, i: number) => calcInvoiceLine({
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
  }, [location.state, isEdit, defaultTaxRate, form, replace]);

  // Init empty line when tax rates load
  useEffect(() => {
    if (!isEdit && fields.length === 0 && defaultTaxRate) {
      append(emptyInvoiceLine(0, defaultTaxRate.id, Number(defaultTaxRate.rate)));
    }
  }, [defaultTaxRate, isEdit, fields.length, append]);

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
      form.reset({
        ...form.getValues(),
        invoiceNumber: existingInvoice.invoice_number,
        invoiceDate: existingInvoice.invoice_date,
        dueDate: existingInvoice.due_date || "",
        partnerName: existingInvoice.partner_name,
        partnerPib: existingInvoice.partner_pib || "",
        partnerAddress: existingInvoice.partner_address || "",
        currency: existingInvoice.currency,
        notes: existingInvoice.notes || "",
        status: existingInvoice.status,
        vatDate: (existingInvoice as any).vat_date || existingInvoice.invoice_date,
      });
    }
  }, [existingInvoice, form]);

  useEffect(() => {
    if (existingLines.length > 0) {
      replace(
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
  }, [existingLines, replace]);

  const updateLine = (index: number, field: string, value: any) => {
    const currentLine = form.getValues(`lines.${index}`);
    const updatedLine = { ...currentLine, [field]: value } as any;
    if (field === "tax_rate_id") {
      const rate = taxRates.find((r) => r.id === value);
      updatedLine.tax_rate_value = rate ? Number(rate.rate) : 0;
    }
    const calculated = calcInvoiceLine(updatedLine);
    update(index, calculated);
  };

  const addLine = () => {
    if (!defaultTaxRate) return;
    append(emptyInvoiceLine(fields.length, defaultTaxRate.id, Number(defaultTaxRate.rate)));
  };

  const removeLine = (index: number) => {
    if (fields.length <= 1) return;
    remove(index);
  };

  const lines = watchedLines || [];
  const subtotal = useMemo(() => lines.reduce((s, l) => s + (l?.line_total || 0), 0), [lines]);
  const totalTax = useMemo(() => lines.reduce((s, l) => s + (l?.tax_amount || 0), 0), [lines]);
  const grandTotal = subtotal + totalTax;

  // Tax breakdown by rate
  const taxBreakdown = useMemo(() => {
    const map: Record<string, { rate: number; name: string; amount: number }> = {};
    lines.forEach((l) => {
      if (!l) return;
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
      const values = form.getValues();
      const invoiceData: any = {
        tenant_id: tenantId!,
        invoice_number: values.invoiceNumber,
        invoice_date: values.invoiceDate,
        due_date: values.dueDate || null,
        partner_name: values.partnerName,
        partner_pib: values.partnerPib || null,
        partner_address: values.partnerAddress || null,
        partner_id: values.selectedPartnerId && values.selectedPartnerId !== "__manual__" ? values.selectedPartnerId : null,
        salesperson_id: values.salespersonId || null,
        sales_order_id: values.salesOrderId || null,
        subtotal,
        tax_amount: totalTax,
        total: grandTotal,
        currency: values.currency,
        status: newStatus,
        notes: values.notes || null,
        created_by: user?.id || null,
        invoice_type: values.invoiceType,
        advance_invoice_id: values.advanceInvoiceId || null,
        advance_amount_applied: values.advanceAmountApplied,
        legal_entity_id: values.legalEntityId || null,
        voucher_type: null,
        vat_date: values.vatDate || values.invoiceDate,
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
      const lineInserts = values.lines.map((l, i) => ({
        invoice_id: invoiceId!,
        tenant_id: tenantId!,
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
      const values = form.getValues();

      // Build revenue lines by item type
      const revenueByType: Record<string, number> = {};
      values.lines.forEach((l) => {
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
        accountCode: values.invoiceType === "advance" ? "2040" : "2040",
        debit: grandTotal, credit: 0,
        description: `${values.partnerName} — ${values.invoiceNumber}`,
        sortOrder: 0,
      });

      // CR: Revenue lines
      let sortOrder = 1;
      Object.entries(revenueByType).forEach(([type, amount]) => {
        const acc = revenueAccounts[type] || revenueAccounts.service;
        fallbackLines.push({
          accountCode: acc.code, debit: 0, credit: amount,
          description: `Prihod — ${values.invoiceNumber}`,
          sortOrder: sortOrder++,
        });
      });

      // CR: PDV
      if (totalTax > 0) {
        fallbackLines.push({
          accountCode: "4700", debit: 0, credit: totalTax,
          description: `PDV — ${values.invoiceNumber}`,
          sortOrder: sortOrder++,
        });
      }

      await postWithRuleOrFallback({
        tenantId,
        userId: user?.id || null,
        modelCode: "INVOICE_POST",
        amount: grandTotal,
        entryDate: values.vatDate || values.invoiceDate,
        description: `Knjiženje fakture ${values.invoiceNumber}`,
        reference: `INV:${id}`,
        legalEntityId: values.legalEntityId || undefined,
        context: { partnerReceivableCode: "2040" },
        currency: values.currency,
        fallbackLines,
      });

      // Update invoice status to posted
      const { error } = await supabase.from("invoices").update({ status: "posted" }).eq("id", id);
      if (error) throw error;

      // FIFO: consume cost layers for each product line
      for (const line of values.lines) {
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

      // Emit invoice.posted event for stock deduction via event bus
      const hasProducts = values.lines.some(l => l.product_id);
      if (hasProducts) {
        try {
          const { data: wh } = await supabase
            .from("warehouses")
            .select("id")
            .eq("tenant_id", tenantId)
            .eq("is_active", true)
            .limit(1)
            .single();

          if (wh) {
            const { data: evt } = await supabase.from("module_events").insert({
              tenant_id: tenantId,
              source_module: "invoicing",
              entity_type: "invoice",
              event_type: "invoice.posted",
              entity_id: id,
              payload: { invoice_number: values.invoiceNumber, warehouse_id: wh.id },
            }).select("id").single();
            if (evt) {
              await supabase.functions.invoke("process-module-event", { body: { event_id: evt.id } });
            }
          }
        } catch (e) {
          throw new Error(`Stock deduction failed: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      toast({ title: t("success"), description: "Faktura je proknjižena u Glavnu knjigu." });
      form.setValue("status", "posted");
    },
    onError: (err: any) => {
      toast({ title: t("error"), description: err.message, variant: "destructive" });
    },
  });

  const isReadOnly = watchedStatus === "sent" || watchedStatus === "paid" || watchedStatus === "cancelled" || watchedStatus === "posted";
  const isProforma = watchedInvoiceType === "proforma";
  const canPost = isEdit && watchedStatus === "sent" && grandTotal > 0 && !isProforma;

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
        <Tabs value={watchedInvoiceType} onValueChange={(v) => form.setValue("invoiceType", v as any)} className="w-full">
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
            <Input {...form.register("invoiceNumber")} readOnly className="bg-muted" />
          </div>
          <div>
            <Label>{t("invoiceDate")}</Label>
            <Input type="date" {...form.register("invoiceDate")} onChange={(e) => {
              form.setValue("invoiceDate", e.target.value);
              if (watchedVatDate === watchedInvoiceDate) form.setValue("vatDate", e.target.value);
            }} disabled={isReadOnly} />
          </div>
          <div>
            <Label className={watchedVatDate !== watchedInvoiceDate ? "text-yellow-600 font-semibold" : ""}>
              {"Datum PDV"} {watchedVatDate !== watchedInvoiceDate && "⚠"}
            </Label>
            <Input type="date" {...form.register("vatDate")} disabled={isReadOnly}
              className={watchedVatDate !== watchedInvoiceDate ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-950" : ""} />
            {periodName && (
              <p className="text-xs text-muted-foreground mt-1">PDV period: <strong>{periodName}</strong></p>
            )}
          </div>
          <div>
            <Label>{t("dueDate")}</Label>
            <Input type="date" {...form.register("dueDate")} disabled={isReadOnly} />
          </div>
          {/* Invoice type shown as read-only badge */}
          <div>
            <Label>{t("invoiceType")}</Label>
            <Input value={INVOICE_TYPE_TABS.find(tab => tab.value === watchedInvoiceType)?.label || watchedInvoiceType} readOnly className="bg-muted" />
          </div>
          {watchedInvoiceType === "advance_final" && (
            <div className="md:col-span-2">
              <Label>{t("selectAdvanceInvoice")}</Label>
              <Select value={form.getValues("advanceInvoiceId")} onValueChange={(v) => {
                form.setValue("advanceInvoiceId", v);
                const adv = advanceInvoices.find(a => a.id === v);
                if (adv) form.setValue("advanceAmountApplied", Number(adv.total));
              }} disabled={isReadOnly}>
                <SelectTrigger><SelectValue placeholder={t("selectAdvanceInvoice")} /></SelectTrigger>
                <SelectContent>
                  {advanceInvoices.map(ai => (
                    <SelectItem key={ai.id} value={ai.id}>{ai.invoice_number} — {ai.partner_name} — {fmtNum(Number(ai.total))}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.getValues("advanceAmountApplied") > 0 && <p className="text-sm text-muted-foreground mt-1">{t("advanceAmount")}: {fmtNum(form.getValues("advanceAmountApplied"))}</p>}
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
              <Select value={form.getValues("legalEntityId")} onValueChange={(v) => form.setValue("legalEntityId", v)} disabled={isReadOnly}>
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
            <EntitySelector
              options={[
                { value: "__manual__", label: t("noPartner") },
                ...partners.map((p) => ({
                  value: p.id,
                  label: p.name,
                  sublabel: p.pib || undefined,
                })),
              ]}
              value={form.getValues("selectedPartnerId") || null}
              onValueChange={(v) => {
                const val = v || "";
                form.setValue("selectedPartnerId", val);
                if (val && val !== "__manual__") {
                  const p = partners.find((p) => p.id === val);
                  if (p) {
                    form.setValue("partnerName", p.name);
                    form.setValue("partnerPib", p.pib || "");
                    form.setValue("partnerAddress", [p.address, p.city].filter(Boolean).join(", "));
                  }
                }
              }}
              placeholder={t("selectPartner")}
              disabled={isReadOnly}
              allowClear={false}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>{t("partnerName")}</Label>
              <Input {...form.register("partnerName")} disabled={isReadOnly} />
            </div>
            <div>
              <Label>{t("pib")}</Label>
              <Input {...form.register("partnerPib")} disabled={isReadOnly} />
            </div>
            <div>
              <Label>{t("address")}</Label>
              <Input {...form.register("partnerAddress")} disabled={isReadOnly} />
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
              <Select value={form.getValues("salespersonId") || "__none"} onValueChange={(v) => form.setValue("salespersonId", v === "__none" ? "" : v)} disabled={isReadOnly}>
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
              {fields.map((field, i) => {
                const line = lines[i] || field;
                return (
                <TableRow key={field.id}>
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
                          const currentLine = form.getValues(`lines.${i}`);
                          // Wholesale price resolution: wholesale list → product default
                          const wholesaleEntry = wholesaleDefaultPrices.find((wp: any) => wp.product_id === prod.id);
                          const resolvedPrice = wholesaleEntry ? Number(wholesaleEntry.price) : (Number(prod.default_sale_price) || 0);
                          const l = {
                            ...currentLine,
                            product_id: prod.id,
                            description: prod.name,
                            unit_price: resolvedPrice,
                            tax_rate_id: prod.tax_rate_id || currentLine.tax_rate_id,
                            tax_rate_value: prod.tax_rate_id && (prod as any).tax_rates ? Number((prod as any).tax_rates.rate) : currentLine.tax_rate_value,
                          } as any;
                          update(i, calcInvoiceLine(l));
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
                      onValueChange={(v) => updateLine(i, "item_type", v)}
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
                  <TableCell>
                    <PopdvFieldSelect
                      direction="OUTPUT"
                      value={line.popdv_field}
                      onValueChange={(v) => updateLine(i, "popdv_field", v)}
                      disabled={isReadOnly}
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={line.efaktura_category || "__none__"}
                      onValueChange={(v) => updateLine(i, "efaktura_category", v === "__none__" ? "" : v)}
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
                      <Button size="icon" variant="ghost" onClick={() => removeLine(i)} disabled={fields.length <= 1}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              );
              })}
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
              <span className="font-mono">{fmtNum(subtotal)} {watchedCurrency}</span>
            </div>
            {taxBreakdown.map((tb, i) => (
              <div key={i} className="flex justify-between w-64 text-sm text-muted-foreground">
                <span>PDV {tb.name}:</span>
                <span className="font-mono">{fmtNum(tb.amount)} {watchedCurrency}</span>
              </div>
            ))}
            <Separator className="w-64" />
            <div className="flex justify-between w-64 font-bold text-lg">
              <span>{t("total")}:</span>
              <span className="font-mono">{fmtNum(grandTotal)} {watchedCurrency}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardContent className="pt-6">
          <Label>{t("notes")}</Label>
          <Textarea {...form.register("notes")} disabled={isReadOnly} rows={3} />
        </CardContent>
      </Card>

      {/* GL Posting Preview — hidden for proforma */}
      {!isProforma && (
        <GlPostingPreview
          lines={lines as any}
          partnerName={form.getValues("partnerName")}
          invoiceType={watchedInvoiceType}
          currency={watchedCurrency}
          subtotal={subtotal}
          totalTax={totalTax}
          grandTotal={grandTotal}
        />
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        {!isReadOnly && (
          <>
            <Button variant="outline" onClick={() => saveMutation.mutate("draft")} disabled={saveMutation.isPending}>
              <Save className="h-4 w-4 mr-2" /> {t("saveDraft")}
            </Button>

            {!isProforma && (
              <Button
                onClick={() => saveMutation.mutate("sent")}
                disabled={saveMutation.isPending}
                className="bg-primary text-primary-foreground"
              >
                <BookOpen className="h-4 w-4 mr-2" /> {t("postToGL")}
              </Button>
            )}

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
          form.setValue("selectedPartnerId", partner.id);
          form.setValue("partnerName", partner.name);
          form.setValue("partnerPib", partner.pib || "");
          form.setValue("partnerAddress", [partner.address, partner.city].filter(Boolean).join(", "));
        }}
      />
    </div>
  );
}
