import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Globe, Users, User, Building2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import ImportChartOfAccounts from "@/components/accounting/ImportChartOfAccounts";
import { PageHeader } from "@/components/shared/PageHeader";
import { MobileFilterBar } from "@/components/shared/MobileFilterBar";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/shared/ResponsiveTable";

const ACCOUNT_TYPES = ["asset", "liability", "equity", "revenue", "expense"] as const;
const ANALYTICS_TYPES = [
  { value: "__none__", label: "noAnalytics" },
  { value: "PARTNER", label: "partner" },
  { value: "EMPLOYEE", label: "employee" },
  { value: "OBJECT", label: "costObject" },
] as const;

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
  analytics_type: string | null;
  is_foreign_currency: boolean;
  tracks_cost_center: boolean;
  tracks_cost_bearer: boolean;
  is_closing_account: boolean;
}

interface AccountForm {
  code: string;
  name: string;
  name_sr: string;
  account_type: string;
  parent_id: string;
  description: string;
  analytics_type: string;
  is_foreign_currency: boolean;
  tracks_cost_center: boolean;
  tracks_cost_bearer: boolean;
  is_closing_account: boolean;
}

const emptyForm: AccountForm = {
  code: "", name: "", name_sr: "", account_type: "asset", parent_id: "", description: "",
  analytics_type: "__none__", is_foreign_currency: false, tracks_cost_center: false, tracks_cost_bearer: false, is_closing_account: false,
};

const analyticsIcon = (type: string | null) => {
  if (type === "PARTNER") return <Users className="h-3.5 w-3.5" />;
  if (type === "EMPLOYEE") return <User className="h-3.5 w-3.5" />;
  if (type === "OBJECT") return <Building2 className="h-3.5 w-3.5" />;
  return null;
};

const analyticsColor = (type: string | null): string => {
  if (type === "PARTNER") return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
  if (type === "EMPLOYEE") return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
  if (type === "OBJECT") return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
  return "";
};

