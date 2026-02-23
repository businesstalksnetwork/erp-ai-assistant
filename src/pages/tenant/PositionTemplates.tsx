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
  const [form, setForm] = useState({ name: "", code: "", description: "", is_active: true });

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["position-templates", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("position_templates").select("*").eq("tenant_id", tenantId!).order("code");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const mutation = useMutation({
    mutationFn: async (f: typeof form) => {
      const payload = { tenant_id: tenantId!, name: f.name, code: f.code, description: f.description || null, is_active: f.is_active };
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("positionTemplates")}</h1>
        <Button onClick={() => { setEditId(null); setForm({ name: "", code: "", description: "", is_active: true }); setOpen(true); }}><Plus className="h-4 w-4 mr-2" />{t("add")}</Button>
      </div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t("code")}</TableHead>
            <TableHead>{t("name")}</TableHead>
            <TableHead>{t("description")}</TableHead>
            <TableHead>{t("status")}</TableHead>
            <TableHead>{t("actions")}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
            : templates.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">{t("noResults")}</TableCell></TableRow>
            : templates.map((tp: any) => (
              <TableRow key={tp.id}>
                <TableCell className="font-mono">{tp.code}</TableCell>
                <TableCell>{tp.name}</TableCell>
                <TableCell>{tp.description || "—"}</TableCell>
                <TableCell><Badge variant={tp.is_active ? "default" : "secondary"}>{tp.is_active ? t("active") : t("inactive")}</Badge></TableCell>
                <TableCell><Button size="sm" variant="ghost" onClick={() => { setEditId(tp.id); setForm({ name: tp.name, code: tp.code, description: tp.description || "", is_active: tp.is_active }); setOpen(true); }}>{t("edit")}</Button></TableCell>
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
