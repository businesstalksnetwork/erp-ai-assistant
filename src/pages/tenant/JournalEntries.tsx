import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useLegalEntities } from "@/hooks/useLegalEntities";
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
import { Plus, Eye, CheckCircle, Trash2, RotateCcw, Calculator } from "lucide-react";
import { ExportButton } from "@/components/ExportButton";
import { PageHeader } from "@/components/shared/PageHeader";
import { MobileFilterBar } from "@/components/shared/MobileFilterBar";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/shared/ResponsiveTable";
import { MobileActionMenu, type ActionItem } from "@/components/shared/MobileActionMenu";
import { useDebounce } from "@/hooks/useDebounce";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";

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
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get("filter") || "all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewEntry, setViewEntry] = useState<any>(null);
  const [legalEntityFilter, setLegalEntityFilter] = useState<string>("all");
  const { entities: legalEntities } = useLegalEntities();

  const [form, setForm] = useState({ entry_number: "", entry_date: new Date().toISOString().split("T")[0], description: "", reference: "", legal_entity_id: "" });
  const [lines, setLines] = useState<JournalLine[]>([{ ...emptyLine }, { ...emptyLine }]);

  useEffect(() => {
    if (legalEntities.length === 1 && !form.legal_entity_id) {
      setForm(p => ({ ...p, legal_entity_id: legalEntities[0].id }));
    }
  }, [legalEntities, form.legal_entity_id]);

  const debouncedSearch = useDebounce(search, 300);

  const { data: entries = [], isLoading, page, setPage, hasMore } = usePaginatedQuery({
    queryKey: ["journal-entries", tenantId, legalEntityFilter],
    queryFn: async ({ from, to }) => {
      if (!tenantId) return [];
      let query = supabase
        .from("journal_entries")
        .select("*, legal_entities(name)")
        .eq("tenant_id", tenantId)
        .order("entry_date", { ascending: false })
        .range(from, to);
      if (legalEntityFilter !== "all") {
        query = query.eq("legal_entity_id", legalEntityFilter);
      }
      const { data, error } = await query;
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
      const linePayloads = lines.filter(l => l.account_id).map((l, i) => ({
        account_id: l.account_id, description: l.description || null,
        debit: Number(l.debit) || 0, credit: Number(l.credit) || 0, sort_order: i,
      }));
      const { error } = await supabase.rpc("create_journal_entry_with_lines" as any, {
        p_tenant_id: tenantId!, p_entry_number: form.entry_number, p_entry_date: form.entry_date,
        p_description: form.description || null, p_reference: form.reference || null,
        p_legal_entity_id: form.legal_entity_id || null, p_lines: linePayloads,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["journal-entries"] }); toast({ title: t("success") }); setDialogOpen(false); resetForm(); },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const postMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("journal_entries").update({ status: "posted", posted_at: new Date().toISOString(), posted_by: user?.id }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["journal-entries"] }); toast({ title: t("entryPostedSuccess") }); },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const entry = entries.find(e => e.id === id);
      if (entry?.status === "posted") throw new Error(t("cannotDeletePosted"));
      const { error } = await supabase.from("journal_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["journal-entries"] }); toast({ title: t("success") }); },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const stornoMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("storno_journal_entry" as any, { p_journal_entry_id: id });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["journal-entries"] }); toast({ title: t("stornoCreated") }); },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const resetForm = () => {
    setForm({ entry_number: "", entry_date: new Date().toISOString().split("T")[0], description: "", reference: "", legal_entity_id: "" });
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

  const filtered = useMemo(() => entries.filter(e => {
    const matchesSearch = !debouncedSearch ||
      e.entry_number?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      e.description?.toLowerCase().includes(debouncedSearch.toLowerCase());
    const matchesStatus = statusFilter === "all" || e.status === statusFilter;
    return matchesSearch && matchesStatus;
  }), [entries, debouncedSearch, statusFilter]);

  const columns: ResponsiveColumn<any>[] = [
    { key: "entry_number", label: t("entryNumber"), primary: true, render: (e) => <span className="font-mono">{e.entry_number}</span> },
    { key: "entry_date", label: t("entryDate"), render: (e) => e.entry_date },
    { key: "description", label: t("description"), hideOnMobile: true, render: (e) => e.description || "—" },
    { key: "reference", label: t("reference"), hideOnMobile: true, render: (e) => e.reference || "—" },
    ...(legalEntities.length > 1 ? [{ key: "legal_entity", label: t("legalEntity"), hideOnMobile: true, render: (e: any) => e.legal_entities?.name || "—" } as ResponsiveColumn<any>] : []),
    { key: "status", label: t("status"), render: (e) => statusBadge(e.status) },
    { key: "actions", label: t("actions"), align: "right" as const, showInCard: false, render: (e) => {
      const actions: ActionItem[] = [
        { label: t("view"), icon: <Eye className="h-4 w-4" />, onClick: () => viewEntryDetails(e) },
      ];
      if (e.status === "posted" && !(e as any).is_storno && !(e as any).storno_by_id) {
        actions.push({ label: t("storno"), icon: <RotateCcw className="h-4 w-4" />, onClick: () => stornoMutation.mutate(e.id) });
      }
      if (e.status === "draft") {
        actions.push({ label: t("postEntry"), icon: <CheckCircle className="h-4 w-4" />, onClick: () => postMutation.mutate(e.id) });
        actions.push({ label: t("delete"), icon: <Trash2 className="h-4 w-4" />, onClick: () => deleteMutation.mutate(e.id), variant: "destructive" });
      }
      return <MobileActionMenu actions={actions} />;
    }},
  ];

  if (isLoading) return <p>{t("loading")}</p>;

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <PageHeader
        title={t("journalEntries")}
        description={"Double-entry bookkeeping journal"}
        icon={Calculator}
        actions={
          <div className="flex gap-2">
            <ExportButton
              data={filtered}
              columns={[
                { key: "entry_number", label: t("entryNumber") },
                { key: "entry_date", label: t("entryDate") },
                { key: "description", label: t("description") },
                { key: "reference", label: t("reference") },
                { key: "status", label: t("status") },
              ]}
              filename="journal_entries"
            />
            <Button onClick={() => { resetForm(); setDialogOpen(true); }}><Plus className="h-4 w-4 mr-2" />{t("add")}</Button>
          </div>
        }
      />

      <MobileFilterBar
        search={<Input placeholder={t("search")} value={search} onChange={e => setSearch(e.target.value)} />}
        filters={
          <>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allStatuses")}</SelectItem>
                <SelectItem value="draft">{t("draft")}</SelectItem>
                <SelectItem value="posted">{t("posted")}</SelectItem>
                <SelectItem value="reversed">{t("reversed")}</SelectItem>
              </SelectContent>
            </Select>
            {legalEntities.length > 1 && (
              <Select value={legalEntityFilter} onValueChange={setLegalEntityFilter}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allLegalEntities")}</SelectItem>
                  {legalEntities.map(e => <SelectItem key={e.id} value={e.id}>{e.name} ({e.pib})</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </>
        }
      />

      <ResponsiveTable
        data={filtered}
        columns={columns}
        keyExtractor={(e) => e.id}
        emptyMessage={t("noResults")}
      />

      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious onClick={() => setPage(Math.max(0, page - 1))} className={page === 0 ? "pointer-events-none opacity-50" : "cursor-pointer"} />
          </PaginationItem>
          <PaginationItem>
            <span className="px-3 py-2 text-sm text-muted-foreground">{t("page")} {page + 1}</span>
          </PaginationItem>
          <PaginationItem>
            <PaginationNext onClick={() => hasMore && setPage(page + 1)} className={!hasMore ? "pointer-events-none opacity-50" : "cursor-pointer"} />
          </PaginationItem>
        </PaginationContent>
      </Pagination>

      {/* Create dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("add")} — {t("journalEntries")}</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1"><Label>{t("entryNumber")}</Label><Input value={form.entry_number} onChange={e => setForm(p => ({ ...p, entry_number: e.target.value }))} required /></div>
              <div className="space-y-1"><Label>{t("entryDate")}</Label><Input type="date" value={form.entry_date} onChange={e => setForm(p => ({ ...p, entry_date: e.target.value }))} required /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1"><Label>{t("description")}</Label><Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
              <div className="space-y-1"><Label>{t("reference")}</Label><Input value={form.reference} onChange={e => setForm(p => ({ ...p, reference: e.target.value }))} /></div>
            </div>
            {legalEntities.length > 0 && (
              <div className="space-y-1 max-w-sm">
                <Label>{t("legalEntity")}</Label>
                <Select value={form.legal_entity_id} onValueChange={v => setForm(p => ({ ...p, legal_entity_id: v }))}>
                  <SelectTrigger><SelectValue placeholder={t("selectLegalEntity")} /></SelectTrigger>
                  <SelectContent>
                    {legalEntities.map(e => <SelectItem key={e.id} value={e.id}>{e.name} ({e.pib})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
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
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              {!isBalanced && <p className="text-sm text-destructive">{t("journalMustBalance")}</p>}
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
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>{viewEntry?.entry_number}</DialogTitle></DialogHeader>
          {viewEntry && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">{t("entryDate")}:</span> {viewEntry.entry_date}</div>
                <div><span className="text-muted-foreground">{t("status")}:</span> {statusBadge(viewEntry.status)}</div>
                <div><span className="text-muted-foreground">{t("description")}:</span> {viewEntry.description || "—"}</div>
                <div><span className="text-muted-foreground">{t("reference")}:</span> {viewEntry.reference || "—"}</div>
              </div>
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
                      <TableCell>{l.chart_of_accounts?.code} — {l.chart_of_accounts?.name}</TableCell>
                      <TableCell>{l.description || "—"}</TableCell>
                      <TableCell className="text-right">{Number(l.debit) > 0 ? Number(l.debit).toFixed(2) : ""}</TableCell>
                      <TableCell className="text-right">{Number(l.credit) > 0 ? Number(l.credit).toFixed(2) : ""}</TableCell>
                    </TableRow>
                  ))}</TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