export default function ChartOfAccounts() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<AccountForm>(emptyForm);
  const [filterAnalytics, setFilterAnalytics] = useState<string>("all");

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["chart-of-accounts", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
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
        code: f.code, name: f.name, name_sr: f.name_sr || null,
        account_type: f.account_type, parent_id: f.parent_id || null,
        description: f.description || null, level, tenant_id: tenantId!,
        analytics_type: f.analytics_type === "__none__" ? null : f.analytics_type,
        is_foreign_currency: f.is_foreign_currency, tracks_cost_center: f.tracks_cost_center,
        tracks_cost_bearer: f.tracks_cost_bearer, is_closing_account: f.is_closing_account,
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
      setDialogOpen(false); setEditId(null); setForm(emptyForm);
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chart_of_accounts").delete().eq("id", id).eq("tenant_id", tenantId!);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["chart-of-accounts"] }); toast({ title: t("success") }); },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const openEdit = (a: Account) => {
    setEditId(a.id);
    setForm({
      code: a.code, name: a.name, name_sr: a.name_sr ?? "", account_type: a.account_type,
      parent_id: a.parent_id ?? "", description: a.description ?? "",
      analytics_type: a.analytics_type ?? "__none__",
      is_foreign_currency: a.is_foreign_currency ?? false,
      tracks_cost_center: a.tracks_cost_center ?? false,
      tracks_cost_bearer: a.tracks_cost_bearer ?? false,
      is_closing_account: a.is_closing_account ?? false,
    });
    setDialogOpen(true);
  };

  const openAdd = () => { setEditId(null); setForm(emptyForm); setDialogOpen(true); };

  const typeLabel = (t_key: string) => {
    const map: Record<string, () => string> = {
      asset: () => t("asset"), liability: () => t("liability"), equity: () => t("equity"),
      revenue: () => t("revenueType"), expense: () => t("expenseType"),
    };
    return map[t_key]?.() ?? t_key;
  };

  const filtered = accounts.filter(a => {
    const matchesSearch = a.code.toLowerCase().includes(search.toLowerCase()) || a.name.toLowerCase().includes(search.toLowerCase());
    const matchesAnalytics = filterAnalytics === "all" || (filterAnalytics === "none" ? !a.analytics_type : a.analytics_type === filterAnalytics);
    return matchesSearch && matchesAnalytics;
  });

  const columns: ResponsiveColumn<Account>[] = [
    {
      key: "code", label: t("accountCode"), primary: true, sortable: true,
      sortValue: (a) => a.code,
      render: (a) => (
        <span className="font-mono font-medium" style={{ paddingLeft: `${(a.level - 1) * 1.5}rem` }}>
          {a.code}
        </span>
      ),
    },
    { key: "name", label: t("accountName"), sortable: true, sortValue: (a) => a.name, render: (a) => a.name },
    { key: "type", label: t("accountType"), sortable: true, sortValue: (a) => a.account_type, render: (a) => <Badge variant="outline">{typeLabel(a.account_type)}</Badge> },
    {
      key: "analytics", label: t("analyticsLabel"), hideOnMobile: true,
      render: (a) => a.analytics_type ? (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${analyticsColor(a.analytics_type)}`}>
          {analyticsIcon(a.analytics_type)} {a.analytics_type}
        </span>
      ) : null,
    },
    {
      key: "flags", label: t("flags"), hideOnMobile: true, align: "center",
      render: (a) => (
        <div className="flex items-center justify-center gap-1">
          {a.is_foreign_currency && <span title="Foreign Currency"><Globe className="h-3.5 w-3.5 text-muted-foreground" /></span>}
          {a.tracks_cost_center && <span title="Cost Center"><Building2 className="h-3.5 w-3.5 text-muted-foreground" /></span>}
        </div>
      ),
    },
    { key: "level", label: t("level"), hideOnMobile: true, sortable: true, sortValue: (a) => a.level, render: (a) => a.level },
    {
      key: "status", label: t("status"), sortable: true, sortValue: (a) => a.is_active ? 1 : 0,
      render: (a) => <Badge variant={a.is_active ? "default" : "secondary"}>{a.is_active ? t("active") : t("inactive")}</Badge>,
    },
    {
      key: "actions", label: t("actions"), align: "right", showInCard: false,
      render: (a) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEdit(a); }}><Pencil className="h-4 w-4" /></Button>
          {!a.is_system && (
            <AlertDialog>
              <AlertDialogTrigger asChild><Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>{t("confirm")}</AlertDialogTitle><AlertDialogDescription>{t("deleteConfirmation")}</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>{t("cancel")}</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate(a.id)}>{t("delete")}</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      ),
    },
  ];

  if (isLoading) return <p>{t("loading")}</p>;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("chartOfAccounts")}
        actions={
          <div className="flex gap-2">
            <ImportChartOfAccounts />
            <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />{t("add")}</Button>
          </div>
        }
      />

      <MobileFilterBar
        search={<Input placeholder={t("search")} value={search} onChange={e => setSearch(e.target.value)} />}
        filters={
          <div className="flex items-center gap-3">
            <Select value={filterAnalytics} onValueChange={setFilterAnalytics}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allAccounts")}</SelectItem>
                <SelectItem value="none">{t("noAnalytics")}</SelectItem>
                <SelectItem value="PARTNER">{t("partner")}</SelectItem>
                <SelectItem value="EMPLOYEE">{t("employee")}</SelectItem>
                <SelectItem value="OBJECT">{t("costObject")}</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">{filtered.length} / {accounts.length}</span>
          </div>
        }
      />

      <ResponsiveTable
        data={filtered}
        columns={columns}
        keyExtractor={(a) => a.id}
        emptyMessage={t("noResults")}
        enableColumnToggle
        enableExport
        exportFilename="chart-of-accounts"
        mobileMode="scroll"
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? t("edit") : t("add")} — {t("account")}</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>{t("accountCode")}</Label>
                <Input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} required minLength={4} pattern=".{4,}" title="Account code must be at least 4 characters" />
                {form.code.length > 0 && form.code.length < 4 && (
                  <p className="text-xs text-destructive">Min. 4 characters required</p>
                )}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <Label>{t("analyticsType")}</Label>
                <Select value={form.analytics_type} onValueChange={v => setForm(p => ({ ...p, analytics_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ANALYTICS_TYPES.map(at => <SelectItem key={at.value} value={at.value}>{t(at.label)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>{t("description")}</Label>
              <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>

            <div className="border rounded-md p-3 space-y-3">
              <p className="text-sm font-medium text-muted-foreground">{t("accountFlags")}</p>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={form.is_foreign_currency} onCheckedChange={v => setForm(p => ({ ...p, is_foreign_currency: v }))} />
                  <Globe className="h-3.5 w-3.5" /> {t("foreignCurrency")}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={form.tracks_cost_center} onCheckedChange={v => setForm(p => ({ ...p, tracks_cost_center: v }))} />
                  {t("tracksCostCenter")}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={form.tracks_cost_bearer} onCheckedChange={v => setForm(p => ({ ...p, tracks_cost_bearer: v }))} />
                  {t("tracksCostBearer")}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={form.is_closing_account} onCheckedChange={v => setForm(p => ({ ...p, is_closing_account: v }))} />
                  {t("closingAccount")}
                </label>
              </div>
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
