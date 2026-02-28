import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ResponsiveTable, ResponsiveColumn } from "@/components/shared/ResponsiveTable";
import { Plus, Factory, Trash2 } from "lucide-react";

export default function WorkCenters() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", code: "", description: "", capacity_per_hour: 0, location: "" });

  const { data: workCenters = [], isLoading } = useQuery({
    queryKey: ["work-centers", tenantId],
    queryFn: async () => {
      const { data } = await (supabase.from("work_centers") as any).select("*").eq("tenant_id", tenantId!).order("name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...form, tenant_id: tenantId! };
      if (editId) {
        const { error } = await (supabase.from("work_centers") as any).update(form).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("work_centers") as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["work-centers"] }); setOpen(false); toast({ title: t("success") }); },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await (supabase.from("work_centers") as any).delete().eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["work-centers"] }),
  });

  const openEdit = (wc: any) => {
    setEditId(wc.id);
    setForm({ name: wc.name, code: wc.code, description: wc.description || "", capacity_per_hour: wc.capacity_per_hour || 0, location: wc.location || "" });
    setOpen(true);
  };

  const openNew = () => {
    setEditId(null);
    setForm({ name: "", code: "", description: "", capacity_per_hour: 0, location: "" });
    setOpen(true);
  };

  const columns: ResponsiveColumn<any>[] = [
    { key: "code", label: t("code"), primary: true, render: (r) => <span className="font-mono">{r.code}</span> },
    { key: "name", label: t("name"), render: (r) => <span className="font-medium cursor-pointer text-primary hover:underline" onClick={() => openEdit(r)}>{r.name}</span> },
    { key: "capacity", label: t("capacityPerHour"), render: (r) => r.capacity_per_hour || "—" },
    { key: "location", label: t("location" as any) || "Location", hideOnMobile: true, render: (r) => r.location || "—" },
    { key: "status", label: t("status"), render: (r) => <Badge variant={r.is_active ? "default" : "secondary"}>{r.is_active ? t("active") : t("inactive")}</Badge> },
    { key: "actions", label: "", render: (r) => <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("workCenters")} description={t("workCenters")} icon={Factory}
        actions={<Button onClick={openNew}><Plus className="h-4 w-4 mr-1" />{t("add")}</Button>} />
      <Card><CardContent className="p-0">
        <ResponsiveTable data={workCenters} columns={columns} keyExtractor={(r) => r.id} emptyMessage={t("noResults")} />
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? t("edit") : t("add")} {t("workCenters")}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t("code")} *</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
              <div><Label>{t("name")} *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t("capacityPerHour")}</Label><Input type="number" value={form.capacity_per_hour} onChange={(e) => setForm({ ...form, capacity_per_hour: Number(e.target.value) })} /></div>
              <div><Label>{t("location" as any) || "Location"}</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
            </div>
            <div><Label>{t("description")}</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.code || !form.name || saveMutation.isPending}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
