import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export default function Attendance() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split("T")[0]);
  type AttendanceStatus = "present" | "absent" | "sick" | "vacation" | "holiday" | "remote";
  const [form, setForm] = useState<{ employee_id: string; date: string; check_in: string; check_out: string; hours_worked: number; status: AttendanceStatus; notes: string }>({ employee_id: "", date: dateFilter, check_in: "09:00", check_out: "17:00", hours_worked: 8, status: "present", notes: "" });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-active", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("employees").select("id, full_name").eq("tenant_id", tenantId!).eq("status", "active").order("full_name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["attendance", tenantId, dateFilter],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance_records")
        .select("*, employees(full_name)")
        .eq("tenant_id", tenantId!)
        .eq("date", dateFilter)
        .order("created_at");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const mutation = useMutation({
    mutationFn: async (f: typeof form) => {
      const { error } = await supabase.from("attendance_records").insert([{ ...f, tenant_id: tenantId!, hours_worked: Number(f.hours_worked) }]);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["attendance"] }); setOpen(false); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusColor = (s: string) => {
    if (s === "present" || s === "remote") return "default";
    if (s === "absent" || s === "sick") return "destructive";
    return "secondary";
  };

  const statusLabel = (s: string) => ({ present: t("present"), absent: t("absent"), sick: t("sickLeave"), vacation: t("vacation"), holiday: t("holiday"), remote: t("remote") }[s] || s);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("attendance")}</h1>
        <div className="flex items-center gap-3">
          <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-44" />
          <Button onClick={() => { setForm({ ...form, date: dateFilter, employee_id: "" }); setOpen(true); }}><Plus className="h-4 w-4 mr-2" />{t("add")}</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("employee")}</TableHead>
                <TableHead>{t("checkIn")}</TableHead>
                <TableHead>{t("checkOut")}</TableHead>
                <TableHead>{t("hoursWorked")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("notes")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : records.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{t("noResults")}</TableCell></TableRow>
              ) : records.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell>{r.employees?.full_name}</TableCell>
                  <TableCell>{r.check_in || "—"}</TableCell>
                  <TableCell>{r.check_out || "—"}</TableCell>
                  <TableCell>{r.hours_worked}h</TableCell>
                  <TableCell><Badge variant={statusColor(r.status)}>{statusLabel(r.status)}</Badge></TableCell>
                  <TableCell className="text-muted-foreground text-sm">{r.notes || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("attendance")}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>{t("employee")} *</Label>
              <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
                <SelectTrigger><SelectValue placeholder={t("selectEmployee")} /></SelectTrigger>
                <SelectContent>{employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>{t("checkIn")}</Label><Input type="time" value={form.check_in} onChange={(e) => setForm({ ...form, check_in: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("checkOut")}</Label><Input type="time" value={form.check_out} onChange={(e) => setForm({ ...form, check_out: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>{t("hoursWorked")}</Label><Input type="number" value={form.hours_worked} onChange={(e) => setForm({ ...form, hours_worked: Number(e.target.value) })} /></div>
              <div className="grid gap-2">
                <Label>{t("status")}</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as AttendanceStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="present">{t("present")}</SelectItem>
                    <SelectItem value="absent">{t("absent")}</SelectItem>
                    <SelectItem value="sick">{t("sickLeave")}</SelectItem>
                    <SelectItem value="vacation">{t("vacation")}</SelectItem>
                    <SelectItem value="holiday">{t("holiday")}</SelectItem>
                    <SelectItem value="remote">{t("remote")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2"><Label>{t("notes")}</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
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
