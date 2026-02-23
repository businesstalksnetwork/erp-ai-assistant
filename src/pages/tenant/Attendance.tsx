import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { ResponsiveTable, ResponsiveColumn } from "@/components/shared/ResponsiveTable";
import { MobileFilterBar } from "@/components/shared/MobileFilterBar";
import { useNavigate } from "react-router-dom";

export default function Attendance() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const navigate = useNavigate();
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
      const { data } = await supabase.from("attendance_records").select("*, employees(full_name)").eq("tenant_id", tenantId!).eq("date", dateFilter).order("created_at");
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

  const columns: ResponsiveColumn<any>[] = [
    { key: "employee", label: t("employee"), primary: true, render: (r) => <span className="text-primary hover:underline cursor-pointer font-medium" onClick={(e) => { e.stopPropagation(); navigate(`/hr/employees/${r.employee_id}`); }}>{r.employees?.full_name}</span> },
    { key: "check_in", label: t("checkIn"), render: (r) => r.check_in || "—" },
    { key: "check_out", label: t("checkOut"), render: (r) => r.check_out || "—" },
    { key: "hours", label: t("hoursWorked"), align: "right", render: (r) => `${r.hours_worked}h` },
    { key: "status", label: t("status"), render: (r) => <Badge variant={statusColor(r.status) as any}>{statusLabel(r.status)}</Badge> },
    { key: "notes", label: t("notes"), hideOnMobile: true, render: (r) => <span className="text-muted-foreground text-sm">{r.notes || "—"}</span> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("attendance")}</h1>
      </div>

      <MobileFilterBar
        filters={<Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-44" />}
        actions={<Button size="sm" onClick={() => { setForm({ ...form, date: dateFilter, employee_id: "" }); setOpen(true); }}><Plus className="h-4 w-4 mr-2" />{t("add")}</Button>}
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <ResponsiveTable data={records} columns={columns} keyExtractor={(r) => r.id} />
          )}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>{t("checkIn")}</Label><Input type="time" value={form.check_in} onChange={(e) => setForm({ ...form, check_in: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("checkOut")}</Label><Input type="time" value={form.check_out} onChange={(e) => setForm({ ...form, check_out: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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