import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export default function PositionTemplates() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", code: "", description: "", is_active: true, department_id: "", reports_to_position_id: "" });

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["position-templates", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("position_templates").select("*, employees(count)").eq("tenant_id", tenantId!).order("code");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("departments").select("id, name, code").eq("tenant_id", tenantId!).order("code");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const mutation = useMutation({
    mutationFn: async (f: typeof form) => {
      const payload = {
        tenant_id: tenantId!, name: f.name, code: f.code,
        description: f.description || null, is_active: f.is_active,
        department_id: f.department_id || null,
        reports_to_position_id: f.reports_to_position_id || null,
      };
      if (editId) {
        const { error } = await supabase.from("position_templates").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("position_templates").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["position-templates"] }); setOpen(false); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openAdd = () => { setEditId(null); setForm({ name: "", code: "", description: "", is_active: true, department_id: "", reports_to_position_id: "" }); setOpen(true); };
  const openEdit = (tp: any) => {
    setEditId(tp.id);
    setForm({
      name: tp.name, code: tp.code, description: tp.description || "",
      is_active: tp.is_active, department_id: tp.department_id || "",
      reports_to_position_id: tp.reports_to_position_id || "",
    });
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("positionTemplates")}</h1>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />{t("add")}</Button>
      </div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t("code")}</TableHead>
            <TableHead>{t("name")}</TableHead>
            <TableHead>{t("department" as any)}</TableHead>
            <TableHead>{t("reportsTo" as any)}</TableHead>
            <TableHead>{t("description")}</TableHead>
            <TableHead className="text-right">{t("employees")}</TableHead>
            <TableHead>{t("status")}</TableHead>
            <TableHead>{t("actions")}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={8} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
            : templates.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">{t("noResults")}</TableCell></TableRow>
            : templates.map((tp: any) => (
              <TableRow key={tp.id}>
                <TableCell className="font-mono">{tp.code}</TableCell>
                <TableCell>{tp.name}</TableCell>
                <TableCell>{tp.department_id ? departments.find(d => d.id === tp.department_id)?.name || "—" : "—"}</TableCell>
                <TableCell>{tp.reports_to_position_id ? templates.find((x: any) => x.id === tp.reports_to_position_id)?.name || "—" : "—"}</TableCell>
                <TableCell>{tp.description || "—"}</TableCell>
                <TableCell className="text-right">{(tp as any).employees?.[0]?.count ?? 0}</TableCell>
                <TableCell><Badge variant={tp.is_active ? "default" : "secondary"}>{tp.is_active ? t("active") : t("inactive")}</Badge></TableCell>
                <TableCell><Button size="sm" variant="ghost" onClick={() => openEdit(tp)}>{t("edit")}</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? t("edit") : t("add")} {t("positionTemplate")}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>{t("code")} *</Label><Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("name")} *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            </div>
            <div className="grid gap-2"><Label>{t("description")}</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid gap-2">
              <Label>{t("department" as any)}</Label>
              <Select value={form.department_id || "__none__"} onValueChange={v => setForm({ ...form, department_id: v === "__none__" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— {t("none" as any)} —</SelectItem>
                  {departments.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.code} — {d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>{t("reportsTo" as any)}</Label>
              <Select value={form.reports_to_position_id || "__none__"} onValueChange={v => setForm({ ...form, reports_to_position_id: v === "__none__" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— {t("none" as any)} —</SelectItem>
                  {templates.filter((tp: any) => tp.id !== editId).map((tp: any) => (
                    <SelectItem key={tp.id} value={tp.id}>{tp.code} — {tp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => mutation.mutate(form)} disabled={!form.name || !form.code || mutation.isPending}>
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
