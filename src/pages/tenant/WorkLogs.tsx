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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Loader2, Calendar, Grid3X3, Save, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ResponsiveTable, ResponsiveColumn } from "@/components/shared/ResponsiveTable";
import { MobileFilterBar } from "@/components/shared/MobileFilterBar";
import { MobileActionMenu } from "@/components/shared/MobileActionMenu";
import { eachDayOfInterval, format, startOfMonth, endOfMonth, addMonths, subMonths, getDay } from "date-fns";

const WORK_LOG_TYPES = ["workday", "weekend", "holiday", "vacation", "sick_leave", "paid_leave", "unpaid_leave", "maternity_leave", "holiday_work", "slava"] as const;

const WORK_LOG_TYPE_TO_PT_CODE: Record<string, string> = {
  holiday_work: "PRA", slava: "PRA", weekend: "VIK", workday: "RED",
};

const typeColors: Record<string, string> = {
  workday: "default", weekend: "secondary", holiday: "secondary", vacation: "default",
  sick_leave: "destructive", paid_leave: "default", unpaid_leave: "outline",
  maternity_leave: "default", holiday_work: "default", slava: "default",
};

const calendarTypeColors: Record<string, string> = {
  workday: "bg-primary/20 text-primary", weekend: "bg-muted text-muted-foreground", holiday: "bg-amber-100 text-amber-800",
  vacation: "bg-blue-100 text-blue-800", sick_leave: "bg-red-100 text-red-800", paid_leave: "bg-green-100 text-green-800",
  unpaid_leave: "bg-gray-100 text-gray-800", maternity_leave: "bg-pink-100 text-pink-800",
  holiday_work: "bg-orange-100 text-orange-800", slava: "bg-purple-100 text-purple-800",
};

