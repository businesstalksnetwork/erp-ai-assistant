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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ResponsiveTable, ResponsiveColumn } from "@/components/shared/ResponsiveTable";
import { Plus, Settings, Trash2 } from "lucide-react";

export default function EquipmentList() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", code: "", equipment_type: "machine", work_center_id: "", status: "operational", notes: "" });

  const { data: equipment = [], isLoading } = useQuery({
    queryKey: ["equipment", tenantId],
    queryFn: async () => {
      const { data } = await (supabase.from("equipment") as any).select("*, work_centers(name)").eq("tenant_id", tenantId!).order("name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: workCenters = [] } = useQuery({
    queryKey: ["work-centers", tenantId],
    queryFn: async () => {
      const { data } = await (supabase.from("work_centers") as any).select("id, name").eq("tenant_id", tenantId!).eq("is_active", true);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...form, tenant_id: tenantId!, work_center_id: form.work_center_id || null };
      if (editId) {
        const { error } = await (supabase.from("equipment") as any).update({ ...form, work_center_id: form.work_center_id || null }).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("equipment") as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["equipment"] }); setOpen(false); toast({ title: t("success") }); },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await (supabase.from("equipment") as any).delete().eq("id", id).eq("tenant_id", tenantId!); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["equipment"] }),
  });

  const statusColor = (s: string) => s === "operational" ? "default" : s === "maintenance" ? "secondary" : "destructive";

  const columns: ResponsiveColumn<any>[] = [
    { key: "code", label: t("code"), primary: true, render: (r) => <span className="font-mono">{r.code}</span> },
    { key: "name", label: t("name"), render: (r) => <span className="font-medium">{r.name}</span> },
    { key: "type", label: t("equipmentType"), render: (r) => r.equipment_type },
    { key: "wc", label: t("workCenters"), hideOnMobile: true, render: (r) => r.work_centers?.name || "—" },
    { key: "status", label: t("status"), render: (r) => <Badge variant={statusColor(r.status) as any}>{r.status}</Badge> },
    { key: "actions", label: "", render: (r) => <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("equipmentList")} description={t("equipmentList")} icon={Settings}
        actions={<Button onClick={() => { setEditId(null); setForm({ name: "", code: "", equipment_type: "machine", work_center_id: "", status: "operational", notes: "" }); setOpen(true); }}><Plus className="h-4 w-4 mr-1" />{t("add")}</Button>} />
      <Card><CardContent className="p-0">
        <ResponsiveTable data={equipment} columns={columns} keyExtractor={(r) => r.id} emptyMessage={t("noResults")} />
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? t("edit") : t("add")} {t("equipmentList")}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t("code")} *</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
              <div><Label>{t("name")} *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t("equipmentType")}</Label>
                <Select value={form.equipment_type} onValueChange={(v) => setForm({ ...form, equipment_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="machine">Machine</SelectItem>
                    <SelectItem value="tool">Tool</SelectItem>
                    <SelectItem value="vehicle">Vehicle</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>{t("workCenters")}</Label>
                <Select value={form.work_center_id} onValueChange={(v) => setForm({ ...form, work_center_id: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {workCenters.map((wc: any) => <SelectItem key={wc.id} value={wc.id}>{wc.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>{t("status")}</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="operational">Operational</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="decommissioned">Decommissioned</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
