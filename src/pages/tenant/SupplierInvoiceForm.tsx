import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, ArrowLeft, Save, CheckCircle, AlertTriangle } from "lucide-react";
import { fmtNum } from "@/lib/utils";
import { PopdvFieldSelect } from "@/components/accounting/PopdvFieldSelect";
import { PartnerQuickAdd } from "@/components/accounting/PartnerQuickAdd";
import PostingPreviewPanel, { buildSupplierInvoicePreviewLines } from "@/components/accounting/PostingPreviewPanel";
import { createReverseChargeEntries, isReverseChargeField } from "@/lib/popdvAggregation";
import { EntitySelector } from "@/components/shared/EntitySelector";
import { supplierInvoiceFormSchema, type SupplierInvoiceFormValues } from "@/lib/invoiceSchema";

import {
  EFAKTURA_OPTIONS,
  calcSupplierInvoiceLine,
  emptySupplierInvoiceLine,
  isFeeField,
  isForeignPib,
} from "@/lib/lineCalculations";

export default function SupplierInvoiceForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { entities: legalEntities } = useLegalEntities();
  const [partnerQuickAddOpen, setPartnerQuickAddOpen] = useState(false);

  const form = useForm<SupplierInvoiceFormValues>({
    resolver: zodResolver(supplierInvoiceFormSchema),
    defaultValues: {
      invoiceNumber: "",
      invoiceDate: new Date().toISOString().split("T")[0],
      vatDate: new Date().toISOString().split("T")[0],
      dueDate: "",
      supplierId: "",
      supplierName: "",
      purchaseOrderId: "",
      currency: "RSD",
      notes: "",
      status: "draft",
      legalEntityId: "",
      isForeignSupplier: false,
      lines: [],
    },
  });

  const { fields, append, remove, replace, update } = useFieldArray({
    control: form.control,
    name: "lines",
  });

  const watchedLines = useWatch({ control: form.control, name: "lines" });
  const watchedVatDate = useWatch({ control: form.control, name: "vatDate" });
  const watchedInvoiceDate = useWatch({ control: form.control, name: "invoiceDate" });
  const watchedStatus = useWatch({ control: form.control, name: "status" });
  const watchedCurrency = useWatch({ control: form.control, name: "currency" });
  const watchedIsForeignSupplier = useWatch({ control: form.control, name: "isForeignSupplier" });

  const { isLocked, periodName } = usePdvPeriodCheck(tenantId, watchedVatDate);

  useEffect(() => {
    if (legalEntities.length === 1 && !form.getValues("legalEntityId")) form.setValue("legalEntityId", legalEntities[0].id);
  }, [legalEntities, form]);

  useEffect(() => { if (!isEdit) form.setValue("vatDate", watchedInvoiceDate); }, [watchedInvoiceDate, isEdit, form]);

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-list", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("partners").select("id, name, pib, address, city, country").eq("tenant_id", tenantId!).eq("is_active", true).in("type", ["supplier", "both"]).order("name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: costCenters = [] } = useQuery({
    queryKey: ["cost-centers", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("cost_centers").select("id, code, name").eq("tenant_id", tenantId!).eq("is_active", true).order("code");
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

  const { data: taxRates = [] } = useQuery({
    queryKey: ["tax-rates", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("tax_rates").select("*").eq("tenant_id", tenantId!).eq("is_active", true).order("rate", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["gl-accounts", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("chart_of_accounts").select("id, code, name").eq("tenant_id", tenantId!).eq("is_active", true).order("code");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const defaultTaxRate = taxRates.find((r) => r.is_default) || taxRates[0];

  const handleSupplierChange = (v: string) => {
    if (v && v !== "__none") {
      const s = suppliers.find((s: any) => s.id === v);
      form.setValue("supplierId", v);
      form.setValue("supplierName", s?.name || "");
      const foreign = isForeignPib(s?.pib) || (s?.country && !["RS", "SRB", "Srbija", "Serbia"].includes(s.country));
      form.setValue("isForeignSupplier", !!foreign);
      if (foreign && !isEdit) {
        const currentLines = form.getValues("lines");
        replace(currentLines.map((l) => ({ ...l, popdv_field: l.popdv_field || "8g.1" })));
      }
    } else {
      form.setValue("supplierId", "");
      form.setValue("supplierName", "");
      form.setValue("isForeignSupplier", false);
    }
  };

  // Init empty line
  useEffect(() => {
    if (!isEdit && fields.length === 0 && defaultTaxRate) {
      append(emptySupplierInvoiceLine(0, defaultTaxRate.id, Number(defaultTaxRate.rate)));
    }
  }, [defaultTaxRate, isEdit, fields.length, append]);

  // Fetch existing invoice
  const { data: existing } = useQuery({
    queryKey: ["supplier-invoice", id],
    queryFn: async () => {
      const { data } = await supabase.from("supplier_invoices").select("*").eq("id", id!).single();
      return data;
    },
    enabled: isEdit,
  });

  const { data: existingLines = [] } = useQuery({
    queryKey: ["supplier-invoice-lines", id],
    queryFn: async () => {
      const { data } = await supabase.from("supplier_invoice_lines").select("*").eq("supplier_invoice_id", id!).order("sort_order");
      return data || [];
    },
    enabled: isEdit,
  });

  useEffect(() => {
    if (existing) {
      form.reset({
        ...form.getValues(),
        invoiceNumber: existing.invoice_number,
        invoiceDate: existing.invoice_date,
        vatDate: existing.vat_date || existing.invoice_date,
        dueDate: existing.due_date || "",
        supplierId: existing.supplier_id || "",
        supplierName: existing.supplier_name,
        purchaseOrderId: existing.purchase_order_id || "",
        currency: existing.currency,
        notes: existing.notes || "",
        status: existing.status,
        legalEntityId: existing.legal_entity_id || "",
      });
    }
  }, [existing, form]);

  useEffect(() => {
    if (existingLines.length > 0) {
      replace(existingLines.map((l: any) => ({
        id: l.id, description: l.description || "", item_type: l.item_type || "service",
        popdv_field: l.popdv_field || "", efaktura_category: l.efaktura_category || "",
        quantity: Number(l.quantity), unit_price: Number(l.unit_price),
        tax_rate_id: l.tax_rate_id || "", tax_rate_value: Number(l.tax_rate_value || 0),
        line_total: Number(l.line_total), tax_amount: Number(l.tax_amount),
        total_with_tax: Number(l.total_with_tax), vat_non_deductible: Number(l.vat_non_deductible || 0),
        fee_value: Number(l.fee_value || 0), account_id: l.account_id || "",
        cost_center_id: (l as any).cost_center_id || "", sort_order: l.sort_order,
      })));
    }
  }, [existingLines, replace]);

  const updateLine = (index: number, field: string, value: any) => {
    const currentLine = form.getValues(`lines.${index}`);
    const updatedLine = { ...currentLine, [field]: value } as any;
    if (field === "tax_rate_id") {
      const rate = taxRates.find((r) => r.id === value);
      updatedLine.tax_rate_value = rate ? Number(rate.rate) : 0;
    }
    update(index, calcSupplierInvoiceLine(updatedLine));
  };

  const addLine = () => {
    if (!defaultTaxRate) return;
    const defaultPopdv = watchedIsForeignSupplier ? "8g.1" : "";
    append(emptySupplierInvoiceLine(fields.length, defaultTaxRate.id, Number(defaultTaxRate.rate), defaultPopdv));
  };

  const removeLine = (index: number) => {
    if (fields.length <= 1) return;
    remove(index);
  };

  const splitLine = (index: number) => {
    const original = form.getValues(`lines.${index}`) as any;
    const deductibleLine = calcSupplierInvoiceLine({
      ...original,
      popdv_field: original.popdv_field.startsWith("8a") ? original.popdv_field : "8a.1",
      description: `${original.description} (odbivi deo)`,
      sort_order: original.sort_order,
    });
    const nonDeductibleLine = calcSupplierInvoiceLine({
      ...original,
      popdv_field: "9.01",
      description: `${original.description} (neodbivi deo)`,
      quantity: 0,
      unit_price: original.unit_price,
      sort_order: original.sort_order + 0.5,
    });
    const allLines = form.getValues("lines");
    const result = [...allLines];
    result.splice(index, 1, deductibleLine as any, nonDeductibleLine as any);
    replace(result);
  };

  const lines = watchedLines || [];
  const subtotal = useMemo(() => lines.reduce((s, l) => s + (l?.line_total || 0), 0), [lines]);
  const totalTax = useMemo(() => lines.reduce((s, l) => s + (l?.tax_amount || 0), 0), [lines]);
  const totalNonDeductible = useMemo(() => lines.reduce((s, l) => s + (l?.vat_non_deductible || 0), 0), [lines]);
  const grandTotal = subtotal + totalTax + totalNonDeductible;

  const previewLines = useMemo(() =>
    buildSupplierInvoicePreviewLines({ amount: subtotal, tax_amount: totalTax, total: grandTotal, invoice_number: form.getValues("invoiceNumber"), vat_non_deductible: totalNonDeductible }),
    [subtotal, totalTax, grandTotal, totalNonDeductible, form]
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const values = form.getValues();
      const payload: any = {
        tenant_id: tenantId!, invoice_number: values.invoiceNumber, invoice_date: values.invoiceDate,
        vat_date: values.vatDate, due_date: values.dueDate || null,
        supplier_id: values.supplierId || null, supplier_name: values.supplierName,
        purchase_order_id: values.purchaseOrderId || null,
        amount: subtotal, tax_amount: totalTax, total: grandTotal,
        currency: values.currency, status: values.status, notes: values.notes || null, legal_entity_id: values.legalEntityId || null,
      };

      let invoiceId = id;
      if (isEdit) {
        const { error } = await supabase.from("supplier_invoices").update(payload).eq("id", id!);
        if (error) throw error;
        await supabase.from("supplier_invoice_lines").delete().eq("supplier_invoice_id", id!);
        await supabase.from("reverse_charge_entries").delete().eq("supplier_invoice_id", id!);
      } else {
        const { data, error } = await supabase.from("supplier_invoices").insert(payload).select("id").single();
        if (error) throw error;
        invoiceId = data.id;
      }

      const lineInserts = values.lines.map((l, i) => ({
        supplier_invoice_id: invoiceId!,
        tenant_id: tenantId!,
        description: l.description, item_type: l.item_type || "service",
        popdv_field: l.popdv_field || null, efaktura_category: l.efaktura_category || null,
        quantity: l.quantity, unit_price: l.unit_price,
        tax_rate_id: l.tax_rate_id || null, tax_rate_value: l.tax_rate_value,
        line_total: l.line_total, tax_amount: l.tax_amount, total_with_tax: l.total_with_tax,
        vat_non_deductible: l.vat_non_deductible, fee_value: l.fee_value,
        account_id: l.account_id || null, cost_center_id: l.cost_center_id || null, sort_order: i,
      }));

      const { data: insertedLines, error: lineError } = await supabase
        .from("supplier_invoice_lines")
        .insert(lineInserts)
        .select("id, popdv_field, line_total, tax_amount");
      if (lineError) throw lineError;

      // Trigger reverse charge entries for applicable lines (8g, 8b → 3a)
      const rcLines = (insertedLines || []).filter((l) => l.popdv_field && isReverseChargeField(l.popdv_field));
      if (rcLines.length > 0 && (values.status === "approved" || values.status === "received")) {
        await createReverseChargeEntries(
          tenantId!,
          invoiceId!,
          values.vatDate || values.invoiceDate,
          rcLines.map((l) => ({
            id: l.id,
            popdv_field: l.popdv_field!,
            line_total: l.line_total,
            tax_amount: l.tax_amount,
          }))
        );
      }

      return invoiceId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-invoices"] });
      toast({ title: t("success"), description: t("invoiceSaved") });
      navigate("/purchasing/supplier-invoices");
    },
    onError: (err: any) => {
      toast({ title: t("error"), description: err.message, variant: "destructive" });
    },
  });

  const isReadOnly = watchedStatus === "approved" || watchedStatus === "paid" || watchedStatus === "cancelled";
  const vatDateDiffers = watchedVatDate !== watchedInvoiceDate;

  const accountOptions = accounts.filter((a: any) => a.code.length >= 4);

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/purchasing/supplier-invoices")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">{isEdit ? t("editSupplierInvoice") : t("addSupplierInvoice")}</h1>
      </div>

      {/* Locked PDV period warning */}
      {isLocked && (
        <Alert variant="destructive" className="border-yellow-500 bg-yellow-50 text-yellow-900 dark:bg-yellow-950 dark:text-yellow-200">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            PDV period <strong>{periodName}</strong> je zaključen. Knjiženje u ovom periodu nije moguće bez otključavanja.
          </AlertDescription>
        </Alert>
      )}

      {/* Foreign supplier info */}
      {watchedIsForeignSupplier && (
        <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-950">
          <AlertDescription>
            Inostrani dobavljač detektovan — POPDV polje automatski postavljeno na <strong>8g.1</strong> (nabavka od inostranih lica).
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <Card>
        <CardHeader><CardTitle>{t("invoiceDetails")}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label>{t("invoiceNumber")} *</Label>
            <Input {...form.register("invoiceNumber")} disabled={isReadOnly} />
          </div>
          <div>
            <Label>{t("invoiceDate")}</Label>
            <Input type="date" {...form.register("invoiceDate")} disabled={isReadOnly} />
          </div>
          <div>
            <Label className={vatDateDiffers ? "text-yellow-600 font-semibold" : ""}>
              {"Datum PDV"} {vatDateDiffers && "⚠"}
            </Label>
            <Input type="date" {...form.register("vatDate")} disabled={isReadOnly}
              className={vatDateDiffers ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-950" : ""} />
            {periodName && (
              <p className="text-xs text-muted-foreground mt-1">PDV period: <strong>{periodName}</strong></p>
            )}
          </div>
          <div>
            <Label>{t("dueDate")}</Label>
            <Input type="date" {...form.register("dueDate")} disabled={isReadOnly} />
          </div>
          <div>
            <Label>{t("currency")}</Label>
            <Select value={watchedCurrency} onValueChange={(v) => form.setValue("currency", v)} disabled={isReadOnly}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="RSD">RSD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("status")}</Label>
            <Select value={watchedStatus} onValueChange={(v) => form.setValue("status", v)} disabled={isReadOnly}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["draft", "received", "approved", "paid", "cancelled"].map(s => (
                  <SelectItem key={s} value={s}>{t(s as any) || s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("purchaseOrder")}</Label>
            <Select value={form.getValues("purchaseOrderId") || "__none"} onValueChange={(v) => {
              if (v !== "__none") {
                const po = purchaseOrders.find((p: any) => p.id === v);
                if (po) {
                  form.setValue("purchaseOrderId", v);
                  form.setValue("supplierId", po.supplier_id || "");
                  form.setValue("supplierName", po.supplier_name || "");
                }
              } else {
                form.setValue("purchaseOrderId", "");
              }
            }} disabled={isReadOnly}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">—</SelectItem>
                {purchaseOrders.map((po: any) => <SelectItem key={po.id} value={po.id}>{po.order_number}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Legal Entity */}
      {legalEntities.length > 1 && (
        <Card>
          <CardHeader><CardTitle>{t("legalEntity")}</CardTitle></CardHeader>
          <CardContent>
            <div className="max-w-sm">
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

      {/* Supplier */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t("supplier")}</CardTitle>
            {!isReadOnly && (
              <Button size="sm" variant="outline" onClick={() => setPartnerQuickAddOpen(true)}>
                <Plus className="h-3 w-3 mr-1" /> {t("addPartner") || "Novi partner"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>{t("selectPartner")}</Label>
              <EntitySelector
                options={suppliers.map((s: any) => ({
                  value: s.id,
                  label: s.name,
                  sublabel: s.pib || undefined,
                }))}
                value={form.getValues("supplierId") || null}
                onValueChange={(v) => handleSupplierChange(v || "__none")}
                placeholder={t("selectPartner")}
                disabled={isReadOnly}
              />
            </div>
            <div>
              <Label>{"Naziv dobavljača"}</Label>
              <Input {...form.register("supplierName")} disabled={isReadOnly} />
            </div>
          </div>
        </CardContent>
      </Card>

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
                <TableHead className="min-w-[160px]">{t("description")}</TableHead>
                <TableHead className="min-w-[90px]">{t("itemType")}</TableHead>
                <TableHead className="min-w-[130px]">POPDV</TableHead>
                <TableHead className="min-w-[90px]">eFaktura</TableHead>
                <TableHead className="min-w-[60px]">{t("quantity")}</TableHead>
                <TableHead className="min-w-[80px]">{t("unitPrice")}</TableHead>
                <TableHead className="min-w-[80px]">Provizija</TableHead>
                <TableHead className="min-w-[90px]">{t("taxRate")}</TableHead>
                <TableHead className="text-right min-w-[80px]">{t("lineTotal")}</TableHead>
                <TableHead className="text-right min-w-[80px]">{t("taxAmount")}</TableHead>
                <TableHead className="min-w-[140px]">{t("account") || "Konto"}</TableHead>
                {costCenters.length > 0 && <TableHead className="min-w-[120px]">Mesto troška</TableHead>}
                {!isReadOnly && <TableHead className="w-[40px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field, i) => {
                const line = lines[i] || field;
                return (
                <TableRow key={field.id}>
                  <TableCell>
                    <Input value={line.description} onChange={(e) => updateLine(i, "description", e.target.value)}
                      disabled={isReadOnly} placeholder={t("description")} className="h-8" />
                  </TableCell>
                  <TableCell>
                    <Select value={line.item_type} onValueChange={(v) => updateLine(i, "item_type", v)} disabled={isReadOnly}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="goods">{t("itemTypeGoods")}</SelectItem>
                        <SelectItem value="service">{t("itemTypeService")}</SelectItem>
                        <SelectItem value="product">{t("itemTypeProduct")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <PopdvFieldSelect direction="INPUT" value={line.popdv_field}
                      onValueChange={(v) => updateLine(i, "popdv_field", v)} disabled={isReadOnly} />
                  </TableCell>
                  <TableCell>
                    <Select value={line.efaktura_category || "__none__"} onValueChange={(v) => updateLine(i, "efaktura_category", v === "__none__" ? "" : v)} disabled={isReadOnly}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">—</SelectItem>
                        {EFAKTURA_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input type="number" min={0} value={line.quantity} onChange={(e) => updateLine(i, "quantity", Number(e.target.value))} disabled={isReadOnly} className="h-8" />
                  </TableCell>
                  <TableCell>
                    <Input type="number" min={0} step={0.01} value={line.unit_price} onChange={(e) => updateLine(i, "unit_price", Number(e.target.value))} disabled={isReadOnly} className="h-8" />
                  </TableCell>
                  <TableCell>
                    {isFeeField(line.popdv_field) ? (
                      <Input type="number" min={0} step={0.01} value={line.fee_value}
                        onChange={(e) => updateLine(i, "fee_value", Number(e.target.value))}
                        disabled={isReadOnly} className="h-8" placeholder="Provizija" title="PDV se obračunava na proviziju (8v/8d)" />
                    ) : (
                      <span className="text-xs text-muted-foreground px-2">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Select value={line.tax_rate_id} onValueChange={(v) => updateLine(i, "tax_rate_id", v)} disabled={isReadOnly}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {taxRates.map((tr) => <SelectItem key={tr.id} value={tr.id}>{tr.name} ({Number(tr.rate)}%)</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">{fmtNum(line.line_total)}</TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {line.popdv_field?.startsWith("9") ? (
                      <span className="text-destructive" title="Neodbivi PDV">{fmtNum(line.vat_non_deductible)}</span>
                    ) : fmtNum(line.tax_amount)}
                  </TableCell>
                  <TableCell>
                    <Select value={line.account_id || "__none__"} onValueChange={(v) => updateLine(i, "account_id", v === "__none__" ? "" : v)} disabled={isReadOnly}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent className="max-h-[200px]">
                        <SelectItem value="__none__">—</SelectItem>
                        {accountOptions.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  {costCenters.length > 0 && (
                    <TableCell>
                      <Select value={line.cost_center_id || "__none__"} onValueChange={(v) => updateLine(i, "cost_center_id", v === "__none__" ? "" : v)} disabled={isReadOnly}>
                        <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent className="max-h-[200px]">
                          <SelectItem value="__none__">—</SelectItem>
                          {costCenters.map((cc: any) => <SelectItem key={cc.id} value={cc.id}>{cc.code} — {cc.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  )}
                  {!isReadOnly && (
                    <TableCell>
                      <div className="flex gap-1">
                        {line.popdv_field?.startsWith("8a") && (
                          <Button size="icon" variant="ghost" onClick={() => splitLine(i)} title="Podeli na odbivi/neodbivi (8a + 9)">
                            <span className="text-xs font-bold">⅔</span>
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" onClick={() => removeLine(i)} disabled={fields.length <= 1}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
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
            <div className="flex justify-between w-72">
              <span>{t("subtotal")}:</span>
              <span className="font-mono">{fmtNum(subtotal)} {watchedCurrency}</span>
            </div>
            <div className="flex justify-between w-72 text-sm text-muted-foreground">
              <span>PDV:</span>
              <span className="font-mono">{fmtNum(totalTax)} {watchedCurrency}</span>
            </div>
            {totalNonDeductible > 0 && (
              <div className="flex justify-between w-72 text-sm text-destructive">
                <span>Neodbivi PDV (sek. 9):</span>
                <span className="font-mono">{fmtNum(totalNonDeductible)} {watchedCurrency}</span>
              </div>
            )}
            <Separator className="w-72" />
            <div className="flex justify-between w-72 font-bold text-lg">
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

      {/* Posting Preview */}
      <PostingPreviewPanel lines={previewLines} currency={watchedCurrency} title="Pregled knjiženja — ulazna faktura" />

      {/* Actions */}
      {!isReadOnly && (
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => saveMutation.mutate()} disabled={!form.getValues("invoiceNumber") || saveMutation.isPending}>
            <Save className="h-4 w-4 mr-2" /> {t("save")}
          </Button>
          <Button variant="ghost" onClick={() => navigate("/purchasing/supplier-invoices")}>
            {t("cancel")}
          </Button>
        </div>
      )}

      <PartnerQuickAdd
        open={partnerQuickAddOpen}
        onOpenChange={setPartnerQuickAddOpen}
        tenantId={tenantId!}
        onPartnerCreated={(partner) => {
          queryClient.invalidateQueries({ queryKey: ["suppliers-list"] });
          form.setValue("supplierId", partner.id);
          form.setValue("supplierName", partner.name);
        }}
      />
    </div>
  );
}
