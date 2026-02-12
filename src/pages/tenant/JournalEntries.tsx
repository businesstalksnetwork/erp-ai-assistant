import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Search, Eye, CheckCircle, Trash2 } from "lucide-react";

interface JournalLine {
  id?: string;
  account_id: string;
  description: string;
  debit: number;
  credit: number;
}

const emptyLine: JournalLine = { account_id: "", description: "", debit: 0, credit: 0 };

export default function JournalEntries() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewEntry, setViewEntry] = useState<any>(null);

  const [form, setForm] = useState({ entry_number: "", entry_date: new Date().toISOString().split("T")[0], description: "", reference: "" });
  const [lines, setLines] = useState<JournalLine[]>([{ ...emptyLine }, { ...emptyLine }]);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["journal-entries", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("journal_entries")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("entry_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["chart-of-accounts", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("code");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const totalDebit = lines.reduce((s, l) => s + Number(l.debit), 0);
      const totalCredit = lines.reduce((s, l) => s + Number(l.credit), 0);
      if (Math.abs(totalDebit - totalCredit) > 0.001) throw new Error(t("journalMustBalance"));
      if (lines.some(l => !l.account_id)) throw new Error(t("selectAccount"));

      const { data: entry, error: entryError } = await supabase
        .from("journal_entries")
        .insert({
          tenant_id: tenantId!,
          entry_number: form.entry_number,
          entry_date: form.entry_date,
          description: form.description || null,
          reference: form.reference || null,
          created_by: user?.id,
        })
        .select("id")
        .single();
      if (entryError) throw entryError;

      const linePayloads = lines.filter(l => l.account_id).map((l, i) => ({
        journal_entry_id: entry.id,
        account_id: l.account_id,
        description: l.description || null,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
        sort_order: i,
      }));
      const { error: linesError } = await supabase.from("journal_lines").insert(linePayloads);
      if (linesError) throw linesError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["journal-entries"] });
      toast({ title: t("success") });
      setDialogOpen(false);
      resetForm();
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const postMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("journal_entries").update({ status: "posted", posted_at: new Date().toISOString(), posted_by: user?.id }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["journal-entries"] });
      toast({ title: t("entryPostedSuccess") });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("journal_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["journal-entries"] });
      toast({ title: t("success") });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const resetForm = () => {
    setForm({ entry_number: "", entry_date: new Date().toISOString().split("T")[0], description: "", reference: "" });
    setLines([{ ...emptyLine }, { ...emptyLine }]);
  };

  const viewEntryDetails = async (entry: any) => {
    const { data } = await supabase
      .from("journal_lines")
      .select("*, chart_of_accounts:account_id(code, name)")
      .eq("journal_entry_id", entry.id)
      .order("sort_order");
    setViewEntry({ ...entry, lines: data ?? [] });
    setViewDialogOpen(true);
  };

  const updateLine = (idx: number, field: keyof JournalLine, value: string | number) => {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  };

  const totalDebit = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const statusBadge = (status: string) => {
    const variant = status === "posted" ? "default" : status === "reversed" ? "destructive" : "secondary";
    const label = status === "posted" ? t("posted") : status === "reversed" ? t("reversed") : t("draft");
    return <Badge variant={variant}>{label}</Badge>;
  };

  const filtered = entries.filter(e =>
    e.entry_number?.toLowerCase().includes(search.toLowerCase()) ||
    e.description?.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) return <p>{t("loading")}</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("journalEntries")}</h1>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }}><Plus className="h-4 w-4 mr-2" />{t("add")}</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder={t("search")} value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("entryNumber")}</TableHead>
              <TableHead>{t("entryDate")}</TableHead>
              <TableHead>{t("description")}</TableHead>
              <TableHead>{t("reference")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead className="text-right">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>
            ) : filtered.map(e => (
              <TableRow key={e.id}>
                <TableCell className="font-mono">{e.entry_number}</TableCell>
                <TableCell>{e.entry_date}</TableCell>
                <TableCell>{e.description || "—"}</TableCell>
                <TableCell>{e.reference || "—"}</TableCell>
                <TableCell>{statusBadge(e.status)}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="icon" onClick={() => viewEntryDetails(e)}><Eye className="h-4 w-4" /></Button>
                  {e.status === "draft" && (
                    <>
                      <Button variant="ghost" size="icon" onClick={() => postMutation.mutate(e.id)} title={t("postEntry")}><CheckCircle className="h-4 w-4" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>{t("confirm")}</AlertDialogTitle><AlertDialogDescription>{t("deleteConfirmation")}</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel>{t("cancel")}</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate(e.id)}>{t("delete")}</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("add")} — {t("journalEntries")}</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><Label>{t("entryNumber")}</Label><Input value={form.entry_number} onChange={e => setForm(p => ({ ...p, entry_number: e.target.value }))} required /></div>
              <div className="space-y-1"><Label>{t("entryDate")}</Label><Input type="date" value={form.entry_date} onChange={e => setForm(p => ({ ...p, entry_date: e.target.value }))} required /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><Label>{t("description")}</Label><Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
              <div className="space-y-1"><Label>{t("reference")}</Label><Input value={form.reference} onChange={e => setForm(p => ({ ...p, reference: e.target.value }))} /></div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">{t("journalEntries")}</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => setLines(p => [...p, { ...emptyLine }])}>{t("addLine")}</Button>
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[250px]">{t("account")}</TableHead>
                      <TableHead>{t("description")}</TableHead>
                      <TableHead className="w-[120px]">{t("debit")}</TableHead>
                      <TableHead className="w-[120px]">{t("credit")}</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((line, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <Select value={line.account_id} onValueChange={v => updateLine(idx, "account_id", v)}>
                            <SelectTrigger className="h-8"><SelectValue placeholder={t("selectAccount")} /></SelectTrigger>
                            <SelectContent>
                              {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell><Input className="h-8" value={line.description} onChange={e => updateLine(idx, "description", e.target.value)} /></TableCell>
                        <TableCell><Input className="h-8 text-right" type="number" min="0" step="0.01" value={line.debit || ""} onChange={e => updateLine(idx, "debit", e.target.value)} /></TableCell>
                        <TableCell><Input className="h-8 text-right" type="number" min="0" step="0.01" value={line.credit || ""} onChange={e => updateLine(idx, "credit", e.target.value)} /></TableCell>
                        <TableCell>
                          {lines.length > 2 && <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setLines(p => p.filter((_, i) => i !== idx))}><Trash2 className="h-3 w-3" /></Button>}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-semibold bg-muted/50">
                      <TableCell colSpan={2} className="text-right">{t("totalDebit")} / {t("totalCredit")}</TableCell>
                      <TableCell className="text-right">{totalDebit.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{totalCredit.toFixed(2)}</TableCell>
                      <TableCell><Badge variant={isBalanced ? "default" : "destructive"}>{isBalanced ? t("balanced") : t("unbalanced")}</Badge></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{t("cancel")}</Button>
              <Button type="submit" disabled={createMutation.isPending || !isBalanced}>{t("save")}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* View dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{viewEntry?.entry_number} — {viewEntry?.description || t("journalEntries")}</DialogTitle></DialogHeader>
          {viewEntry && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div><span className="text-muted-foreground">{t("entryDate")}:</span> {viewEntry.entry_date}</div>
                <div><span className="text-muted-foreground">{t("reference")}:</span> {viewEntry.reference || "—"}</div>
                <div><span className="text-muted-foreground">{t("status")}:</span> {statusBadge(viewEntry.status)}</div>
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("account")}</TableHead>
                      <TableHead>{t("description")}</TableHead>
                      <TableHead className="text-right">{t("debit")}</TableHead>
                      <TableHead className="text-right">{t("credit")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewEntry.lines?.map((l: any) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-mono">{l.chart_of_accounts?.code} — {l.chart_of_accounts?.name}</TableCell>
                        <TableCell>{l.description || "—"}</TableCell>
                        <TableCell className="text-right">{Number(l.debit) > 0 ? Number(l.debit).toFixed(2) : "—"}</TableCell>
                        <TableCell className="text-right">{Number(l.credit) > 0 ? Number(l.credit).toFixed(2) : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
