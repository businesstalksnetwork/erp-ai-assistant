import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { postWithRuleOrFallback } from "@/lib/postingHelper";
import PostingPreviewPanel, { buildCashPreviewLines } from "@/components/accounting/PostingPreviewPanel";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/shared/ResponsiveTable";

export default function CashRegister() {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filterMonth, setFilterMonth] = useState(format(new Date(), "yyyy-MM"));
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [form, setForm] = useState({ direction: "in" as "in" | "out", amount: "", description: "", document_ref: "" });

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["cash-register", tenantId, filterMonth, sourceFilter],
    queryFn: async () => {
      if (!tenantId) return [];
      const start = `${filterMonth}-01`;
      const endDate = new Date(Number(filterMonth.split("-")[0]), Number(filterMonth.split("-")[1]), 0);
      const end = format(endDate, "yyyy-MM-dd");
      let q = supabase
        .from("cash_register").select("*").eq("tenant_id", tenantId)
        .gte("entry_date", start).lte("entry_date", end)
        .order("entry_date").order("entry_number");
      if (sourceFilter !== "all") q = q.eq("source", sourceFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { totalIn, totalOut } = useMemo(() => {
    let totalIn = 0, totalOut = 0;
    for (const e of entries) { if (e.direction === "in") totalIn += Number(e.amount); else totalOut += Number(e.amount); }
    return { totalIn, totalOut };
  }, [entries]);

  const createMut = useMutation({
    mutationFn: async () => {
      const entryNumber = `BL-${Date.now().toString(36).toUpperCase()}`;
      const amount = Number(form.amount);
      const entryDate = format(new Date(), "yyyy-MM-dd");
      const isIn = form.direction === "in";
      const modelCode = isIn ? "CASH_IN" : "CASH_OUT";
      const fallbackLines = isIn
        ? [{ accountCode: "1000", debit: amount, credit: 0, description: form.description, sortOrder: 1 }, { accountCode: "6990", debit: 0, credit: amount, description: form.description, sortOrder: 2 }]
        : [{ accountCode: "5790", debit: amount, credit: 0, description: form.description, sortOrder: 1 }, { accountCode: "1000", debit: 0, credit: amount, description: form.description, sortOrder: 2 }];
      const journalEntryId = await postWithRuleOrFallback({ tenantId: tenantId!, userId: user?.id || null, modelCode, amount, entryDate, description: `${t("cashRegister")}: ${form.description}`, reference: entryNumber, context: {}, fallbackLines });
      const { error } = await supabase.from("cash_register").insert({ tenant_id: tenantId!, entry_number: entryNumber, entry_date: entryDate, direction: form.direction, amount, description: form.description, document_ref: form.document_ref || null, created_by: user?.id || null, journal_entry_id: journalEntryId });
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: t("success") }); qc.invalidateQueries({ queryKey: ["cash-register"] }); setOpen(false); setForm({ direction: "in", amount: "", description: "", document_ref: "" }); },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  // P5-04: Compute running balance and sequential daily numbers
  const entriesWithBalance = useMemo(() => {
    let balance = 0;
    let seq = 0;
    return entries.map(e => {
      seq++;
      const amount = Number(e.amount);
      if (e.direction === "in") balance += amount;
      else balance -= amount;
      return { ...e, seq, runningBalance: balance };
    });
  }, [entries]);

  const columns: ResponsiveColumn<any>[] = [
    { key: "seq", label: "R.br.", primary: true, render: (e) => <span className="font-mono text-xs">{e.seq}</span> },
    { key: "entry_number", label: t("entryNumber"), sortable: true, sortValue: (e) => e.entry_number, render: (e) => <span className="font-mono text-xs">{e.entry_number} {(e as any).source === "pos" && <Badge variant="secondary" className="ml-1 text-[10px]">POS</Badge>}</span> },
    { key: "date", label: t("date"), sortable: true, sortValue: (e) => e.entry_date, render: (e) => new Date(e.entry_date).toLocaleDateString("sr-Latn-RS") },
    { key: "direction", label: t("direction"), sortable: true, sortValue: (e) => e.direction, render: (e) =>
      e.direction === "in"
        ? <Badge variant="default" className="gap-1"><ArrowDownLeft className="h-3 w-3" /> {t("receipt")}</Badge>
        : <Badge variant="secondary" className="gap-1"><ArrowUpRight className="h-3 w-3" /> {t("disbursement")}</Badge>
    },
    { key: "description", label: t("description"), hideOnMobile: true, render: (e) => e.description },
    { key: "document_ref", label: t("documentRef"), hideOnMobile: true, defaultVisible: false, render: (e) => <span className="text-xs text-muted-foreground">{e.document_ref || "—"}</span> },
    { key: "receipt_amount", label: t("receipt"), align: "right" as const, sortable: true, sortValue: (e) => e.direction === "in" ? Number(e.amount) : 0, render: (e) => e.direction === "in" ? <span className="text-green-600 tabular-nums">{Number(e.amount).toLocaleString("sr-RS", { minimumFractionDigits: 2 })}</span> : "" },
    { key: "disbursement_amount", label: t("disbursement"), align: "right" as const, sortable: true, sortValue: (e) => e.direction === "out" ? Number(e.amount) : 0, render: (e) => e.direction === "out" ? <span className="text-red-600 tabular-nums">{Number(e.amount).toLocaleString("sr-RS", { minimumFractionDigits: 2 })}</span> : "" },
    { key: "balance", label: t("balance"), align: "right" as const, render: (e) => <span className={`font-medium tabular-nums ${e.runningBalance >= 0 ? "" : "text-red-600"}`}>{e.runningBalance.toLocaleString("sr-RS", { minimumFractionDigits: 2 })}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("cashRegister")} description={t("cashRegisterDesc")} />

      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex gap-2">
          <Label>{t("month")}</Label><Input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="w-48" />
        </div>
        <div className="flex gap-2 items-end">
          <div className="flex gap-1">
            {["all", "manual", "pos"].map(s => (
              <Button key={s} size="sm" variant={sourceFilter === s ? "default" : "outline"} onClick={() => setSourceFilter(s)}>
                {s === "all" ? t("allSources" as any) : s === "manual" ? t("manualEntrySource" as any) : t("posSource" as any)}
              </Button>
            ))}
          </div>
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" /> {t("newEntry")}</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">{t("receipts")}</p><p className="text-lg font-bold text-green-600">{totalIn.toLocaleString("sr-RS")} RSD</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">{t("disbursements")}</p><p className="text-lg font-bold text-red-600">{totalOut.toLocaleString("sr-RS")} RSD</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">{t("balance")}</p><p className="text-lg font-bold">{(totalIn - totalOut).toLocaleString("sr-RS")} RSD</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Wallet className="h-4 w-4" /> {t("cashRegisterJournal")}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-60" /> : (
            <ResponsiveTable
              data={entriesWithBalance}
              columns={columns}
              keyExtractor={(e) => e.id}
              emptyMessage={t("noResults")}
              enableExport
              exportFilename="blagajnicki_dnevnik"
              renderFooter={() => (
                <TableRow>
                  <TableCell colSpan={6} className="font-semibold">{t("total")}</TableCell>
                  <TableCell className="text-right font-semibold text-green-600 tabular-nums">{totalIn.toLocaleString("sr-RS", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right font-semibold text-red-600 tabular-nums">{totalOut.toLocaleString("sr-RS", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{(totalIn - totalOut).toLocaleString("sr-RS", { minimumFractionDigits: 2 })}</TableCell>
                </TableRow>
              )}
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("newCashEntry")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("direction")}</Label>
              <Select value={form.direction} onValueChange={(v: "in" | "out") => setForm({ ...form, direction: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="in">{t("receipt")}</SelectItem><SelectItem value="out">{t("disbursement")}</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>{t("amountRSD")}</Label><Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            <div><Label>{t("description")}</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="npr. Nabavka kancelarijskog materijala" /></div>
            <div><Label>{t("documentRefOptional")}</Label><Input value={form.document_ref} onChange={(e) => setForm({ ...form, document_ref: e.target.value })} placeholder="npr. RN-001/26" /></div>
            {Number(form.amount) > 0 && <PostingPreviewPanel lines={buildCashPreviewLines(form.direction, Number(form.amount), form.description || "—")} />}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => createMut.mutate()} disabled={!form.description || !form.amount || createMut.isPending}>{createMut.isPending ? t("saving") : t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
