import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { differenceInCalendarDays } from "date-fns";
import { useNavigate } from "react-router-dom";
import { ResponsiveTable, ResponsiveColumn } from "@/components/shared/ResponsiveTable";

export default function LeaveRequests() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  type LeaveType = "vacation" | "sick" | "personal" | "maternity" | "paternity" | "unpaid";
  type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";
  const [form, setForm] = useState<{ employee_id: string; leave_type: LeaveType; start_date: string; end_date: string; reason: string; vacation_year: string }>({ employee_id: "", leave_type: "vacation", start_date: "", end_date: "", reason: "", vacation_year: "" });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-active", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("employees").select("id, full_name").eq("tenant_id", tenantId!).eq("status", "active").eq("is_ghost", false).order("full_name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["leave-requests", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("leave_requests").select("*, employees(full_name)").eq("tenant_id", tenantId!).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const createMutation = useMutation({
    mutationFn: async (f: typeof form) => {
      const days = differenceInCalendarDays(new Date(f.end_date), new Date(f.start_date)) + 1;
      const { error } = await supabase.from("leave_requests").insert([{ ...f, tenant_id: tenantId!, days_count: days, vacation_year: f.vacation_year ? Number(f.vacation_year) : null }]);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leave-requests"] }); setOpen(false); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: LeaveStatus }) => {
      const { error } = await supabase.from("leave_requests").update({ status, approved_by: user?.id, approved_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leave-requests"] }); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusColor = (s: string) => ({ pending: "secondary", approved: "default", rejected: "destructive", cancelled: "outline" }[s] || "secondary") as any;
  const leaveLabel = (lt: string) => ({ vacation: t("vacation"), sick: t("sickLeave"), personal: t("personalLeave"), maternity: t("maternity"), paternity: t("paternity"), unpaid: t("unpaidLeave") }[lt] || lt);

  const columns: ResponsiveColumn<any>[] = [
    { key: "employee", label: t("employee"), primary: true, render: (r) => <span className="text-primary hover:underline cursor-pointer font-medium" onClick={(e) => { e.stopPropagation(); navigate(`/hr/employees/${r.employee_id}`); }}>{r.employees?.full_name}</span> },
    { key: "type", label: t("leaveType"), render: (r) => leaveLabel(r.leave_type) },
    { key: "start", label: t("startDate"), render: (r) => r.start_date },
    { key: "end", label: t("endDate"), hideOnMobile: true, render: (r) => r.end_date },
    { key: "days", label: t("daysCount"), align: "right", render: (r) => r.days_count },
    { key: "status", label: t("status"), render: (r) => <Badge variant={statusColor(r.status)}>{r.status === "pending" ? t("pending") : r.status === "approved" ? t("approved") : t("rejected")}</Badge> },
    { key: "actions", label: t("actions"), showInCard: false, render: (r) => r.status === "pending" ? (
      <div className="flex gap-1">
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => statusMutation.mutate({ id: r.id, status: "approved" })}><Check className="h-4 w-4 text-primary" /></Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => statusMutation.mutate({ id: r.id, status: "rejected" })}><X className="h-4 w-4 text-destructive" /></Button>
      </div>
    ) : null },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("leaveRequests")}</h1>
        <Button size="sm" onClick={() => { setForm({ employee_id: "", leave_type: "vacation", start_date: "", end_date: "", reason: "", vacation_year: "" }); setOpen(true); }}><Plus className="h-4 w-4 mr-2" />{t("add")}</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <ResponsiveTable data={requests} columns={columns} keyExtractor={(r) => r.id} />
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("leaveRequests")}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>{t("employee")} *</Label>
              <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
                <SelectTrigger><SelectValue placeholder={t("selectEmployee")} /></SelectTrigger>
                <SelectContent>{employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>{t("leaveType")}</Label>
              <Select value={form.leave_type} onValueChange={(v) => setForm({ ...form, leave_type: v as LeaveType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vacation">{t("vacation")}</SelectItem>
                  <SelectItem value="sick">{t("sickLeave")}</SelectItem>
                  <SelectItem value="personal">{t("personalLeave")}</SelectItem>
                  <SelectItem value="maternity">{t("maternity")}</SelectItem>
                  <SelectItem value="paternity">{t("paternity")}</SelectItem>
                  <SelectItem value="unpaid">{t("unpaidLeave")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>{t("startDate")} *</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("endDate")} *</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
            </div>
            <div className="grid gap-2"><Label>{t("reason")}</Label><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
            <div className="grid gap-2"><Label>{t("vacationYear")}</Label><Input type="number" placeholder="e.g. 2026" value={form.vacation_year} onChange={(e) => setForm({ ...form, vacation_year: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => createMutation.mutate(form)} disabled={!form.employee_id || !form.start_date || !form.end_date || createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}