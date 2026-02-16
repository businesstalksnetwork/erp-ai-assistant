import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { fmtNum } from "@/lib/utils";

const DEDUCTION_TYPES = ["credit", "alimony", "other"] as const;

export default function Deductions() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ employee_id: "", type: "credit" as string, description: "", total_amount: 0, start_date: new Date().toISOString().split("T")[0], end_date: "" });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-active", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("employees").select("id, full_name").eq("tenant_id", tenantId!).eq("status", "active").order("full_name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: deductions = [], isLoading } = useQuery({
    queryKey: ["deductions", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("deductions").select("*, employees(full_name)").eq("tenant_id", tenantId!).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const mutation = useMutation({
    mutationFn: async (f: typeof form) => {
      const payload = { tenant_id: tenantId!, employee_id: f.employee_id, type: f.type, description: f.description, total_amount: f.total_amount, start_date: f.start_date, end_date: f.end_date || null };
      if (editId) {
        const { error } = await supabase.from("deductions").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("deductions").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["deductions"] }); setOpen(false); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  
  const typeLabel = (tp: string) => ({ credit: t("creditDeduction"), alimony: t("alimonyType"), other: t("other") }[tp] || tp);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("deductionsModule")}</h1>
        <Button onClick={() => { setEditId(null); setForm({ employee_id: "", type: "credit", description: "", total_amount: 0, start_date: new Date().toISOString().split("T")[0], end_date: "" }); setOpen(true); }}><Plus className="h-4 w-4 mr-2" />{t("add")}</Button>
      </div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t("employee")}</TableHead>
            <TableHead>{t("type")}</TableHead>
            <TableHead>{t("description")}</TableHead>
            <TableHead className="text-right">{t("total")}</TableHead>
            <TableHead className="text-right">{t("paidAmountLabel")}</TableHead>
            <TableHead className="text-right">{t("remainingAmount")}</TableHead>
            <TableHead>{t("status")}</TableHead>
            <TableHead>{t("actions")}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={8} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
            : deductions.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">{t("noResults")}</TableCell></TableRow>
            : deductions.map((d: any) => (
              <TableRow key={d.id}>
                <TableCell>{d.employees?.full_name}</TableCell>
                <TableCell>{typeLabel(d.type)}</TableCell>
                <TableCell>{d.description}</TableCell>
                <TableCell className="text-right">{fmtNum(d.total_amount)}</TableCell>
                <TableCell className="text-right">{fmtNum(d.paid_amount)}</TableCell>
                <TableCell className="text-right font-semibold">{fmtNum(d.total_amount - d.paid_amount)}</TableCell>
                <TableCell><Badge variant={d.is_active ? "default" : "secondary"}>{d.is_active ? t("active") : t("inactive")}</Badge></TableCell>
                <TableCell><Button size="sm" variant="ghost" onClick={() => { setEditId(d.id); setForm({ employee_id: d.employee_id, type: d.type, description: d.description, total_amount: d.total_amount, start_date: d.start_date, end_date: d.end_date || "" }); setOpen(true); }}>{t("edit")}</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? t("edit") : t("add")} {t("deductionsModule")}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>{t("employee")} *</Label>
              <Select value={form.employee_id} onValueChange={v => setForm({ ...form, employee_id: v })}>
                <SelectTrigger><SelectValue placeholder={t("selectEmployee")} /></SelectTrigger>
                <SelectContent>{employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("type")}</Label>
                <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DEDUCTION_TYPES.map(tp => <SelectItem key={tp} value={tp}>{typeLabel(tp)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2"><Label>{t("total")}</Label><Input type="number" value={form.total_amount} onChange={e => setForm({ ...form, total_amount: +e.target.value })} /></div>
            </div>
            <div className="grid gap-2"><Label>{t("description")}</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>{t("startDate")}</Label><Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("endDate")}</Label><Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => mutation.mutate(form)} disabled={!form.employee_id || mutation.isPending}>
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
