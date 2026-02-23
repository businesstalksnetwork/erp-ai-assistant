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
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export default function InsuranceRecords() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ first_name: "", last_name: "", middle_name: "", jmbg: "", lbo: "", insurance_start: "", insurance_end: "", registration_date: new Date().toISOString().split("T")[0] });

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["insurance-records", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("insurance_records").select("*").eq("tenant_id", tenantId!).order("last_name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const mutation = useMutation({
    mutationFn: async (f: typeof form) => {
      const payload = { tenant_id: tenantId!, first_name: f.first_name, last_name: f.last_name, middle_name: f.middle_name || null, jmbg: f.jmbg, lbo: f.lbo || null, insurance_start: f.insurance_start, insurance_end: f.insurance_end || null, registration_date: f.registration_date };
      if (editId) {
        const { error } = await supabase.from("insurance_records").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("insurance_records").upsert([payload], { onConflict: "tenant_id,jmbg" });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["insurance-records"] }); setOpen(false); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("insuranceRecords")}</h1>
        <Button onClick={() => { setEditId(null); setForm({ first_name: "", last_name: "", middle_name: "", jmbg: "", lbo: "", insurance_start: "", insurance_end: "", registration_date: new Date().toISOString().split("T")[0] }); setOpen(true); }}><Plus className="h-4 w-4 mr-2" />{t("add")}</Button>
      </div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t("firstName")}</TableHead>
            <TableHead>{t("lastName")}</TableHead>
            <TableHead>{t("jmbg")}</TableHead>
            <TableHead>{t("lbo")}</TableHead>
            <TableHead>{t("insuranceStart")}</TableHead>
            <TableHead>{t("insuranceEnd")}</TableHead>
            <TableHead>{t("actions")}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
            : records.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">{t("noResults")}</TableCell></TableRow>
            : records.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell>{r.first_name}</TableCell>
                <TableCell>{r.last_name}</TableCell>
                <TableCell className="font-mono">{r.jmbg}</TableCell>
                <TableCell>{r.lbo || "—"}</TableCell>
                <TableCell>{r.insurance_start}</TableCell>
                <TableCell>{r.insurance_end || "—"}</TableCell>
                <TableCell><Button size="sm" variant="ghost" onClick={() => { setEditId(r.id); setForm({ first_name: r.first_name, last_name: r.last_name, middle_name: r.middle_name || "", jmbg: r.jmbg, lbo: r.lbo || "", insurance_start: r.insurance_start, insurance_end: r.insurance_end || "", registration_date: r.registration_date }); setOpen(true); }}>{t("edit")}</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editId ? t("edit") : t("add")} {t("insuranceRecord")}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="grid gap-2"><Label>{t("firstName")} *</Label><Input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("middleName")}</Label><Input value={form.middle_name} onChange={e => setForm({ ...form, middle_name: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("lastName")} *</Label><Input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>{t("jmbg")} *</Label><Input value={form.jmbg} onChange={e => setForm({ ...form, jmbg: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("lbo")}</Label><Input value={form.lbo} onChange={e => setForm({ ...form, lbo: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="grid gap-2"><Label>{t("insuranceStart")} *</Label><Input type="date" value={form.insurance_start} onChange={e => setForm({ ...form, insurance_start: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("insuranceEnd")}</Label><Input type="date" value={form.insurance_end} onChange={e => setForm({ ...form, insurance_end: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("registrationDate")}</Label><Input type="date" value={form.registration_date} onChange={e => setForm({ ...form, registration_date: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => mutation.mutate(form)} disabled={!form.first_name || !form.last_name || !form.jmbg || !form.insurance_start || mutation.isPending}>
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
