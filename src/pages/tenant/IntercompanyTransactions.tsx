import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { useLegalEntities } from "@/hooks/useLegalEntities";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, ArrowRightLeft, Trash2, BookOpen } from "lucide-react";
import { postWithRuleOrFallback } from "@/lib/postingHelper";
import { format } from "date-fns";

export default function IntercompanyTransactions() {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const { entities: legalEntities } = useLegalEntities();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    from_legal_entity_id: "", to_legal_entity_id: "", amount: "", description: "", reference: "", notes: "",
  });

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["intercompany-transactions", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase.from("intercompany_transactions")
        .select("*, from_entity:from_legal_entity_id(name), to_entity:to_legal_entity_id(name)")
        .eq("tenant_id", tenantId).order("transaction_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("intercompany_transactions").insert({
        tenant_id: tenantId!, from_legal_entity_id: form.from_legal_entity_id,
        to_legal_entity_id: form.to_legal_entity_id, amount: Number(form.amount),
        description: form.description, reference: form.reference || null,
        notes: form.notes || null, created_by: user?.id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: t("intercompanyCreated") });
      qc.invalidateQueries({ queryKey: ["intercompany-transactions"] });
      setOpen(false);
      setForm({ from_legal_entity_id: "", to_legal_entity_id: "", amount: "", description: "", reference: "", notes: "" });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("intercompany_transactions").delete().eq("id", id).eq("status", "draft").eq("tenant_id", tenantId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: t("success") });
      qc.invalidateQueries({ queryKey: ["intercompany-transactions"] });
    },
  });

  /** Post a draft intercompany transaction: create GL journal entry + update status */
  const postMut = useMutation({
    mutationFn: async (tr: any) => {
      const amount = Number(tr.amount);
      const fromName = (tr.from_entity as any)?.name || "?";
      const toName = (tr.to_entity as any)?.name || "?";
      const desc = `${t("intercompanyTransactions")}: ${fromName} → ${toName}`;

      // Default intercompany posting: DR 2040 (receivable from entity) / CR 4350 (payable to entity)
      const journalEntryId = await postWithRuleOrFallback({
        tenantId: tenantId!,
        userId: user?.id || null,
        modelCode: "INTERCOMPANY_POST",
        amount,
        entryDate: tr.transaction_date || format(new Date(), "yyyy-MM-dd"),
        description: desc,
        reference: tr.reference || `IC-${tr.id.substring(0, 8)}`,
        context: {
          partnerReceivableCode: "2040",
          partnerPayableCode: "4350",
        },
        fallbackLines: [
          { accountCode: "2040", debit: amount, credit: 0, description: `${desc} (receivable)`, sortOrder: 1 },
          { accountCode: "4350", debit: 0, credit: amount, description: `${desc} (payable)`, sortOrder: 2 },
        ],
      });

      // Update transaction status to posted
      const { error } = await supabase
        .from("intercompany_transactions")
        .update({ status: "posted", journal_entry_id: journalEntryId } as any)
        .eq("id", tr.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: t("success") });
      qc.invalidateQueries({ queryKey: ["intercompany-transactions"] });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const statusColors: Record<string, "default" | "secondary" | "destructive"> = { draft: "secondary", posted: "default", eliminated: "destructive" };
  const totalAmount = transactions.reduce((s: number, t: any) => s + Number(t.amount || 0), 0);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader title={t("intercompanyTransactions")} description={t("intercompanyTransactionsDesc")} />

      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{t("total")}: <span className="font-semibold">{totalAmount.toLocaleString("sr-RS")} RSD</span></p>
        <Button onClick={() => setOpen(true)} disabled={legalEntities.length < 2}>
          <Plus className="h-4 w-4 mr-2" /> {t("newTransaction")}
        </Button>
      </div>

      {legalEntities.length < 2 && (
        <Card><CardContent className="p-4 text-center text-muted-foreground">{t("needTwoEntities")}</CardContent></Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><ArrowRightLeft className="h-4 w-4" /> {t("transactions")}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">{t("loading")}</p>
          ) : transactions.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("noResults")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead>{t("from")}</TableHead>
                  <TableHead>{t("to")}</TableHead>
                  <TableHead>{t("description")}</TableHead>
                  <TableHead className="text-right">{t("amount")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead className="text-right">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tr: any) => (
                  <TableRow key={tr.id}>
                    <TableCell>{tr.transaction_date}</TableCell>
                    <TableCell className="font-medium">{(tr.from_entity as any)?.name || "—"}</TableCell>
                    <TableCell className="font-medium">{(tr.to_entity as any)?.name || "—"}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{tr.description}</TableCell>
                    <TableCell className="text-right font-semibold">{Number(tr.amount).toLocaleString("sr-RS")}</TableCell>
                    <TableCell><Badge variant={statusColors[tr.status] || "secondary"}>{tr.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      {tr.status === "draft" && (
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => postMut.mutate(tr)} title={t("postEntry")} disabled={postMut.isPending}>
                            <BookOpen className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => deleteMut.mutate(tr.id)} className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("newIntercompanyTransaction")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("fromLegalEntity")}</Label>
                <Select value={form.from_legal_entity_id} onValueChange={(v) => setForm({ ...form, from_legal_entity_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{legalEntities.map((le: any) => (<SelectItem key={le.id} value={le.id}>{le.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("toLegalEntity")}</Label>
                <Select value={form.to_legal_entity_id} onValueChange={(v) => setForm({ ...form, to_legal_entity_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{legalEntities.filter((le: any) => le.id !== form.from_legal_entity_id).map((le: any) => (<SelectItem key={le.id} value={le.id}>{le.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>{t("amountRSD")}</Label><Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            <div><Label>{t("description")}</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div><Label>{t("referenceOptional")}</Label><Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => createMut.mutate()} disabled={!form.from_legal_entity_id || !form.to_legal_entity_id || !form.amount || !form.description || createMut.isPending}>
              {createMut.isPending ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
