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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { differenceInCalendarDays } from "date-fns";

export default function LeaveRequests() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  type LeaveType = "vacation" | "sick" | "personal" | "maternity" | "paternity" | "unpaid";
  type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";
  const [form, setForm] = useState<{ employee_id: string; leave_type: LeaveType; start_date: string; end_date: string; reason: string }>({ employee_id: "", leave_type: "vacation", start_date: "", end_date: "", reason: "" });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-active", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("employees").select("id, full_name").eq("tenant_id", tenantId!).eq("status", "active").order("full_name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["leave-requests", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("leave_requests")
        .select("*, employees(full_name)")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const createMutation = useMutation({
    mutationFn: async (f: typeof form) => {
      const days = differenceInCalendarDays(new Date(f.end_date), new Date(f.start_date)) + 1;
      const { error } = await supabase.from("leave_requests").insert([{ ...f, tenant_id: tenantId!, days_count: days }]);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leave-requests"] }); setOpen(false); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: LeaveStatus }) => {
      const { error } = await supabase.from("leave_requests").update({
        status, approved_by: user?.id, approved_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leave-requests"] }); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusColor = (s: string) => ({ pending: "secondary", approved: "default", rejected: "destructive", cancelled: "outline" }[s] || "secondary") as any;
  const leaveLabel = (lt: string) => ({ vacation: t("vacation"), sick: t("sickLeave"), personal: t("personalLeave"), maternity: t("maternity"), paternity: t("paternity"), unpaid: t("unpaidLeave") }[lt] || lt);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("leaveRequests")}</h1>
        <Button onClick={() => { setForm({ employee_id: "", leave_type: "vacation", start_date: "", end_date: "", reason: "" }); setOpen(true); }}><Plus className="h-4 w-4 mr-2" />{t("add")}</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("employee")}</TableHead>
                <TableHead>{t("leaveType")}</TableHead>
                <TableHead>{t("startDate")}</TableHead>
                <TableHead>{t("endDate")}</TableHead>
                <TableHead>{t("daysCount")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : requests.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">{t("noResults")}</TableCell></TableRow>
              ) : requests.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell>{r.employees?.full_name}</TableCell>
                  <TableCell>{leaveLabel(r.leave_type)}</TableCell>
                  <TableCell>{r.start_date}</TableCell>
                  <TableCell>{r.end_date}</TableCell>
                  <TableCell>{r.days_count}</TableCell>
                  <TableCell><Badge variant={statusColor(r.status)}>{r.status === "pending" ? t("pending") : r.status === "approved" ? t("approved") : t("rejected")}</Badge></TableCell>
                  <TableCell>
                    {r.status === "pending" && (
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => statusMutation.mutate({ id: r.id, status: "approved" })}><Check className="h-4 w-4 text-primary" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => statusMutation.mutate({ id: r.id, status: "rejected" })}><X className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>{t("startDate")} *</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("endDate")} *</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
            </div>
            <div className="grid gap-2"><Label>{t("reason")}</Label><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
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
