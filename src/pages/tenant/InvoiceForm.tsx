import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { useLegalEntities } from "@/hooks/useLegalEntities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, ArrowLeft, Save, Send } from "lucide-react";
import { format } from "date-fns";
import { fmtNum } from "@/lib/utils";

interface InvoiceLine {
  id?: string;
  product_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate_id: string;
  tax_rate_value: number;
  line_total: number;
  tax_amount: number;
  total_with_tax: number;
  sort_order: number;
}

function emptyLine(order: number, defaultTaxRateId: string, defaultRate: number): InvoiceLine {
  return {
    description: "",
    quantity: 1,
    unit_price: 0,
    tax_rate_id: defaultTaxRateId,
    tax_rate_value: defaultRate,
    line_total: 0,
    tax_amount: 0,
    total_with_tax: 0,
    sort_order: order,
  };
}

function calcLine(line: InvoiceLine): InvoiceLine {
  const lineTotal = line.quantity * line.unit_price;
  const taxAmount = lineTotal * (line.tax_rate_value / 100);
  return { ...line, line_total: lineTotal, tax_amount: taxAmount, total_with_tax: lineTotal + taxAmount };
}

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
  const [invoiceType, setInvoiceType] = useState<"regular" | "advance" | "advance_final">("regular");
  const [advanceInvoiceId, setAdvanceInvoiceId] = useState<string>("");
  const [advanceAmountApplied, setAdvanceAmountApplied] = useState(0);
  const [legalEntityId, setLegalEntityId] = useState<string>("");
  const [salespersonId, setSalespersonId] = useState<string>("");
  const [salesOrderId, setSalesOrderId] = useState<string | null>(null);
  const { entities: legalEntities } = useLegalEntities();

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
      // Pre-fill lines from sales order
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
      };



      let invoiceId = id;

      if (isEdit) {
        const { error } = await supabase.from("invoices").update(invoiceData).eq("id", id!);
        if (error) throw error;
        // Delete old lines, re-insert
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

  const isReadOnly = status === "sent" || status === "paid" || status === "cancelled";

  

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/accounting/invoices")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">{isEdit ? t("editInvoice") : t("newInvoice")}</h1>
      </div>

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
            <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} disabled={isReadOnly} />
          </div>
          <div>
            <Label>{t("dueDate")}</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={isReadOnly} />
          </div>
          <div>
            <Label>{t("invoiceType" as any)}</Label>
            <Select value={invoiceType} onValueChange={(v) => setInvoiceType(v as any)} disabled={isReadOnly}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="regular">{t("invoiceTypeRegular")}</SelectItem>
                <SelectItem value="advance">{t("invoiceTypeAdvance")}</SelectItem>
                <SelectItem value="advance_final">{t("invoiceTypeAdvanceFinal")}</SelectItem>
              </SelectContent>
            </Select>
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

      {/* Legal Entity */}
      {legalEntities.length > 0 && (
        <Card>
          <CardHeader><CardTitle>{t("legalEntity")}</CardTitle></CardHeader>
          <CardContent>
            <div className="max-w-sm">
              <Label>{t("selectLegalEntity")}</Label>
              <Select value={legalEntityId} onValueChange={setLegalEntityId} disabled={isReadOnly || legalEntities.length === 1}>
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
        <CardHeader><CardTitle>{t("partner")}</CardTitle></CardHeader>
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
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[18%]">{t("product")}</TableHead>
                <TableHead className="w-[22%]">{t("description")}</TableHead>
                <TableHead className="w-[8%]">{t("quantity")}</TableHead>
                <TableHead className="w-[10%]">{t("unitPrice")}</TableHead>
                <TableHead className="w-[12%]">{t("taxRate")}</TableHead>
                <TableHead className="text-right w-[10%]">{t("lineTotal")}</TableHead>
                <TableHead className="text-right w-[10%]">{t("taxAmount")}</TableHead>
                <TableHead className="text-right w-[10%]">{t("totalWithTax")}</TableHead>
                {!isReadOnly && <TableHead className="w-[5%]" />}
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
                      <SelectTrigger><SelectValue placeholder={t("selectProduct")} /></SelectTrigger>
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
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      value={line.quantity}
                      onChange={(e) => updateLine(i, "quantity", Number(e.target.value))}
                      disabled={isReadOnly}
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
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={line.tax_rate_id}
                      onValueChange={(v) => updateLine(i, "tax_rate_id", v)}
                      disabled={isReadOnly}
                    >
                      <SelectTrigger>
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
                  <TableCell className="text-right font-mono">{fmtNum(line.line_total)}</TableCell>
                  <TableCell className="text-right font-mono">{fmtNum(line.tax_amount)}</TableCell>
                  <TableCell className="text-right font-mono">{fmtNum(line.total_with_tax)}</TableCell>
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

      {/* Actions */}
      {!isReadOnly && (
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => saveMutation.mutate("draft")} disabled={saveMutation.isPending}>
            <Save className="h-4 w-4 mr-2" /> {t("saveDraft")}
          </Button>
          <Button onClick={() => saveMutation.mutate("sent")} disabled={saveMutation.isPending}>
            <Send className="h-4 w-4 mr-2" /> {t("postInvoice")}
          </Button>
          <Button variant="ghost" onClick={() => navigate("/accounting/invoices")}>
            {t("cancel")}
          </Button>
        </div>
      )}
    </div>
  );
}
