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
import { UserCheck, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

type EmploymentType = "full_time" | "part_time" | "contract" | "intern";
type EmployeeStatus = "active" | "inactive" | "terminated";

interface EmployeeForm {
  full_name: string;
  email: string;
  phone: string;
  jmbg: string;
  address: string;
  city: string;
  position: string;
  department_id: string | null;
  employment_type: EmploymentType;
  start_date: string;
  status: EmployeeStatus;
}

const emptyForm: EmployeeForm = {
  full_name: "", email: "", phone: "", jmbg: "", address: "", city: "",
  position: "", department_id: null, employment_type: "full_time",
  start_date: new Date().toISOString().split("T")[0], status: "active",
};

export default function Employees() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<EmployeeForm>(emptyForm);

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["employees", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("employees")
        .select("*, departments(name)")
        .eq("tenant_id", tenantId!)
        .order("full_name");
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

  const mutation = useMutation({
    mutationFn: async (f: EmployeeForm) => {
      const payload = { ...f, tenant_id: tenantId!, department_id: f.department_id || null };
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
      full_name: emp.full_name, email: emp.email || "", phone: emp.phone || "",
      jmbg: emp.jmbg || "", address: emp.address || "", city: emp.city || "",
      position: emp.position || "", department_id: emp.department_id || null,
      employment_type: emp.employment_type, start_date: emp.start_date, status: emp.status,
    });
    setOpen(true);
  };

  const statusColor = (s: string) => s === "active" ? "default" : s === "inactive" ? "secondary" : "destructive";
  const empTypeLabel = (t_: string) => ({ full_time: t("fullTime"), part_time: t("partTime"), contract: t("contractType"), intern: t("intern") }[t_] || t_);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("employees")}</h1>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />{t("addEmployee")}</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("fullName")}</TableHead>
                <TableHead>{t("position")}</TableHead>
                <TableHead>{t("department")}</TableHead>
                <TableHead>{t("employmentType")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : employees.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{t("noResults")}</TableCell></TableRow>
              ) : employees.map((emp: any) => (
                <TableRow key={emp.id}>
                  <TableCell className="font-medium">{emp.full_name}</TableCell>
                  <TableCell>{emp.position || "—"}</TableCell>
                  <TableCell>{emp.departments?.name || "—"}</TableCell>
                  <TableCell>{empTypeLabel(emp.employment_type)}</TableCell>
                  <TableCell><Badge variant={statusColor(emp.status)}>{emp.status}</Badge></TableCell>
                  <TableCell><Button size="sm" variant="ghost" onClick={() => openEdit(emp)}>{t("edit")}</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? t("editEmployee") : t("addEmployee")}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2"><Label>{t("fullName")} *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>{t("email")}</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("phone")}</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>{t("jmbg")}</Label><Input value={form.jmbg} onChange={(e) => setForm({ ...form, jmbg: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("position")}</Label><Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>{t("address")}</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("city")}</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("department")}</Label>
                <Select value={form.department_id || "__none"} onValueChange={(v) => setForm({ ...form, department_id: v === "__none" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">{t("noDepartment")}</SelectItem>
                    {departments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{t("employmentType")}</Label>
                <Select value={form.employment_type} onValueChange={(v) => setForm({ ...form, employment_type: v as EmploymentType })}>
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
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>{t("startDate")}</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
              <div className="grid gap-2">
                <Label>{t("status")}</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as EmployeeStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t("active")}</SelectItem>
                    <SelectItem value="inactive">{t("inactive")}</SelectItem>
                    <SelectItem value="terminated">{t("terminated")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => mutation.mutate(form)} disabled={!form.full_name || mutation.isPending}>
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
