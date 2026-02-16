import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Calendar, Grid3X3 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ResponsiveTable, ResponsiveColumn } from "@/components/shared/ResponsiveTable";
import { MobileFilterBar } from "@/components/shared/MobileFilterBar";
import { MobileActionMenu } from "@/components/shared/MobileActionMenu";

const WORK_LOG_TYPES = ["workday", "weekend", "holiday", "vacation", "sick_leave", "paid_leave", "unpaid_leave", "maternity_leave", "holiday_work", "slava"] as const;

const typeColors: Record<string, string> = {
  workday: "default", weekend: "secondary", holiday: "secondary", vacation: "default",
  sick_leave: "destructive", paid_leave: "default", unpaid_leave: "outline",
  maternity_leave: "default", holiday_work: "default", slava: "default",
};

export default function WorkLogs() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [filterEmp, setFilterEmp] = useState<string>("__all");
  const [filterType, setFilterType] = useState<string>("__all");
  const [form, setForm] = useState({ employee_id: "", date: new Date().toISOString().split("T")[0], type: "workday" as string, hours: 8, note: "", vacation_year: "" as string });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-active", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("employees").select("id, full_name").eq("tenant_id", tenantId!).eq("status", "active").order("full_name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["work-logs", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("work_logs").select("*, employees(full_name)").eq("tenant_id", tenantId!).order("date", { ascending: false }).limit(500);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const filtered = logs.filter((l: any) => {
    if (filterEmp !== "__all" && l.employee_id !== filterEmp) return false;
    if (filterType !== "__all" && l.type !== filterType) return false;
    return true;
  });

  const mutation = useMutation({
    mutationFn: async (f: typeof form) => {
      const payload = { tenant_id: tenantId!, employee_id: f.employee_id, date: f.date, type: f.type, hours: f.hours, note: f.note || null, vacation_year: f.vacation_year ? Number(f.vacation_year) : null, created_by: user?.id || null };
      if (editId) {
        const { error } = await supabase.from("work_logs").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("work_logs").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["work-logs"] }); setOpen(false); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const typeLabel = (tp: string) => t(tp as any) || tp;

  const columns: ResponsiveColumn<any>[] = [
    { key: "employee", label: t("employee"), primary: true, render: (l) => l.employees?.full_name },
    { key: "date", label: t("date"), render: (l) => l.date },
    { key: "type", label: t("workLogType"), render: (l) => <Badge variant={typeColors[l.type] as any || "secondary"}>{typeLabel(l.type)}</Badge> },
    { key: "hours", label: t("hours"), align: "right", render: (l) => l.hours },
    { key: "note", label: t("notes"), hideOnMobile: true, render: (l) => <span className="max-w-[200px] truncate block">{l.note || "—"}</span> },
    { key: "actions", label: t("actions"), showInCard: false, render: (l) => (
      <MobileActionMenu actions={[
        { label: t("edit"), onClick: () => { setEditId(l.id); setForm({ employee_id: l.employee_id, date: l.date, type: l.type, hours: l.hours, note: l.note || "", vacation_year: l.vacation_year?.toString() || "" }); setOpen(true); } },
      ]} />
    )},
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("workLogs")}</h1>
      </div>

      <MobileFilterBar
        filters={
          <>
            <Select value={filterEmp} onValueChange={setFilterEmp}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">{t("allTypes")}</SelectItem>
                {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">{t("allTypes")}</SelectItem>
                {WORK_LOG_TYPES.map(tp => <SelectItem key={tp} value={tp}>{typeLabel(tp)}</SelectItem>)}
              </SelectContent>
            </Select>
          </>
        }
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate("/hr/work-logs/bulk")}><Grid3X3 className="h-4 w-4 mr-2" />{t("bulkEntry")}</Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/hr/work-logs/calendar")}><Calendar className="h-4 w-4 mr-2" />{t("workLogsCalendar")}</Button>
            <Button size="sm" onClick={() => { setEditId(null); setForm({ employee_id: "", date: new Date().toISOString().split("T")[0], type: "workday", hours: 8, note: "", vacation_year: "" }); setOpen(true); }}><Plus className="h-4 w-4 mr-2" />{t("add")}</Button>
          </>
        }
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <ResponsiveTable data={filtered} columns={columns} keyExtractor={(l) => l.id} />
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? t("edit") : t("add")} {t("workLog")}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>{t("employee")} *</Label>
              <Select value={form.employee_id} onValueChange={v => setForm({ ...form, employee_id: v })}>
                <SelectTrigger><SelectValue placeholder={t("selectEmployee")} /></SelectTrigger>
                <SelectContent>{employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>{t("date")} *</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
              <div className="grid gap-2">
                <Label>{t("workLogType")}</Label>
                <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{WORK_LOG_TYPES.map(tp => <SelectItem key={tp} value={tp}>{typeLabel(tp)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>{t("hours")}</Label><Input type="number" step="0.5" value={form.hours} onChange={e => setForm({ ...form, hours: +e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("vacationYear")}</Label><Input type="number" placeholder="e.g. 2026" value={form.vacation_year} onChange={e => setForm({ ...form, vacation_year: e.target.value })} /></div>
            </div>
            <div className="grid gap-2"><Label>{t("notes")}</Label><Input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => mutation.mutate(form)} disabled={!form.employee_id || !form.date || mutation.isPending}>
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}