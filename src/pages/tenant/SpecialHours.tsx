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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { ResponsiveTable, ResponsiveColumn } from "@/components/shared/ResponsiveTable";
import { MobileActionMenu } from "@/components/shared/MobileActionMenu";

export default function SpecialHours() {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "overtime";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("specialHours" as any)}</h1>
      <Tabs value={activeTab} onValueChange={(v) => setSearchParams({ tab: v })}>
        <TabsList>
          <TabsTrigger value="overtime">{t("overtimeHours")}</TabsTrigger>
          <TabsTrigger value="night">{t("nightWork")}</TabsTrigger>
        </TabsList>
        <TabsContent value="overtime"><OvertimeTab /></TabsContent>
        <TabsContent value="night"><NightWorkTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function OvertimeTab() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const now = new Date();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [form, setForm] = useState({ employee_id: "", year: now.getFullYear(), month: now.getMonth() + 1, hours: 0, tracking_type: "monthly" });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-active", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("employees").select("id, full_name").eq("tenant_id", tenantId!).eq("status", "active").eq("is_ghost", false).order("full_name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["overtime-hours", tenantId, filterYear, filterMonth],
    queryFn: async () => {
      const { data } = await supabase.from("overtime_hours").select("*, employees(full_name)").eq("tenant_id", tenantId!).eq("year", filterYear).eq("month", filterMonth).order("created_at");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const mutation = useMutation({
    mutationFn: async (f: typeof form) => {
      const payload = { tenant_id: tenantId!, employee_id: f.employee_id, year: f.year, month: f.month, hours: f.hours, tracking_type: f.tracking_type };
      if (editId) {
        const { error } = await supabase.from("overtime_hours").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("overtime_hours").upsert([payload], { onConflict: "employee_id,year,month" });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["overtime-hours"] }); setOpen(false); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const columns: ResponsiveColumn<any>[] = [
    { key: "employee", label: t("employee"), primary: true, render: (r) => <span className="text-primary hover:underline cursor-pointer font-medium" onClick={(e) => { e.stopPropagation(); navigate(`/hr/employees/${r.employee_id}`); }}>{r.employees?.full_name}</span> },
    { key: "hours", label: t("hours"), align: "right", render: (r) => r.hours },
    { key: "tracking", label: t("trackingType"), render: (r) => r.tracking_type === "monthly" ? t("monthlyTracking") : t("dailyTracking") },
    { key: "actions", label: t("actions"), showInCard: false, render: (r) => (
      <MobileActionMenu actions={[{ label: t("edit"), onClick: () => { setEditId(r.id); setForm({ employee_id: r.employee_id, year: r.year, month: r.month, hours: r.hours, tracking_type: r.tracking_type }); setOpen(true); } }]} />
    )},
  ];

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-4">
          <div className="grid gap-1"><Label>{t("year")}</Label><Input type="number" className="w-24" value={filterYear} onChange={e => setFilterYear(+e.target.value)} /></div>
          <div className="grid gap-1"><Label>{t("periodMonth")}</Label><Input type="number" min={1} max={12} className="w-24" value={filterMonth} onChange={e => setFilterMonth(+e.target.value)} /></div>
        </div>
        <Button size="sm" onClick={() => { setEditId(null); setForm({ employee_id: "", year: filterYear, month: filterMonth, hours: 0, tracking_type: "monthly" }); setOpen(true); }}><Plus className="h-4 w-4 mr-2" />{t("add")}</Button>
      </div>

      <Card><CardContent className="p-0">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <ResponsiveTable data={records} columns={columns} keyExtractor={(r) => r.id} />
        )}
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("overtimeHours")}</DialogTitle></DialogHeader>
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
              <div className="grid gap-2"><Label>{t("periodMonth")}</Label><Input type="number" min={1} max={12} value={form.month} onChange={e => setForm({ ...form, month: +e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("hours")}</Label><Input type="number" step="0.5" value={form.hours} onChange={e => setForm({ ...form, hours: +e.target.value })} /></div>
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

function NightWorkTab() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const now = new Date();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [form, setForm] = useState({ employee_id: "", year: now.getFullYear(), month: now.getMonth() + 1, hours: 0, tracking_type: "monthly" });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-active", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("employees").select("id, full_name").eq("tenant_id", tenantId!).eq("status", "active").eq("is_ghost", false).order("full_name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["night-work-hours", tenantId, filterYear, filterMonth],
    queryFn: async () => {
      const { data } = await supabase.from("night_work_hours").select("*, employees(full_name)").eq("tenant_id", tenantId!).eq("year", filterYear).eq("month", filterMonth).order("created_at");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const mutation = useMutation({
    mutationFn: async (f: typeof form) => {
      const payload = { tenant_id: tenantId!, employee_id: f.employee_id, year: f.year, month: f.month, hours: f.hours, tracking_type: f.tracking_type };
      if (editId) {
        const { error } = await supabase.from("night_work_hours").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("night_work_hours").upsert([payload], { onConflict: "employee_id,year,month" });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["night-work-hours"] }); setOpen(false); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const columns: ResponsiveColumn<any>[] = [
    { key: "employee", label: t("employee"), primary: true, render: (r) => <span className="text-primary hover:underline cursor-pointer font-medium" onClick={(e) => { e.stopPropagation(); navigate(`/hr/employees/${r.employee_id}`); }}>{r.employees?.full_name}</span> },
    { key: "hours", label: t("hours"), align: "right", render: (r) => r.hours },
    { key: "tracking", label: t("trackingType"), render: (r) => r.tracking_type === "monthly" ? t("monthlyTracking") : t("dailyTracking") },
    { key: "actions", label: t("actions"), showInCard: false, render: (r) => (
      <MobileActionMenu actions={[{ label: t("edit"), onClick: () => { setEditId(r.id); setForm({ employee_id: r.employee_id, year: r.year, month: r.month, hours: r.hours, tracking_type: r.tracking_type }); setOpen(true); } }]} />
    )},
  ];

  return (
    <div className="space-y-4 mt-4">
      <p className="text-sm text-muted-foreground">Night work hours are subtracted from regular hours in reports to avoid double-counting.</p>
      <div className="flex items-center justify-between">
        <div className="flex gap-4">
          <div className="grid gap-1"><Label>{t("year")}</Label><Input type="number" className="w-24" value={filterYear} onChange={e => setFilterYear(+e.target.value)} /></div>
          <div className="grid gap-1"><Label>{t("periodMonth")}</Label><Input type="number" min={1} max={12} className="w-24" value={filterMonth} onChange={e => setFilterMonth(+e.target.value)} /></div>
        </div>
        <Button size="sm" onClick={() => { setEditId(null); setForm({ employee_id: "", year: filterYear, month: filterMonth, hours: 0, tracking_type: "monthly" }); setOpen(true); }}><Plus className="h-4 w-4 mr-2" />{t("add")}</Button>
      </div>

      <Card><CardContent className="p-0">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <ResponsiveTable data={records} columns={columns} keyExtractor={(r) => r.id} />
        )}
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("nightWork")}</DialogTitle></DialogHeader>
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
              <div className="grid gap-2"><Label>{t("periodMonth")}</Label><Input type="number" min={1} max={12} value={form.month} onChange={e => setForm({ ...form, month: +e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("hours")}</Label><Input type="number" step="0.5" value={form.hours} onChange={e => setForm({ ...form, hours: +e.target.value })} /></div>
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