export default function WorkLogs() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "list";

  // ─── Shared queries ───
  const { data: paymentTypes = [] } = useQuery({
    queryKey: ["payroll-payment-types", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("payroll_payment_types").select("id, code, name, rate_multiplier").eq("tenant_id", tenantId!).eq("is_active", true).order("code");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-active", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("employees").select("id, full_name").eq("tenant_id", tenantId!).eq("status", "active").eq("is_ghost", false).order("full_name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("workLogs")}</h1>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setSearchParams({ tab: v })}>
        <TabsList>
          <TabsTrigger value="list">{t("workLogs")}</TabsTrigger>
          <TabsTrigger value="bulk">{t("bulkEntry")}</TabsTrigger>
          <TabsTrigger value="calendar">{t("workLogsCalendar")}</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <WorkLogsList tenantId={tenantId!} employees={employees} paymentTypes={paymentTypes} t={t} user={user} qc={qc} navigate={navigate} />
        </TabsContent>
        <TabsContent value="bulk">
          <WorkLogsBulk tenantId={tenantId!} employees={employees} t={t} user={user} />
        </TabsContent>
        <TabsContent value="calendar">
          <WorkLogsCalendarView tenantId={tenantId!} employees={employees} t={t} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── List Tab ───
function WorkLogsList({ tenantId, employees, paymentTypes, t, user, qc, navigate }: any) {
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [filterEmp, setFilterEmp] = useState<string>("__all");
  const [filterType, setFilterType] = useState<string>("__all");
  const [form, setForm] = useState({ employee_id: "", date: new Date().toISOString().split("T")[0], type: "workday" as string, hours: 8, note: "", vacation_year: "" as string, payment_type_id: "" as string });

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
      const payload = { tenant_id: tenantId!, employee_id: f.employee_id, date: f.date, type: f.type, hours: f.hours, note: f.note || null, vacation_year: f.vacation_year ? Number(f.vacation_year) : null, created_by: user?.id || null, payment_type_id: f.payment_type_id || null };
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
    { key: "employee", label: t("employee"), primary: true, render: (l) => <span className="text-primary hover:underline cursor-pointer font-medium" onClick={(e) => { e.stopPropagation(); navigate(`/hr/employees/${l.employee_id}`); }}>{l.employees?.full_name}</span> },
    { key: "date", label: t("date"), render: (l) => l.date },
    { key: "type", label: t("workLogType"), render: (l) => <Badge variant={typeColors[l.type] as any || "secondary"}>{typeLabel(l.type)}</Badge> },
    { key: "hours", label: t("hours"), align: "right", render: (l) => l.hours },
    { key: "paymentType", label: t("paymentType"), hideOnMobile: true, render: (l) => { const pt = paymentTypes.find((p: any) => p.id === l.payment_type_id); return pt ? <Badge variant="outline">{pt.code} <span className="text-muted-foreground ml-1">×{pt.rate_multiplier}</span></Badge> : <span className="text-muted-foreground">—</span>; } },
    { key: "note", label: t("notes"), hideOnMobile: true, render: (l) => <span className="max-w-[200px] truncate block">{l.note || "—"}</span> },
    { key: "actions", label: t("actions"), showInCard: false, render: (l) => (
      <MobileActionMenu actions={[
        { label: t("edit"), onClick: () => { setEditId(l.id); setForm({ employee_id: l.employee_id, date: l.date, type: l.type, hours: l.hours, note: l.note || "", vacation_year: l.vacation_year?.toString() || "", payment_type_id: l.payment_type_id || "" }); setOpen(true); } },
      ]} />
    )},
  ];

  return (
    <div className="space-y-4 mt-4">
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
          <Button size="sm" onClick={() => { setEditId(null); setForm({ employee_id: "", date: new Date().toISOString().split("T")[0], type: "workday", hours: 8, note: "", vacation_year: "", payment_type_id: "" }); setOpen(true); }}><Plus className="h-4 w-4 mr-2" />{t("add")}</Button>
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
                <Select value={form.type} onValueChange={v => {
                  const suggestedCode = WORK_LOG_TYPE_TO_PT_CODE[v];
                  const suggestedPt = suggestedCode ? paymentTypes.find((pt: any) => pt.code === suggestedCode) : null;
                  setForm({ ...form, type: v, payment_type_id: suggestedPt ? suggestedPt.id : "" });
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{WORK_LOG_TYPES.map(tp => <SelectItem key={tp} value={tp}>{typeLabel(tp)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>{t("hours")}</Label><Input type="number" step="0.5" value={form.hours} onChange={e => setForm({ ...form, hours: +e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("vacationYear")}</Label><Input type="number" placeholder="e.g. 2026" value={form.vacation_year} onChange={e => setForm({ ...form, vacation_year: e.target.value })} /></div>
            </div>
            <div className="grid gap-2">
              <Label>{t("paymentType")}</Label>
              <Select value={form.payment_type_id} onValueChange={v => setForm({ ...form, payment_type_id: v === "__none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  {paymentTypes.map((pt: any) => <SelectItem key={pt.id} value={pt.id}>{pt.code} – {pt.name} (×{pt.rate_multiplier})</SelectItem>)}
                </SelectContent>
              </Select>
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

// ─── Bulk Entry Tab ───
function WorkLogsBulk({ tenantId, employees, t, user }: any) {
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-01"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [saving, setSaving] = useState(false);
  const [grid, setGrid] = useState<Record<string, Record<string, string>>>({});

  const dates = startDate && endDate ? eachDayOfInterval({ start: new Date(startDate), end: new Date(endDate) }) : [];

  const setCell = (empId: string, dateStr: string, type: string) => {
    setGrid(prev => ({ ...prev, [empId]: { ...prev[empId], [dateStr]: type } }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const rows: any[] = [];
      for (const [empId, dates] of Object.entries(grid)) {
        for (const [dateStr, type] of Object.entries(dates)) {
          if (type && type !== "__none") {
            rows.push({ tenant_id: tenantId!, employee_id: empId, date: dateStr, type, hours: 8, created_by: user?.id || null });
          }
        }
      }
      if (rows.length === 0) { toast.error(t("noResults")); return; }
      const { error } = await supabase.from("work_logs").upsert(rows, { onConflict: "employee_id,date" });
      if (error) throw error;
      toast.success(t("success"));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-4">
          <div className="grid gap-2"><Label>{t("startDate")}</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
          <div className="grid gap-2"><Label>{t("endDate")}</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
        </div>
        <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}{t("save")}</Button>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <div className="min-w-full inline-block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2 text-left sticky left-0 bg-card min-w-[180px]">{t("employee")}</th>
                  {dates.map(d => (
                    <th key={d.toISOString()} className="p-2 text-center min-w-[100px]">
                      <div>{format(d, "dd")}</div>
                      <div className="text-xs text-muted-foreground">{format(d, "EEE")}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map((emp: any) => (
                  <tr key={emp.id} className="border-b">
                    <td className="p-2 sticky left-0 bg-card font-medium">{emp.full_name}</td>
                    {dates.map(d => {
                      const dateStr = format(d, "yyyy-MM-dd");
                      const val = grid[emp.id]?.[dateStr] || "__none";
                      return (
                        <td key={dateStr} className="p-1">
                          <Select value={val} onValueChange={v => setCell(emp.id, dateStr, v)}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none">—</SelectItem>
                              {WORK_LOG_TYPES.map(tp => <SelectItem key={tp} value={tp}>{t(tp as any) || tp}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Calendar Tab ───
function WorkLogsCalendarView({ tenantId, employees, t }: any) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedEmp, setSelectedEmp] = useState<string>("__all");

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["work-logs-month", tenantId, format(monthStart, "yyyy-MM")],
    queryFn: async () => {
      const { data } = await supabase.from("work_logs").select("*, employees(full_name)").eq("tenant_id", tenantId!).gte("date", format(monthStart, "yyyy-MM-dd")).lte("date", format(monthEnd, "yyyy-MM-dd"));
      return data || [];
    },
    enabled: !!tenantId,
  });

  const filtered = selectedEmp === "__all" ? logs : logs.filter((l: any) => l.employee_id === selectedEmp);
  const logsByDate = new Map<string, any[]>();
  filtered.forEach((l: any) => {
    const key = l.date;
    if (!logsByDate.has(key)) logsByDate.set(key, []);
    logsByDate.get(key)!.push(l);
  });

  const startPadding = (getDay(monthStart) + 6) % 7;

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <Select value={selectedEmp} onValueChange={setSelectedEmp}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">{t("allTypes")}</SelectItem>
            {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="font-semibold min-w-[150px] text-center">{format(currentMonth, "MMMM yyyy")}</span>
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
                <div key={d} className="text-center text-xs font-semibold text-muted-foreground p-2">{d}</div>
              ))}
              {Array.from({ length: startPadding }).map((_, i) => <div key={`pad-${i}`} />)}
              {days.map(day => {
                const dateStr = format(day, "yyyy-MM-dd");
                const dayLogs = logsByDate.get(dateStr) || [];
                return (
                  <div key={dateStr} className="min-h-[80px] border rounded p-1">
                    <div className="text-xs font-medium mb-1">{format(day, "d")}</div>
                    {dayLogs.slice(0, 3).map((l: any) => (
                      <div key={l.id} className={`text-[10px] rounded px-1 py-0.5 mb-0.5 truncate ${calendarTypeColors[l.type] || "bg-muted"}`}>
                        {selectedEmp === "__all" ? l.employees?.full_name?.split(" ")[0] : ""} {t(l.type as any) || l.type}
                      </div>
                    ))}
                    {dayLogs.length > 3 && <div className="text-[10px] text-muted-foreground">+{dayLogs.length - 3}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
