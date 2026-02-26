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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import ImportChartOfAccounts from "@/components/accounting/ImportChartOfAccounts";

const ACCOUNT_TYPES = ["asset", "liability", "equity", "revenue", "expense"] as const;

interface Account {
  id: string;
  code: string;
  name: string;
  name_sr: string | null;
  account_type: string;
  parent_id: string | null;
  level: number;
  is_active: boolean;
  is_system: boolean;
  description: string | null;
}

interface AccountForm {
  code: string;
  name: string;
  name_sr: string;
  account_type: string;
  parent_id: string;
  description: string;
}

const emptyForm: AccountForm = { code: "", name: "", name_sr: "", account_type: "asset", parent_id: "", description: "" };

export default function ChartOfAccounts() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<AccountForm>(emptyForm);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["chart-of-accounts", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      // Fetch all rows in batches to avoid Supabase 1000-row limit
      const allData: Account[] = [];
      const batchSize = 1000;
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from("chart_of_accounts")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("code")
          .range(offset, offset + batchSize - 1);
        if (error) throw error;
        if (data && data.length > 0) {
          allData.push(...(data as Account[]));
          offset += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }
      return allData;
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 5,
  });

  const saveMutation = useMutation({
    mutationFn: async (f: AccountForm) => {
      const parentAccount = f.parent_id ? accounts.find(a => a.id === f.parent_id) : null;
      const level = parentAccount ? parentAccount.level + 1 : 1;
      const payload = {
        code: f.code,
        name: f.name,
        name_sr: f.name_sr || null,
        account_type: f.account_type,
        parent_id: f.parent_id || null,
        description: f.description || null,
        level,
        tenant_id: tenantId!,
      };
      if (editId) {
        const { error } = await supabase.from("chart_of_accounts").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("chart_of_accounts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chart-of-accounts"] });
      toast({ title: t("success") });
      setDialogOpen(false);
      setEditId(null);
      setForm(emptyForm);
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chart_of_accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chart-of-accounts"] });
      toast({ title: t("success") });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const openEdit = (a: Account) => {
    setEditId(a.id);
    setForm({ code: a.code, name: a.name, name_sr: a.name_sr ?? "", account_type: a.account_type, parent_id: a.parent_id ?? "", description: a.description ?? "" });
    setDialogOpen(true);
  };

  const openAdd = () => {
    setEditId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const typeLabel = (t_key: string) => {
    const map: Record<string, () => string> = {
      asset: () => t("asset"),
      liability: () => t("liability"),
      equity: () => t("equity"),
      revenue: () => t("revenueType"),
      expense: () => t("expenseType"),
    };
    return map[t_key]?.() ?? t_key;
  };

  const filtered = accounts.filter(a =>
    a.code.toLowerCase().includes(search.toLowerCase()) ||
    a.name.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) return <p>{t("loading")}</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("chartOfAccounts")}</h1>
        <div className="flex gap-2">
          <ImportChartOfAccounts />
          <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />{t("add")}</Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder={t("search")} value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("accountCode")}</TableHead>
              <TableHead>{t("accountName")}</TableHead>
              <TableHead>{t("accountType")}</TableHead>
              <TableHead>{t("level")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead className="text-right">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>
            ) : filtered.map(a => (
              <TableRow key={a.id} style={{ paddingLeft: `${(a.level - 1) * 1.5}rem` }}>
                <TableCell className="font-mono font-medium" style={{ paddingLeft: `${(a.level - 1) * 1.5 + 1}rem` }}>{a.code}</TableCell>
                <TableCell>{a.name}</TableCell>
                <TableCell><Badge variant="outline">{typeLabel(a.account_type)}</Badge></TableCell>
                <TableCell>{a.level}</TableCell>
                <TableCell><Badge variant={a.is_active ? "default" : "secondary"}>{a.is_active ? t("active") : t("inactive")}</Badge></TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(a)}><Pencil className="h-4 w-4" /></Button>
                  {!a.is_system && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>{t("confirm")}</AlertDialogTitle><AlertDialogDescription>{t("deleteConfirmation")}</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>{t("cancel")}</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate(a.id)}>{t("delete")}</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? t("edit") : t("add")} — {t("account")}</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>{t("accountCode")}</Label>
                <Input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} required />
              </div>
              <div className="space-y-1">
                <Label>{t("accountType")}</Label>
                <Select value={form.account_type} onValueChange={v => setForm(p => ({ ...p, account_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map(at => <SelectItem key={at} value={at}>{typeLabel(at)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>{t("accountName")}</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
            </div>
            <div className="space-y-1">
              <Label>{t("accountNameSr")}</Label>
              <Input value={form.name_sr} onChange={e => setForm(p => ({ ...p, name_sr: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>{t("parentAccount")}</Label>
              <Select value={form.parent_id || "__none__"} onValueChange={v => setForm(p => ({ ...p, parent_id: v === "__none__" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder={t("noParent")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("noParent")}</SelectItem>
                  {accounts.filter(a => a.id !== editId).map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t("description")}</Label>
              <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{t("cancel")}</Button>
              <Button type="submit" disabled={saveMutation.isPending}>{t("save")}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
