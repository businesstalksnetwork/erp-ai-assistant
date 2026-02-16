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

export default function ExternalWorkers() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ first_name: "", last_name: "", jmbg: "", contract_expiry: "", is_active: true });

  const { data: persons = [], isLoading } = useQuery({
    queryKey: ["engaged-persons", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("engaged_persons").select("*").eq("tenant_id", tenantId!).order("last_name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const mutation = useMutation({
    mutationFn: async (f: typeof form) => {
      const payload = { tenant_id: tenantId!, first_name: f.first_name, last_name: f.last_name, jmbg: f.jmbg, contract_expiry: f.contract_expiry || null, is_active: f.is_active };
      if (editId) {
        const { error } = await supabase.from("engaged_persons").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("engaged_persons").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["engaged-persons"] }); setOpen(false); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("engagedPersons")}</h1>
        <Button onClick={() => { setEditId(null); setForm({ first_name: "", last_name: "", jmbg: "", contract_expiry: "", is_active: true }); setOpen(true); }}><Plus className="h-4 w-4 mr-2" />{t("add")}</Button>
      </div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t("firstName")}</TableHead>
            <TableHead>{t("lastName")}</TableHead>
            <TableHead>{t("jmbg")}</TableHead>
            <TableHead>{t("contractExpiry")}</TableHead>
            <TableHead>{t("status")}</TableHead>
            <TableHead>{t("actions")}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
            : persons.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{t("noResults")}</TableCell></TableRow>
            : persons.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell>{p.first_name}</TableCell>
                <TableCell>{p.last_name}</TableCell>
                <TableCell className="font-mono">{p.jmbg}</TableCell>
                <TableCell>{p.contract_expiry || "—"}</TableCell>
                <TableCell><Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? t("active") : t("inactive")}</Badge></TableCell>
                <TableCell><Button size="sm" variant="ghost" onClick={() => { setEditId(p.id); setForm({ first_name: p.first_name, last_name: p.last_name, jmbg: p.jmbg, contract_expiry: p.contract_expiry || "", is_active: p.is_active }); setOpen(true); }}>{t("edit")}</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? t("edit") : t("add")} {t("engagedPerson")}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>{t("firstName")} *</Label><Input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("lastName")} *</Label><Input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>{t("jmbg")} *</Label><Input value={form.jmbg} onChange={e => setForm({ ...form, jmbg: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("contractExpiry")}</Label><Input type="date" value={form.contract_expiry} onChange={e => setForm({ ...form, contract_expiry: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => mutation.mutate(form)} disabled={!form.first_name || !form.last_name || !form.jmbg || mutation.isPending}>
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
