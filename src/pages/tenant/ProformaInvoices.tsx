import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { useLegalEntities } from "@/hooks/useLegalEntities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, FileText, ArrowRight, Trash2, Loader2 } from "lucide-react";
import { fmtNum } from "@/lib/utils";
import { format } from "date-fns";
import { PageHeader } from "@/components/shared/PageHeader";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  converted: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  expired: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  cancelled: "bg-muted text-muted-foreground line-through",
};

interface ProformaLine {
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  total: number;
}

interface ProformaForm {
  proforma_number: string;
  partner_id: string;
  partner_name: string;
  legal_entity_id: string;
  issue_date: string;
  valid_until: string;
  currency: string;
  notes: string;
  status: string;
  lines: ProformaLine[];
}

const emptyLine: ProformaLine = { description: "", quantity: 1, unit_price: 0, tax_rate: 20, total: 0 };

export default function ProformaInvoices() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { entities } = useLegalEntities();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ProformaForm>({
    proforma_number: "", partner_id: "", partner_name: "", legal_entity_id: "",
    issue_date: format(new Date(), "yyyy-MM-dd"), valid_until: "",
    currency: "RSD", notes: "", status: "draft", lines: [{ ...emptyLine }],
  });

  const { data: partners = [] } = useQuery({
    queryKey: ["partners-proforma", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("partners").select("id, name").eq("tenant_id", tenantId!).order("name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: proformas = [], isLoading } = useQuery({
    queryKey: ["proforma-invoices", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("proforma_invoices")
        .select("*, partners(name), legal_entities(name)")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const updateLine = (idx: number, field: string, value: any) => {
    const updated = [...form.lines];
    (updated[idx] as any)[field] = value;
    updated[idx] = { ...updated[idx], total: updated[idx].quantity * updated[idx].unit_price * (1 + updated[idx].tax_rate / 100) };
    setForm(p => ({ ...p, lines: updated }));
  };

  const subtotal = form.lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);
  const taxAmount = form.lines.reduce((s, l) => s + l.quantity * l.unit_price * l.tax_rate / 100, 0);
  const total = subtotal + taxAmount;

  const saveMutation = useMutation({
    mutationFn: async (f: ProformaForm) => {
      const payload = {
        tenant_id: tenantId!, proforma_number: f.proforma_number,
        partner_id: f.partner_id || null, partner_name: f.partner_name || null,
        legal_entity_id: f.legal_entity_id || null,
        issue_date: f.issue_date, valid_until: f.valid_until || null,
        currency: f.currency, status: f.status, notes: f.notes || null,
        subtotal, tax_amount: taxAmount, total,
        created_by: user?.id || null,
      };
      let proformaId = editId;
      if (editId) {
        const { error } = await supabase.from("proforma_invoices").update(payload).eq("id", editId);
        if (error) throw error;
        await supabase.from("proforma_invoice_lines").delete().eq("proforma_id", editId);
      } else {
        const { data, error } = await supabase.from("proforma_invoices").insert([payload]).select("id").single();
        if (error) throw error;
        proformaId = data.id;
      }
      if (proformaId && f.lines.length > 0) {
        const linePayloads = f.lines.map((l, i) => ({
          proforma_id: proformaId!, tenant_id: tenantId!,
          description: l.description, quantity: l.quantity,
          unit_price: l.unit_price, tax_rate: l.tax_rate,
          total: l.quantity * l.unit_price * (1 + l.tax_rate / 100),
          sort_order: i,
        }));
        const { error } = await supabase.from("proforma_invoice_lines").insert(linePayloads);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["proforma-invoices"] }); setDialogOpen(false); toast({ title: t("success") }); },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const convertMutation = useMutation({
    mutationFn: async (proformaId: string) => {
      const proforma = proformas.find((p: any) => p.id === proformaId);
      if (!proforma) throw new Error("Proforma not found");
      const { data: lines } = await supabase.from("proforma_invoice_lines").select("*").eq("proforma_id", proformaId).order("sort_order");
      const invNumber = `INV-${proforma.proforma_number}`;
      const { data: inv, error: invErr } = await supabase.from("invoices").insert([{
        tenant_id: tenantId!, invoice_number: invNumber,
        invoice_date: new Date().toISOString().split("T")[0],
        partner_id: proforma.partner_id, partner_name: proforma.partner_name,
        legal_entity_id: proforma.legal_entity_id,
        subtotal: proforma.subtotal, tax_amount: proforma.tax_amount,
        total: proforma.total, currency: proforma.currency,
        status: "draft", invoice_type: "regular", sale_type: "domestic",
        proforma_id: proformaId, created_by: user?.id,
      }]).select("id").single();
      if (invErr) throw invErr;
      if (lines && lines.length > 0) {
        const invLines = lines.map((l: any) => ({
          invoice_id: inv.id, description: l.description,
          quantity: l.quantity, unit_price: l.unit_price,
          tax_rate_id: null as string | null,
          line_total: l.quantity * l.unit_price,
          tax_amount: l.quantity * l.unit_price * l.tax_rate / 100,
          total_with_tax: l.total, sort_order: l.sort_order,
          item_type: "service",
          tenant_id: tenantId!,
        }));
        await supabase.from("invoice_lines").insert(invLines);
      }
      await supabase.from("proforma_invoices").update({ status: "converted", converted_invoice_id: inv.id }).eq("id", proformaId);
      return inv.id;
    },
    onSuccess: (invoiceId) => {
      qc.invalidateQueries({ queryKey: ["proforma-invoices"] });
      toast({ title: t("success"), description: t("proformaConverted") as string });
      navigate(`/accounting/invoices/${invoiceId}`);
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const openNew = () => {
    setEditId(null);
    setForm({
      proforma_number: "", partner_id: "", partner_name: "", legal_entity_id: "",
      issue_date: format(new Date(), "yyyy-MM-dd"), valid_until: "",
      currency: "RSD", notes: "", status: "draft", lines: [{ ...emptyLine }],
    });
    setDialogOpen(true);
  };

  const openEdit = async (p: any) => {
    setEditId(p.id);
    const { data: lines } = await supabase.from("proforma_invoice_lines").select("*").eq("proforma_id", p.id).order("sort_order");
    setForm({
      proforma_number: p.proforma_number, partner_id: p.partner_id || "",
      partner_name: p.partner_name || "", legal_entity_id: p.legal_entity_id || "",
      issue_date: p.issue_date, valid_until: p.valid_until || "",
      currency: p.currency, notes: p.notes || "", status: p.status,
      lines: (lines || []).map((l: any) => ({
        description: l.description || "", quantity: l.quantity,
        unit_price: l.unit_price, tax_rate: l.tax_rate, total: l.total,
      })),
    });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader title={t("proformaInvoices") as string} icon={FileText} />
      <div className="flex justify-end">
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" />{t("add")}</Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("documentNumber")}</TableHead>
            <TableHead>{t("partner")}</TableHead>
            <TableHead className="text-right">{t("total")}</TableHead>
            <TableHead>{t("status")}</TableHead>
            <TableHead>{t("date")}</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
          ) : proformas.length === 0 ? (
            <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t("noResults")}</TableCell></TableRow>
          ) : proformas.map((r: any) => (
            <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openEdit(r)}>
              <TableCell className="font-mono">{r.proforma_number}</TableCell>
              <TableCell>{r.partner_name || (r.partners as any)?.name || "-"}</TableCell>
              <TableCell className="text-right font-mono">{fmtNum(r.total)} {r.currency}</TableCell>
              <TableCell><Badge className={statusColors[r.status] || ""}>{r.status}</Badge></TableCell>
              <TableCell>{format(new Date(r.issue_date), "dd.MM.yyyy")}</TableCell>
              <TableCell>
                {(r.status === "draft" || r.status === "sent") && (
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); convertMutation.mutate(r.id); }}>
                    <ArrowRight className="h-3 w-3 mr-1" />{t("convertToInvoice") as string}
                  </Button>
                )}
                {r.converted_invoice_id && <Badge variant="outline">{t("converted") as string}</Badge>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("proformaInvoices") as string} — {editId ? t("edit") : t("add")}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>{t("documentNumber")}</Label><Input value={form.proforma_number} onChange={e => setForm(p => ({ ...p, proforma_number: e.target.value }))} /></div>
            <div><Label>{t("date")}</Label><Input type="date" value={form.issue_date} onChange={e => setForm(p => ({ ...p, issue_date: e.target.value }))} /></div>
            <div>
              <Label>{t("partner")}</Label>
              <Select value={form.partner_id} onValueChange={v => { const p = partners.find((x: any) => x.id === v); setForm(prev => ({ ...prev, partner_id: v, partner_name: p?.name || "" })); }}>
                <SelectTrigger><SelectValue placeholder={t("selectPartner")} /></SelectTrigger>
                <SelectContent>{partners.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("legalEntity")}</Label>
              <Select value={form.legal_entity_id} onValueChange={v => setForm(p => ({ ...p, legal_entity_id: v }))}>
                <SelectTrigger><SelectValue placeholder={t("legalEntity")} /></SelectTrigger>
                <SelectContent>{entities.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>{t("validUntil")}</Label><Input type="date" value={form.valid_until} onChange={e => setForm(p => ({ ...p, valid_until: e.target.value }))} /></div>
            <div>
              <Label>{t("status")}</Label>
              <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">{t("draft")}</SelectItem>
                  <SelectItem value="sent">{t("sent")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4">
            <Label className="text-sm font-semibold">{t("lineItems")}</Label>
            <div className="space-y-2 mt-2">
              {form.lines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-4"><Input placeholder={t("description")} value={line.description} onChange={e => updateLine(idx, "description", e.target.value)} /></div>
                  <div className="col-span-2"><Input type="number" placeholder={t("quantity")} value={line.quantity} onChange={e => updateLine(idx, "quantity", Number(e.target.value))} /></div>
                  <div className="col-span-2"><Input type="number" placeholder={t("unitPrice")} value={line.unit_price} onChange={e => updateLine(idx, "unit_price", Number(e.target.value))} /></div>
                  <div className="col-span-1"><Input type="number" placeholder="%" value={line.tax_rate} onChange={e => updateLine(idx, "tax_rate", Number(e.target.value))} /></div>
                  <div className="col-span-2 text-right font-mono text-sm pt-2">{fmtNum(line.quantity * line.unit_price * (1 + line.tax_rate / 100))}</div>
                  <div className="col-span-1"><Button variant="ghost" size="icon" onClick={() => setForm(p => ({ ...p, lines: p.lines.filter((_, i) => i !== idx) }))}><Trash2 className="h-4 w-4" /></Button></div>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setForm(p => ({ ...p, lines: [...p.lines, { ...emptyLine }] }))}><Plus className="h-3 w-3 mr-1" />{t("addLine")}</Button>
            </div>
          </div>

          <div className="flex justify-end gap-4 mt-2 text-sm font-mono">
            <span>{t("subtotal")}: {fmtNum(subtotal)}</span>
            <span>{t("tax")}: {fmtNum(taxAmount)}</span>
            <span className="font-bold">{t("total")}: {fmtNum(total)} {form.currency}</span>
          </div>

          <div><Label>{t("notes")}</Label><Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} /></div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => saveMutation.mutate(form)} disabled={!form.proforma_number || saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}{t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
