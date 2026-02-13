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
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Loader2 } from "lucide-react";
import { ExportButton } from "@/components/ExportButton";
import { toast } from "sonner";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

type EmploymentType = "full_time" | "part_time" | "contract" | "intern";

interface EmployeeForm {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  jmbg: string;
  address: string;
  city: string;
  position: string;
  position_template_id: string | null;
  department_id: string | null;
  location_id: string | null;
  employment_type: EmploymentType;
  start_date: string;
  hire_date: string;
  termination_date: string;
  early_termination_date: string;
  annual_leave_days: number;
  slava_date: string;
  daily_work_hours: number;
  is_archived: boolean;
}

const emptyForm: EmployeeForm = {
  first_name: "", last_name: "", email: "", phone: "", jmbg: "", address: "", city: "",
  position: "", position_template_id: null, department_id: null, location_id: null, employment_type: "full_time",
  start_date: new Date().toISOString().split("T")[0], hire_date: new Date().toISOString().split("T")[0],
  termination_date: "", early_termination_date: "", annual_leave_days: 20,
  slava_date: "", daily_work_hours: 8, is_archived: false,
};

export default function Employees() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<EmployeeForm>(emptyForm);
  const [showArchived, setShowArchived] = useState(false);

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["employees", tenantId, showArchived],
    queryFn: async () => {
      let q = supabase.from("employees").select("*, departments(name), locations(name)").eq("tenant_id", tenantId!).order("full_name");
      if (!showArchived) q = q.eq("is_archived", false);
      const { data } = await q;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments-list", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("departments").select("id, name").eq("tenant_id", tenantId!).eq("is_active", true).order("name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: locations = [] } = useQuery({
    queryKey: ["locations-list", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("locations").select("id, name").eq("tenant_id", tenantId!).eq("is_active", true).order("name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const mutation = useMutation({
    mutationFn: async (f: EmployeeForm) => {
      const full_name = `${f.first_name} ${f.last_name}`.trim();
      const payload = {
        ...f, full_name, tenant_id: tenantId!, department_id: f.department_id || null, location_id: f.location_id || null, position_template_id: f.position_template_id || null,
        status: f.is_archived ? "inactive" as const : "active" as const,
        termination_date: f.termination_date || null,
        early_termination_date: f.early_termination_date || null,
        slava_date: f.slava_date || null,
        hire_date: f.hire_date || f.start_date || null,
      };
      if (editId) {
        const { error } = await supabase.from("employees").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("employees").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employees"] }); setOpen(false); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openAdd = () => { setEditId(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (emp: any) => {
    setEditId(emp.id);
    setForm({
      first_name: emp.first_name || emp.full_name?.split(" ")[0] || "",
      last_name: emp.last_name || emp.full_name?.split(" ").slice(1).join(" ") || "",
      email: emp.email || "", phone: emp.phone || "",
      jmbg: emp.jmbg || "", address: emp.address || "", city: emp.city || "",
      position: emp.position || "", position_template_id: emp.position_template_id || null,
      department_id: emp.department_id || null, location_id: emp.location_id || null,
      employment_type: emp.employment_type, start_date: emp.start_date,
      hire_date: emp.hire_date || emp.start_date || "",
      termination_date: emp.termination_date || "",
      early_termination_date: emp.early_termination_date || "",
      annual_leave_days: emp.annual_leave_days || 20,
      slava_date: emp.slava_date || "",
      daily_work_hours: emp.daily_work_hours || 8,
      is_archived: emp.is_archived || false,
    });
    setOpen(true);
  };

  const getStatus = (emp: any) => {
    if (emp.is_archived) return "archived";
    const effDate = emp.early_termination_date || emp.termination_date;
    if (effDate && new Date(effDate) <= new Date()) return "terminated";
    return "active";
  };
  const statusColor = (s: string) => s === "active" ? "default" : s === "archived" ? "outline" : "destructive";
  const empTypeLabel = (t_: string) => ({ full_time: t("fullTime"), part_time: t("partTime"), contract: t("contractType"), intern: t("intern") }[t_] || t_);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("employees")}</h1>
        <div className="flex gap-2 items-center">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={showArchived} onCheckedChange={(v) => setShowArchived(!!v)} />
            {t("includeArchived")}
          </label>
          <ExportButton data={employees} columns={[
            { key: "full_name", label: t("fullName") }, { key: "email", label: t("email") },
            { key: "phone", label: t("phone") }, { key: "position", label: t("position") },
            { key: "departments.name", label: t("department") }, { key: "locations.name", label: t("location") },
            { key: "employment_type", label: t("employmentType") }, { key: "start_date", label: t("startDate") },
          ]} filename="employees" />
          <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />{t("addEmployee")}</Button>
        </div>
      </div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t("fullName")}</TableHead>
            <TableHead>{t("position")}</TableHead>
            <TableHead>{t("department")}</TableHead>
            <TableHead>{t("location")}</TableHead>
            <TableHead>{t("employmentType")}</TableHead>
            <TableHead>{t("hireDate")}</TableHead>
            <TableHead>{t("status")}</TableHead>
            <TableHead>{t("actions")}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={8} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
            : employees.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">{t("noResults")}</TableCell></TableRow>
            : employees.map((emp: any) => {
              const status = getStatus(emp);
              return (
                <TableRow key={emp.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/hr/employees/${emp.id}`)}>
                  <TableCell className="font-medium">{emp.full_name}</TableCell>
                  <TableCell>{emp.position || "—"}</TableCell>
                  <TableCell>{emp.departments?.name || "—"}</TableCell>
                  <TableCell>{emp.locations?.name || "—"}</TableCell>
                  <TableCell>{empTypeLabel(emp.employment_type)}</TableCell>
                  <TableCell>{emp.hire_date || emp.start_date}</TableCell>
                  <TableCell><Badge variant={statusColor(status)}>{status === "active" ? t("active") : status === "archived" ? t("isArchived") : t("terminated")}</Badge></TableCell>
                  <TableCell><Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(emp); }}>{t("edit")}</Button></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? t("editEmployee") : t("addEmployee")}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>{t("firstName")} *</Label><Input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("lastName")} *</Label><Input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>{t("email")}</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("phone")}</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>{t("jmbg")}</Label><Input value={form.jmbg} onChange={e => setForm({ ...form, jmbg: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("position")}</Label><Input value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>{t("address")}</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("city")}</Label><Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("department")}</Label>
                <Select value={form.department_id || "__none"} onValueChange={v => setForm({ ...form, department_id: v === "__none" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">{t("noDepartment")}</SelectItem>
                    {departments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{t("location")}</Label>
                <Select value={form.location_id || "__none"} onValueChange={v => setForm({ ...form, location_id: v === "__none" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">{t("noLocation")}</SelectItem>
                    {locations.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("employmentType")}</Label>
                <Select value={form.employment_type} onValueChange={v => setForm({ ...form, employment_type: v as EmploymentType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_time">{t("fullTime")}</SelectItem>
                    <SelectItem value="part_time">{t("partTime")}</SelectItem>
                    <SelectItem value="contract">{t("contractType")}</SelectItem>
                    <SelectItem value="intern">{t("intern")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2"><Label>{t("hireDate")}</Label><Input type="date" value={form.hire_date} onChange={e => setForm({ ...form, hire_date: e.target.value, start_date: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("terminationDate")}</Label><Input type="date" value={form.termination_date} onChange={e => setForm({ ...form, termination_date: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("earlyTerminationDate")}</Label><Input type="date" value={form.early_termination_date} onChange={e => setForm({ ...form, early_termination_date: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2"><Label>{t("annualLeaveDays")}</Label><Input type="number" value={form.annual_leave_days} onChange={e => setForm({ ...form, annual_leave_days: +e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("slavaDate")}</Label><Input type="date" value={form.slava_date} onChange={e => setForm({ ...form, slava_date: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("dailyWorkHoursLabel")}</Label><Input type="number" step="0.5" value={form.daily_work_hours} onChange={e => setForm({ ...form, daily_work_hours: +e.target.value })} /></div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.is_archived} onCheckedChange={v => setForm({ ...form, is_archived: !!v })} />
              {t("isArchived")}
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => mutation.mutate(form)} disabled={!form.first_name || !form.last_name || mutation.isPending}>
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
