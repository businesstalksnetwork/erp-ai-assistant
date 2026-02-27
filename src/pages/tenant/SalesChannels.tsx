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
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/shared/ResponsiveTable";
import type { Tables } from "@/integrations/supabase/types";

type SalesChannel = Tables<"sales_channels">;
const emptyForm = { name: "", type: "retail", is_active: true };
const channelTypes = ["retail", "wholesale", "web", "marketplace"];

export default function SalesChannels() {
  const { t } = useLanguage();
  const { tenantId, isLoading: tenantLoading } = useTenant();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<SalesChannel | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: channels = [], isLoading } = useQuery({
    queryKey: ["sales_channels", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("sales_channels").select("*").eq("tenant_id", tenantId!);
      if (error) throw error;
      return data as SalesChannel[];
    },
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await supabase.from("sales_channels").update(form).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("sales_channels").insert({ ...form, tenant_id: tenantId! });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sales_channels", tenantId] }); toast({ title: t("success") }); closeDialog(); },
    onError: () => toast({ title: t("error"), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("sales_channels").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sales_channels", tenantId] }); toast({ title: t("success") }); setDeleteId(null); },
    onError: () => toast({ title: t("error"), variant: "destructive" }),
  });

  const openEdit = (ch: SalesChannel) => { setEditing(ch); setForm({ name: ch.name, type: ch.type, is_active: ch.is_active }); setDialogOpen(true); };
  const openAdd = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const closeDialog = () => { setDialogOpen(false); setEditing(null); };
  const filtered = channels.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  if (tenantLoading || isLoading) return <div className="p-6">{t("loading")}</div>;

  const columns: ResponsiveColumn<SalesChannel>[] = [
    { key: "name", label: t("name"), primary: true, sortable: true, sortValue: (c) => c.name, render: (c) => <span className="font-medium">{c.name}</span> },
    { key: "type", label: t("type"), sortable: true, sortValue: (c) => c.type, render: (c) => <span className="capitalize">{c.type}</span> },
    { key: "status", label: t("status"), sortable: true, sortValue: (c) => c.is_active ? 1 : 0, render: (c) => <Badge variant={c.is_active ? "default" : "secondary"}>{c.is_active ? t("active") : t("inactive")}</Badge> },
    { key: "actions", label: t("actions"), render: (c) => (
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEdit(c); }}><Pencil className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setDeleteId(c.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
      </div>
    )},
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("salesChannels")}</h1>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />{t("add")}</Button>
      </div>
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder={t("search")} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <ResponsiveTable
        data={filtered}
        columns={columns}
        keyExtractor={(c) => c.id}
        emptyMessage={t("noResults")}
        enableExport
        exportFilename="sales-channels"
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? t("edit") : t("add")} {t("salesChannel")}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div><Label>{t("name")}</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>{t("type")}</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{channelTypes.map(ct => <SelectItem key={ct} value={ct} className="capitalize">{ct}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
              <Label>{t("active")}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>{t("cancel")}</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.name || saveMutation.isPending}>{t("save")}</Button>
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
