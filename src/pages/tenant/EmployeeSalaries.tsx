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
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function EmployeeSalaries() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ employee_id: "", amount: 0, salary_type: "monthly", amount_type: "gross", meal_allowance: 0, regres: 0, start_date: new Date().toISOString().split("T")[0] });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-active", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("employees").select("id, full_name").eq("tenant_id", tenantId!).eq("status", "active").eq("is_ghost", false).order("full_name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: salaries = [], isLoading } = useQuery({
    queryKey: ["employee-salaries", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("employee_salaries").select("*, employees(full_name, position, department_id, departments(name))").eq("tenant_id", tenantId!).order("start_date", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const mutation = useMutation({
    mutationFn: async (f: typeof form) => {
      if (!f.meal_allowance && !f.regres) {
        const { data: prev } = await supabase.from("employee_salaries").select("meal_allowance, regres").eq("employee_id", f.employee_id).order("start_date", { ascending: false }).limit(1);
        if (prev?.[0]) { f.meal_allowance = prev[0].meal_allowance; f.regres = prev[0].regres; }
      }
      const { error } = await supabase.from("employee_salaries").insert([{ tenant_id: tenantId!, ...f }]);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employee-salaries"] }); setOpen(false); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const fmtNum = (n: number) => n.toLocaleString("sr-RS", { minimumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("salaryHistory")}</h1>
        <Button onClick={() => { setForm({ employee_id: "", amount: 0, salary_type: "monthly", amount_type: "gross", meal_allowance: 0, regres: 0, start_date: new Date().toISOString().split("T")[0] }); setOpen(true); }}><Plus className="h-4 w-4 mr-2" />{t("add")}</Button>
      </div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t("employee")}</TableHead>
            <TableHead>{t("department")}</TableHead>
            <TableHead>{t("position")}</TableHead>
            <TableHead className="text-right">{t("amount")}</TableHead>
            <TableHead>{t("salaryType")}</TableHead>
            <TableHead>{t("amountTypeLabel")}</TableHead>
            <TableHead className="text-right">{t("mealAllowance")}</TableHead>
            <TableHead className="text-right">{t("regres")}</TableHead>
            <TableHead>{t("startDate")}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={9} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
            : salaries.length === 0 ? <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">{t("noResults")}</TableCell></TableRow>
            : salaries.map((s: any) => (
              <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/hr/employees/${s.employee_id}`)}>
                <TableCell>{s.employees?.full_name}</TableCell>
                <TableCell>{s.employees?.departments?.name || "—"}</TableCell>
                <TableCell>{s.employees?.position || "—"}</TableCell>
                <TableCell className="text-right font-semibold">{fmtNum(s.amount)}</TableCell>
                <TableCell>{s.salary_type === "monthly" ? t("monthlyRate") : t("hourlyRate")}</TableCell>
                <TableCell>{s.amount_type === "gross" ? t("gross") : t("net")}</TableCell>
                <TableCell className="text-right">{fmtNum(s.meal_allowance)}</TableCell>
                <TableCell className="text-right">{fmtNum(s.regres)}</TableCell>
                <TableCell>{s.start_date}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("salaryHistory")}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>{t("employee")} *</Label>
              <Select value={form.employee_id} onValueChange={v => setForm({ ...form, employee_id: v })}>
                <SelectTrigger><SelectValue placeholder={t("selectEmployee")} /></SelectTrigger>
                <SelectContent>{employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="grid gap-2"><Label>{t("amount")} *</Label><Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: +e.target.value })} /></div>
              <div className="grid gap-2">
                <Label>{t("salaryType")}</Label>
                <Select value={form.salary_type} onValueChange={v => setForm({ ...form, salary_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">{t("monthlyRate")}</SelectItem>
                    <SelectItem value="hourly">{t("hourlyRate")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{t("amountTypeLabel")}</Label>
                <Select value={form.amount_type} onValueChange={v => setForm({ ...form, amount_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gross">{t("gross")}</SelectItem>
                    <SelectItem value="net">{t("net")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="grid gap-2"><Label>{t("mealAllowance")}</Label><Input type="number" value={form.meal_allowance} onChange={e => setForm({ ...form, meal_allowance: +e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("regres")}</Label><Input type="number" value={form.regres} onChange={e => setForm({ ...form, regres: +e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("startDate")}</Label><Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => mutation.mutate(form)} disabled={!form.employee_id || !form.amount || mutation.isPending}>
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
