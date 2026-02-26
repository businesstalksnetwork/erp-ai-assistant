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
import { Plus, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function AnnualLeaveBalances() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const now = new Date();
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ employee_id: "", year: now.getFullYear(), entitled_days: 20, carried_over_days: 0 });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-active", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("employees").select("id, full_name").eq("tenant_id", tenantId!).eq("status", "active").eq("is_ghost", false).order("full_name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: balances = [], isLoading } = useQuery({
    queryKey: ["annual-leave-balances", tenantId, filterYear],
    queryFn: async () => {
      const { data } = await supabase.from("annual_leave_balances").select("*, employees(full_name)").eq("tenant_id", tenantId!).eq("year", filterYear).order("created_at");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const createMutation = useMutation({
    mutationFn: async (f: typeof form) => {
      const { error } = await supabase.from("annual_leave_balances").upsert([{
        tenant_id: tenantId!, employee_id: f.employee_id, year: f.year,
        entitled_days: f.entitled_days, carried_over_days: f.carried_over_days,
      }], { onConflict: "employee_id,year" });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["annual-leave-balances"] }); setOpen(false); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const recalcMutation = useMutation({
    mutationFn: async () => {
      for (const bal of balances) {
        const { count } = await supabase.from("work_logs").select("*", { count: "exact", head: true }).eq("employee_id", (bal as any).employee_id).eq("type", "vacation").eq("vacation_year", filterYear);
        await supabase.from("annual_leave_balances").update({ used_days: count || 0 }).eq("id", (bal as any).id);
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["annual-leave-balances"] }); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const isCarriedExpired = now.getMonth() >= 5; // After June 30

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("annualLeaveBalance")}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => recalcMutation.mutate()} disabled={recalcMutation.isPending || balances.length === 0}>
            <RefreshCw className="h-4 w-4 mr-2" />{t("recalculate")}
          </Button>
          <Button onClick={() => { setForm({ employee_id: "", year: filterYear, entitled_days: 20, carried_over_days: 0 }); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />{t("add")}
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="grid gap-1"><Label>{t("year")}</Label><Input type="number" className="w-24" value={filterYear} onChange={e => setFilterYear(+e.target.value)} /></div>
      </div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t("employee")}</TableHead>
            <TableHead className="text-right">{t("entitledDays")}</TableHead>
            <TableHead className="text-right">{t("carriedOverDays")}</TableHead>
            <TableHead className="text-right">{t("usedDays")}</TableHead>
            <TableHead className="text-right">{t("remainingDays")}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
            : balances.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">{t("noResults")}</TableCell></TableRow>
            : balances.map((b: any) => {
              const effectiveCarried = isCarriedExpired && filterYear < now.getFullYear() ? 0 : b.carried_over_days;
              const remaining = b.entitled_days + effectiveCarried - b.used_days;
              return (
                <TableRow key={b.id}>
                  <TableCell><span className="text-primary hover:underline cursor-pointer font-medium" onClick={() => navigate(`/hr/employees/${b.employee_id}`)}>{b.employees?.full_name}</span></TableCell>
                  <TableCell className="text-right">{b.entitled_days}</TableCell>
                  <TableCell className="text-right">
                    {b.carried_over_days}
                    {isCarriedExpired && b.carried_over_days > 0 && filterYear < now.getFullYear() && (
                      <Badge variant="destructive" className="ml-2 text-[10px]">{t("expiredAfterJune")}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{b.used_days}</TableCell>
                  <TableCell className="text-right font-semibold">{remaining}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("annualLeaveBalance")}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>{t("employee")} *</Label>
              <Select value={form.employee_id} onValueChange={v => setForm({ ...form, employee_id: v })}>
                <SelectTrigger><SelectValue placeholder={t("selectEmployee")} /></SelectTrigger>
                <SelectContent>{employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="grid gap-2"><Label>{t("year")}</Label><Input type="number" value={form.year} onChange={e => setForm({ ...form, year: +e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("entitledDays")}</Label><Input type="number" value={form.entitled_days} onChange={e => setForm({ ...form, entitled_days: +e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("carriedOverDays")}</Label><Input type="number" value={form.carried_over_days} onChange={e => setForm({ ...form, carried_over_days: +e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => createMutation.mutate(form)} disabled={!form.employee_id || createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
