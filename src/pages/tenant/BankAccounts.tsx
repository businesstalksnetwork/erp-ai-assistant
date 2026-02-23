import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type BankAccount = Tables<"bank_accounts">;
const emptyForm = { bank_name: "", account_number: "", currency: "RSD", is_primary: false, is_active: true, legal_entity_id: "" as string | null };

export default function BankAccounts() {
  const { t } = useLanguage();
  const { tenantId, isLoading: tenantLoading } = useTenant();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["bank_accounts", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("bank_accounts").select("*, legal_entities(name)").eq("tenant_id", tenantId!);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: legalEntities = [] } = useQuery({
    queryKey: ["legal_entities", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("legal_entities").select("id, name").eq("tenant_id", tenantId!);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { bank_name: form.bank_name, account_number: form.account_number, currency: form.currency, is_primary: form.is_primary, is_active: form.is_active, legal_entity_id: form.legal_entity_id || null };
      if (editing) {
        const { error } = await supabase.from("bank_accounts").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("bank_accounts").insert({ ...payload, tenant_id: tenantId! });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bank_accounts", tenantId] }); toast({ title: t("success") }); closeDialog(); },
    onError: () => toast({ title: t("error"), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("bank_accounts").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bank_accounts", tenantId] }); toast({ title: t("success") }); setDeleteId(null); },
    onError: () => toast({ title: t("error"), variant: "destructive" }),
  });

  const openEdit = (a: BankAccount) => {
    setEditing(a);
    setForm({ bank_name: a.bank_name, account_number: a.account_number, currency: a.currency, is_primary: a.is_primary, is_active: a.is_active, legal_entity_id: a.legal_entity_id });
    setDialogOpen(true);
  };
  const openAdd = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const closeDialog = () => { setDialogOpen(false); setEditing(null); };
  const filtered = accounts.filter(a => a.bank_name.toLowerCase().includes(search.toLowerCase()) || a.account_number.includes(search));

  if (tenantLoading || isLoading) return <div className="p-6">{t("loading")}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("bankAccounts")}</h1>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />{t("add")}</Button>
      </div>
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder={t("search")} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("bankName")}</TableHead>
              <TableHead>{t("accountNumber")}</TableHead>
              <TableHead>{t("currency")}</TableHead>
              <TableHead>{t("legalEntity")}</TableHead>
              <TableHead>{t("primary")}</TableHead>
              <TableHead className="w-24">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>
            ) : filtered.map(a => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.bank_name}</TableCell>
                <TableCell className="font-mono">{a.account_number}</TableCell>
                <TableCell>{a.currency}</TableCell>
                <TableCell>{(a as any).legal_entities?.name ?? "—"}</TableCell>
                <TableCell>{a.is_primary && <Badge>{t("primary")}</Badge>}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(a)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(a.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? t("edit") : t("add")} {t("bankAccount")}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div><Label>{t("bankName")}</Label><Input value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} /></div>
            <div><Label>{t("accountNumber")}</Label><Input value={form.account_number} onChange={e => setForm(f => ({ ...f, account_number: e.target.value }))} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>{t("currency")}</Label><Input value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} /></div>
              <div><Label>{t("legalEntity")}</Label>
                <Select value={form.legal_entity_id || "none"} onValueChange={v => setForm(f => ({ ...f, legal_entity_id: v === "none" ? null : v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {legalEntities.map(le => <SelectItem key={le.id} value={le.id}>{le.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2"><Switch checked={form.is_primary} onCheckedChange={v => setForm(f => ({ ...f, is_primary: v }))} /><Label>{t("primary")}</Label></div>
              <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} /><Label>{t("active")}</Label></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>{t("cancel")}</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.bank_name || !form.account_number || saveMutation.isPending}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t("confirm")}</AlertDialogTitle><AlertDialogDescription>{t("deleteConfirmation")}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>{t("delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
