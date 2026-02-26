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
import { Plus, Loader2, Copy } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { fmtNum } from "@/lib/utils";

export default function Allowances() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const now = new Date();
  const [open, setOpen] = useState(false);
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [form, setForm] = useState({ employee_id: "", allowance_type_id: "", amount: 0 });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-active", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("employees").select("id, full_name").eq("tenant_id", tenantId!).eq("status", "active").eq("is_ghost", false).order("full_name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: types = [] } = useQuery({
    queryKey: ["allowance-types", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("allowance_types").select("*").or(`tenant_id.eq.${tenantId},tenant_id.is.null`).eq("is_active", true).order("name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: allowances = [], isLoading } = useQuery({
    queryKey: ["allowances", tenantId, filterYear, filterMonth],
    queryFn: async () => {
      const { data } = await supabase.from("allowances").select("*, employees(full_name), allowance_types(name)").eq("tenant_id", tenantId!).eq("year", filterYear).eq("month", filterMonth).order("created_at");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const mutation = useMutation({
    mutationFn: async (f: typeof form) => {
      const { error } = await supabase.from("allowances").upsert([{
        tenant_id: tenantId!, employee_id: f.employee_id, allowance_type_id: f.allowance_type_id,
        amount: f.amount, month: filterMonth, year: filterYear,
      }], { onConflict: "employee_id,allowance_type_id,month,year" });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["allowances"] }); setOpen(false); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const copyMutation = useMutation({
    mutationFn: async () => {
      const prevMonth = filterMonth === 1 ? 12 : filterMonth - 1;
      const prevYear = filterMonth === 1 ? filterYear - 1 : filterYear;
      const { data: prev } = await supabase.from("allowances").select("*").eq("tenant_id", tenantId!).eq("year", prevYear).eq("month", prevMonth);
      if (!prev?.length) throw new Error(t("noResults"));
      const rows = prev.map((p: any) => ({ tenant_id: tenantId!, employee_id: p.employee_id, allowance_type_id: p.allowance_type_id, amount: p.amount, month: filterMonth, year: filterYear }));
      const { error } = await supabase.from("allowances").upsert(rows, { onConflict: "employee_id,allowance_type_id,month,year" });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["allowances"] }); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("allowance")}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => copyMutation.mutate()} disabled={copyMutation.isPending}><Copy className="h-4 w-4 mr-2" />{t("copyFromPrevious")}</Button>
          <Button onClick={() => { setForm({ employee_id: "", allowance_type_id: "", amount: 0 }); setOpen(true); }}><Plus className="h-4 w-4 mr-2" />{t("add")}</Button>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="grid gap-1"><Label>{t("year")}</Label><Input type="number" className="w-24" value={filterYear} onChange={e => setFilterYear(+e.target.value)} /></div>
        <div className="grid gap-1"><Label>{t("periodMonth")}</Label><Input type="number" min={1} max={12} className="w-24" value={filterMonth} onChange={e => setFilterMonth(+e.target.value)} /></div>
      </div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t("employee")}</TableHead>
            <TableHead>{t("allowanceType")}</TableHead>
            <TableHead className="text-right">{t("amount")}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={3} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
            : allowances.length === 0 ? <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">{t("noResults")}</TableCell></TableRow>
            : allowances.map((a: any) => (
              <TableRow key={a.id}>
                <TableCell><span className="text-primary hover:underline cursor-pointer font-medium" onClick={() => navigate(`/hr/employees/${a.employee_id}`)}>{a.employees?.full_name}</span></TableCell>
                <TableCell>{a.allowance_types?.name}</TableCell>
                <TableCell className="text-right">{fmtNum(a.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("allowance")}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>{t("employee")} *</Label>
              <Select value={form.employee_id} onValueChange={v => setForm({ ...form, employee_id: v })}>
                <SelectTrigger><SelectValue placeholder={t("selectEmployee")} /></SelectTrigger>
                <SelectContent>{employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>{t("allowanceType")} *</Label>
              <Select value={form.allowance_type_id} onValueChange={v => setForm({ ...form, allowance_type_id: v })}>
                <SelectTrigger><SelectValue placeholder={t("selectType")} /></SelectTrigger>
                <SelectContent>{types.map((tp: any) => <SelectItem key={tp.id} value={tp.id}>{tp.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2"><Label>{t("amount")}</Label><Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: +e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => mutation.mutate(form)} disabled={!form.employee_id || !form.allowance_type_id || mutation.isPending}>
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
