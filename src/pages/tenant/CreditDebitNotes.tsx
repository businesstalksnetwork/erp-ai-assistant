import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, TrendingDown, TrendingUp, BookOpen, Loader2, FileSearch } from "lucide-react";
import { fmtNum } from "@/lib/utils";
import { format } from "date-fns";
import { postWithRuleOrFallback } from "@/lib/postingHelper";
import { PageHeader } from "@/components/shared/PageHeader";
import PostingPreviewPanel, { type PreviewLine } from "@/components/accounting/PostingPreviewPanel";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  issued: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  applied: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

interface NoteForm {
  number: string;
  invoice_id: string;
  partner_id: string;
  legal_entity_id: string;
  amount: number;
  currency: string;
  reason: string;
  status: string;
  notes: string;
}

const emptyForm: NoteForm = {
  number: "", invoice_id: "", partner_id: "", legal_entity_id: "",
  amount: 0, currency: "RSD", reason: "", status: "draft", notes: "",
};

export default function CreditDebitNotes() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { entities } = useLegalEntities();
  const [tab, setTab] = useState("credit");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<NoteForm>(emptyForm);
  const [invoicePickerOpen, setInvoicePickerOpen] = useState(false);
  const [selectedInvoiceLines, setSelectedInvoiceLines] = useState<any[]>([]);
  const [invoiceLineSelections, setInvoiceLineSelections] = useState<Record<number, { selected: boolean; quantity: number }>>({});

  const { data: partners = [] } = useQuery({
    queryKey: ["partners-for-notes", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("partners").select("id, name").eq("tenant_id", tenantId!).order("name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices-for-notes", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("invoices").select("id, invoice_number, total, partner_name").eq("tenant_id", tenantId!).order("created_at", { ascending: false }).limit(200);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: creditNotes = [], isLoading: loadingCN } = useQuery({
    queryKey: ["standalone-credit-notes", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("credit_notes")
        .select("*, partners(name), legal_entities(name)")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: debitNotes = [], isLoading: loadingDN } = useQuery({
    queryKey: ["debit-notes", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("debit_notes")
        .select("*, partners(name), legal_entities(name)")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const buildPreviewLines = (type: "credit" | "debit", amount: number, number: string): PreviewLine[] => {
    if (type === "credit") {
      return [
        { accountCode: "6000", accountName: "Prihodi od prodaje", debit: amount, credit: 0, description: `Storno prihoda - ${number}` },
        { accountCode: "2040", accountName: "Potraživanja od kupaca", debit: 0, credit: amount, description: `Umanjenje potraživanja - ${number}` },
      ];
    }
    return [
      { accountCode: "2040", accountName: "Potraživanja od kupaca", debit: amount, credit: 0, description: `Uvećanje potraživanja - ${number}` },
      { accountCode: "6000", accountName: "Prihodi od prodaje", debit: 0, credit: amount, description: `Dodatni prihod - ${number}` },
    ];
  };

  const saveCreditNote = useMutation({
    mutationFn: async (f: NoteForm) => {
      const payload = {
        tenant_id: tenantId!, credit_number: f.number,
        invoice_id: f.invoice_id || null, partner_id: f.partner_id || null,
        legal_entity_id: f.legal_entity_id || null,
        amount: f.amount, currency: f.currency, status: f.status,
        notes: f.notes || null,
        issued_at: f.status === "issued" ? new Date().toISOString() : null,
      };
      if (editId) {
        const { error } = await supabase.from("credit_notes").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("credit_notes").insert([payload]);
        if (error) throw error;
      }
      if (f.status === "issued" && f.amount > 0 && tenantId) {
        await postWithRuleOrFallback({
          tenantId: tenantId!, userId: user?.id || null,
          entryDate: new Date().toISOString().split("T")[0],
          modelCode: "CREDIT_NOTE_ISSUED", amount: f.amount,
          description: `Knjižno odobrenje ${f.number}`,
          reference: `CN-${f.number}`, context: {},
          fallbackLines: [
            { accountCode: "6000", debit: f.amount, credit: 0, description: `Storno prihoda - ${f.number}`, sortOrder: 0 },
            { accountCode: "2040", debit: 0, credit: f.amount, description: `Umanjenje potraživanja - ${f.number}`, sortOrder: 1 },
          ],
        });
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["standalone-credit-notes"] }); setDialogOpen(false); toast({ title: t("success") }); },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const saveDebitNote = useMutation({
    mutationFn: async (f: NoteForm) => {
      const payload = {
        tenant_id: tenantId!, debit_number: f.number,
        invoice_id: f.invoice_id || null, partner_id: f.partner_id || null,
        legal_entity_id: f.legal_entity_id || null,
        amount: f.amount, currency: f.currency, reason: f.reason,
        status: f.status, notes: f.notes || null,
        issued_at: f.status === "issued" ? new Date().toISOString() : null,
      };
      if (editId) {
        const { error } = await supabase.from("debit_notes").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("debit_notes").insert([payload]);
        if (error) throw error;
      }
      if (f.status === "issued" && f.amount > 0 && tenantId) {
        await postWithRuleOrFallback({
          tenantId: tenantId!, userId: user?.id || null,
          entryDate: new Date().toISOString().split("T")[0],
          modelCode: "DEBIT_NOTE_ISSUED", amount: f.amount,
          description: `Knjižno zaduženje ${f.number}`,
          reference: `DN-${f.number}`, context: {},
          fallbackLines: [
            { accountCode: "2040", debit: f.amount, credit: 0, description: `Uvećanje potraživanja - ${f.number}`, sortOrder: 0 },
            { accountCode: "6000", debit: 0, credit: f.amount, description: `Dodatni prihod - ${f.number}`, sortOrder: 1 },
          ],
        });
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["debit-notes"] }); setDialogOpen(false); toast({ title: t("success") }); },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  // "Create from Invoice" flow
  const openFromInvoice = () => { setInvoicePickerOpen(true); };

  const selectInvoiceForCredit = async (inv: any) => {
    setInvoicePickerOpen(false);
    // Fetch invoice items
    const { data: items } = await supabase.from("invoice_items" as any)
      .select("*, products(name)")
      .eq("invoice_id", inv.id);
    const lineItems = (items || []) as any[];
    setSelectedInvoiceLines(lineItems);
    const selections: Record<number, { selected: boolean; quantity: number }> = {};
    lineItems.forEach((item: any, idx: number) => { selections[idx] = { selected: true, quantity: Number(item.quantity) || 1 }; });
    setInvoiceLineSelections(selections);
    setTab("credit");
    setEditId(null);
    setForm({
      ...emptyForm,
      invoice_id: inv.id,
      partner_id: inv.partner_id || "",
      amount: Number(inv.total) || 0,
    });
    setDialogOpen(true);
  };

  // Recalculate amount from selected lines
  const recalcFromLines = (lines: any[], sels: Record<number, { selected: boolean; quantity: number }>) => {
    let total = 0;
    lines.forEach((line, idx) => {
      const sel = sels[idx];
      if (sel?.selected && sel.quantity > 0) {
        const lineTotal = sel.quantity * Number(line.unit_price) * (1 + (Number(line.tax_rate) || 0) / 100);
        total += lineTotal;
      }
    });
    setForm(f => ({ ...f, amount: Math.round(total * 100) / 100 }));
  };

  // Enhanced save for credit notes with inventory restoration
  const saveCreditNoteEnhanced = async (f: NoteForm) => {
    await saveCreditNote.mutateAsync(f);
    // Restore inventory for credited product lines
    if (f.status === "issued" && selectedInvoiceLines.length > 0 && tenantId) {
      for (const [idx, line] of selectedInvoiceLines.entries()) {
        const sel = invoiceLineSelections[idx];
        if (sel?.selected && sel.quantity > 0 && line.product_id) {
          try {
            // Find a default warehouse for restoration
            const { data: wh } = await supabase.from("warehouses").select("id").eq("tenant_id", tenantId).limit(1).single();
            if (wh) {
              await supabase.rpc("adjust_inventory_stock", {
                p_tenant_id: tenantId,
                p_product_id: line.product_id,
                p_warehouse_id: wh.id,
                p_quantity: sel.quantity,
                p_reference: `Credit note ${f.number} - inventory restoration`,
              });
            }
          } catch (e) {
            console.warn("Inventory restoration failed for product:", line.product_id, e);
          }
        }
      }
    }
    setSelectedInvoiceLines([]);
    setInvoiceLineSelections({});
  };

  const openNew = (type: "credit" | "debit") => { setTab(type); setEditId(null); setForm(emptyForm); setSelectedInvoiceLines([]); setInvoiceLineSelections({}); setDialogOpen(true); };
  const openEdit = (type: "credit" | "debit", note: any) => {
    setTab(type); setEditId(note.id);
    setForm({
      number: type === "credit" ? note.credit_number : note.debit_number,
      invoice_id: note.invoice_id || "", partner_id: note.partner_id || "",
      legal_entity_id: note.legal_entity_id || "", amount: Number(note.amount),
      currency: note.currency || "RSD", reason: note.reason || "",
      status: note.status, notes: note.notes || "",
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (tab === "credit" && selectedInvoiceLines.length > 0) {
      saveCreditNoteEnhanced(form);
    } else if (tab === "credit") {
      saveCreditNote.mutate(form);
    } else {
      saveDebitNote.mutate(form);
    }
  };
  const saving = saveCreditNote.isPending || saveDebitNote.isPending;

  const renderTable = (items: any[], type: "credit" | "debit", loading: boolean) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("documentNumber")}</TableHead>
          <TableHead>{t("partner")}</TableHead>
          <TableHead className="text-right">{t("amount")}</TableHead>
          <TableHead>{t("status")}</TableHead>
          <TableHead>{t("date")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
        ) : items.length === 0 ? (
          <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">{t("noResults")}</TableCell></TableRow>
        ) : items.map((r: any) => (
          <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openEdit(type, r)}>
            <TableCell className="font-mono">{type === "credit" ? r.credit_number : r.debit_number}</TableCell>
            <TableCell>{(r.partners as any)?.name || "-"}</TableCell>
            <TableCell className="text-right font-mono">{fmtNum(r.amount)} {r.currency}</TableCell>
            <TableCell><Badge className={statusColors[r.status] || ""}>{r.status}</Badge></TableCell>
            <TableCell>{r.issued_at ? format(new Date(r.issued_at), "dd.MM.yyyy") : "-"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-6 p-6">
      <PageHeader title={t("creditDebitNotes") as string} icon={BookOpen} />
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="credit" className="gap-2"><TrendingDown className="h-4 w-4" />{t("creditNotes")}</TabsTrigger>
            <TabsTrigger value="debit" className="gap-2"><TrendingUp className="h-4 w-4" />{t("debitNotes") as string}</TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            {tab === "credit" && (
              <Button onClick={openFromInvoice} size="sm" variant="outline"><FileSearch className="h-4 w-4 mr-1" />{"Od fakture"}</Button>
            )}
            <Button onClick={() => openNew(tab as "credit" | "debit")} size="sm"><Plus className="h-4 w-4 mr-1" />{t("add")}</Button>
          </div>
        </div>
        <TabsContent value="credit">{renderTable(creditNotes, "credit", loadingCN)}</TabsContent>
        <TabsContent value="debit">{renderTable(debitNotes, "debit", loadingDN)}</TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{tab === "credit" ? t("creditNote") : (t("debitNotes") as string)} — {editId ? t("edit") : t("add")}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>{t("documentNumber")}</Label><Input value={form.number} onChange={e => setForm(p => ({ ...p, number: e.target.value }))} /></div>
            <div><Label>{t("amount")}</Label><Input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: Number(e.target.value) }))} /></div>
            <div>
              <Label>{t("partner")}</Label>
              <Select value={form.partner_id} onValueChange={v => setForm(p => ({ ...p, partner_id: v }))}>
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
            <div>
              <Label>{t("invoiceNumber")}</Label>
              <Select value={form.invoice_id} onValueChange={v => setForm(p => ({ ...p, invoice_id: v }))}>
                <SelectTrigger><SelectValue placeholder={`(${t("optional")})`} /></SelectTrigger>
                <SelectContent>{invoices.map((inv: any) => <SelectItem key={inv.id} value={inv.id}>{inv.invoice_number} — {inv.partner_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("status")}</Label>
              <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">{t("draft")}</SelectItem>
                  <SelectItem value="issued">{t("sent")}</SelectItem>
                  <SelectItem value="applied">{t("applied")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>{t("reason")}</Label><Textarea value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} rows={2} /></div>
            <div className="col-span-2"><Label>{t("notes")}</Label><Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} /></div>
          </div>
          {/* Invoice line item selector */}
          {tab === "credit" && selectedInvoiceLines.length > 0 && (
            <div className="space-y-2">
              <Label>{"Stavke za knjižno odobrenje"}</Label>
              <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                {selectedInvoiceLines.map((line: any, idx: number) => {
                  const sel = invoiceLineSelections[idx] || { selected: true, quantity: line.quantity };
                  return (
                    <div key={idx} className="flex items-center gap-3 p-2 text-sm">
                      <input
                        type="checkbox"
                        checked={sel.selected}
                        onChange={e => {
                          const updated = { ...invoiceLineSelections, [idx]: { ...sel, selected: e.target.checked } };
                          setInvoiceLineSelections(updated);
                          recalcFromLines(selectedInvoiceLines, updated);
                        }}
                      />
                      <span className="flex-1 truncate">{line.products?.name || line.description || "—"}</span>
                      <Input
                        type="number"
                        min={1}
                        max={line.quantity}
                        value={sel.quantity}
                        onChange={e => {
                          const val = Math.min(Math.max(1, Number(e.target.value)), line.quantity);
                          const updated = { ...invoiceLineSelections, [idx]: { ...sel, quantity: val } };
                          setInvoiceLineSelections(updated);
                          recalcFromLines(selectedInvoiceLines, updated);
                        }}
                        className="w-16 h-7 text-center"
                      />
                      <span className="w-24 text-right font-mono">{fmtNum(sel.quantity * Number(line.unit_price))}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {form.amount > 0 && form.status === "issued" && (
            <PostingPreviewPanel lines={buildPreviewLines(tab as "credit" | "debit", form.amount, form.number)} title={t("glPostingPreview")} />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("cancel")}</Button>
            <Button onClick={handleSave} disabled={!form.number || form.amount <= 0 || saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {form.status === "issued" ? t("postEntry") : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Invoice Picker Dialog */}
      <Dialog open={invoicePickerOpen} onOpenChange={setInvoicePickerOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{"Izaberi fakturu"}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {invoices.map((inv: any) => (
              <div
                key={inv.id}
                className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => selectInvoiceForCredit(inv)}
              >
                <div>
                  <p className="font-mono text-sm font-medium">{inv.invoice_number}</p>
                  <p className="text-xs text-muted-foreground">{inv.partner_name || "—"}</p>
                </div>
                <span className="font-mono font-medium">{fmtNum(inv.total)}</span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
