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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Search, Users, TrendingUp, Store, Briefcase } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { MobileFilterBar } from "@/components/shared/MobileFilterBar";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/shared/ResponsiveTable";

const emptyForm = { first_name: "", last_name: "", code: "", email: "", phone: "", commission_rate: 0, is_active: true, role_type: "in_store" as string, default_location_id: "" as string };

export default function Salespeople() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: salespeople = [], isLoading } = useQuery({
    queryKey: ["salespeople", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("salespeople").select("*").eq("tenant_id", tenantId!).order("code");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: locations = [] } = useQuery({
    queryKey: ["locations_shops", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("locations").select("*").eq("tenant_id", tenantId!).in("type", ["shop", "branch"]);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = { ...form, default_location_id: form.role_type === "in_store" && form.default_location_id ? form.default_location_id : null };
      if (editing) {
        const { error } = await supabase.from("salespeople").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("salespeople").insert({ ...payload, tenant_id: tenantId! });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["salespeople", tenantId] }); toast({ title: t("success") }); closeDialog(); },
    onError: () => toast({ title: t("error"), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("salespeople").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["salespeople", tenantId] }); toast({ title: t("success") }); setDeleteId(null); },
    onError: () => toast({ title: t("error"), variant: "destructive" }),
  });

  const openEdit = (sp: any) => {
    setEditing(sp);
    setForm({ first_name: sp.first_name, last_name: sp.last_name, code: sp.code, email: sp.email || "", phone: sp.phone || "", commission_rate: sp.commission_rate, is_active: sp.is_active, role_type: sp.role_type || "in_store", default_location_id: sp.default_location_id || "" });
    setDialogOpen(true);
  };
  const openAdd = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const closeDialog = () => { setDialogOpen(false); setEditing(null); };

  const filtered = salespeople.filter((sp: any) => {
    const matchesSearch = `${sp.first_name} ${sp.last_name} ${sp.code}`.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === "all" || sp.role_type === roleFilter;
    return matchesSearch && matchesRole;
  });

  const activeCount = salespeople.filter((sp: any) => sp.is_active).length;
  const inStoreCount = salespeople.filter((sp: any) => sp.role_type === "in_store").length;
  const wholesaleCount = salespeople.filter((sp: any) => sp.role_type === "wholesale").length;

  const getLocationName = (locId: string) => {
    const loc = locations.find((l: any) => l.id === locId);
    return loc?.name || "-";
  };

  const columns: ResponsiveColumn<any>[] = [
    { key: "code", label: t("code"), primary: true, sortable: true, sortValue: (sp) => sp.code, render: (sp) => <span className="font-mono">{sp.code}</span> },
    { key: "name", label: t("name"), sortable: true, sortValue: (sp) => `${sp.first_name} ${sp.last_name}`, render: (sp) => <span className="font-medium">{sp.first_name} {sp.last_name}</span> },
    {
      key: "role", label: t("roleType"), sortable: true, sortValue: (sp) => sp.role_type,
      render: (sp) => <Badge className={sp.role_type === "in_store" ? "bg-chart-2 text-white" : "bg-chart-3 text-white"}>{sp.role_type === "in_store" ? t("inStore") : t("wholesale")}</Badge>,
    },
    { key: "location", label: t("defaultLocation"), hideOnMobile: true, render: (sp) => sp.role_type === "in_store" && sp.default_location_id ? getLocationName(sp.default_location_id) : "-" },
    { key: "email", label: t("email"), hideOnMobile: true, render: (sp) => sp.email || "-" },
    { key: "commission", label: t("commissionRate"), sortable: true, sortValue: (sp) => Number(sp.commission_rate), render: (sp) => `${Number(sp.commission_rate).toFixed(1)}%` },
    { key: "status", label: t("status"), sortable: true, sortValue: (sp) => sp.is_active ? 1 : 0, render: (sp) => <Badge variant={sp.is_active ? "default" : "secondary"}>{sp.is_active ? t("active") : t("inactive")}</Badge> },
    {
      key: "actions", label: t("actions"), showInCard: false,
      render: (sp) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEdit(sp); }}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setDeleteId(sp.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("salespeople")} icon={Users} actions={<Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />{t("add")}</Button>} />

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Users className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{salespeople.length}</p><p className="text-sm text-muted-foreground">{t("salespeople")}</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><TrendingUp className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{activeCount}</p><p className="text-sm text-muted-foreground">{t("active")}</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Store className="h-8 w-8 text-chart-2" /><div><p className="text-2xl font-bold">{inStoreCount}</p><p className="text-sm text-muted-foreground">{t("inStore")}</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Briefcase className="h-8 w-8 text-chart-3" /><div><p className="text-2xl font-bold">{wholesaleCount}</p><p className="text-sm text-muted-foreground">{t("wholesale")}</p></div></div></CardContent></Card>
      </div>

      <Tabs value={roleFilter} onValueChange={setRoleFilter}>
        <TabsList>
          <TabsTrigger value="all">{t("allTypes")}</TabsTrigger>
          <TabsTrigger value="in_store">{t("inStore")}</TabsTrigger>
          <TabsTrigger value="wholesale">{t("wholesale")}</TabsTrigger>
        </TabsList>
      </Tabs>

      <MobileFilterBar search={<Input placeholder={t("search")} value={search} onChange={e => setSearch(e.target.value)} />} filters={<></>} />

      <ResponsiveTable
        data={filtered}
        columns={columns}
        keyExtractor={(sp) => sp.id}
        emptyMessage={t("noResults")}
        enableExport
        exportFilename="salespeople"
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? t("edit") : t("add")} {t("salesperson")}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>{t("firstName")}</Label><Input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} /></div>
              <div><Label>{t("lastName")}</Label><Input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} /></div>
            </div>
            <div><Label>{t("code")}</Label><Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="SP-001" /></div>
            <div>
              <Label>{t("roleType")}</Label>
              <Select value={form.role_type} onValueChange={v => setForm(f => ({ ...f, role_type: v, default_location_id: v === "wholesale" ? "" : f.default_location_id }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_store">{t("inStore")}</SelectItem>
                  <SelectItem value="wholesale">{t("wholesale")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.role_type === "in_store" && (
              <div>
                <Label>{t("defaultLocation")}</Label>
                <Select value={form.default_location_id} onValueChange={v => setForm(f => ({ ...f, default_location_id: v }))}>
                  <SelectTrigger><SelectValue placeholder={t("selectLocation")} /></SelectTrigger>
                  <SelectContent>
                    {locations.map((loc: any) => <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>{t("email")}</Label><Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div><Label>{t("phone")}</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
            </div>
            <div><Label>{t("commissionRate")} (%)</Label><Input type="number" step="0.1" value={form.commission_rate} onChange={e => setForm(f => ({ ...f, commission_rate: Number(e.target.value) }))} /></div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
              <Label>{t("active")}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>{t("cancel")}</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.first_name || !form.last_name || !form.code || saveMutation.isPending}>{t("save")}</Button>
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
