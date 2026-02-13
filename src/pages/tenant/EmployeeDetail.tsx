import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Download, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useMutation, useQueryClient } from "@tanstack/react-query";

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

const formatDate = (d: string | null | undefined) => {
  if (!d) return "—";
  const dt = new Date(d);
  return `${dt.getDate().toString().padStart(2, "0")}.${(dt.getMonth() + 1).toString().padStart(2, "0")}.${dt.getFullYear()}`;
};

const formatNum = (n: number) =>
  n.toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const monthLabel = (m: number, y: number) => {
  const months = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Avg", "Sep", "Okt", "Nov", "Dec"];
  return `${months[m - 1]} ${y}`;
};

export default function EmployeeDetail() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<EmployeeForm | null>(null);

  const { data: employee, isLoading } = useQuery({
    queryKey: ["employee-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*, departments(name), locations(name), position_templates(name)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!tenantId,
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ["employee-contracts", id],
    queryFn: async () => {
      const { data } = await supabase.from("employee_contracts").select("*").eq("employee_id", id!).order("start_date", { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  const { data: salaries = [] } = useQuery({
    queryKey: ["employee-salaries", id],
    queryFn: async () => {
      const { data } = await supabase.from("employee_salaries").select("*").eq("employee_id", id!).order("start_date", { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  const { data: payslips = [] } = useQuery({
    queryKey: ["employee-payslips", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("payroll_items")
        .select("*, payroll_runs(period_month, period_year, status)")
        .eq("employee_id", id!)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  const { data: leaveRequests = [] } = useQuery({
    queryKey: ["employee-leave", id],
    queryFn: async () => {
      const { data } = await supabase.from("leave_requests").select("*").eq("employee_id", id!).order("start_date", { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  const { data: workLogs = [] } = useQuery({
    queryKey: ["employee-worklogs", id],
    queryFn: async () => {
      const { data } = await supabase.from("work_logs").select("*").eq("employee_id", id!).order("date", { ascending: false }).limit(100);
      return data || [];
    },
    enabled: !!id,
  });

  const { data: deductions = [] } = useQuery({
    queryKey: ["employee-deductions", id],
    queryFn: async () => {
      const { data } = await supabase.from("deductions").select("*").eq("employee_id", id!).order("start_date", { ascending: false });
      return data || [];
    },
    enabled: !!id,
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

  const { data: positionTemplates = [] } = useQuery({
    queryKey: ["position-templates-list", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("position_templates").select("id, name").eq("tenant_id", tenantId!).eq("is_active", true).order("name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const mutation = useMutation({
    mutationFn: async (f: EmployeeForm) => {
      const full_name = `${f.first_name} ${f.last_name}`.trim();
      const payload = {
        ...f, full_name, tenant_id: tenantId!, department_id: f.department_id || null, location_id: f.location_id || null,
        position_template_id: f.position_template_id || null,
        status: f.is_archived ? "inactive" as const : "active" as const,
        termination_date: f.termination_date || null,
        early_termination_date: f.early_termination_date || null,
        slava_date: f.slava_date || null,
        hire_date: f.hire_date || f.start_date || null,
      };
      const { error } = await supabase.from("employees").update(payload).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employee-detail"] }); qc.invalidateQueries({ queryKey: ["employees"] }); setEditOpen(false); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openEdit = () => {
    if (!employee) return;
    setForm({
      first_name: employee.first_name || employee.full_name?.split(" ")[0] || "",
      last_name: employee.last_name || employee.full_name?.split(" ").slice(1).join(" ") || "",
      email: employee.email || "", phone: employee.phone || "",
      jmbg: employee.jmbg || "", address: employee.address || "", city: employee.city || "",
      position: employee.position || "", position_template_id: employee.position_template_id || null,
      department_id: employee.department_id || null, location_id: employee.location_id || null,
      employment_type: employee.employment_type, start_date: employee.start_date,
      hire_date: employee.hire_date || employee.start_date || "",
      termination_date: employee.termination_date || "",
      early_termination_date: employee.early_termination_date || "",
      annual_leave_days: employee.annual_leave_days || 20,
      slava_date: employee.slava_date || "",
      daily_work_hours: employee.daily_work_hours || 8,
      is_archived: employee.is_archived || false,
    });
    setEditOpen(true);
  };

  const downloadPayslip = async (payrollItemId: string) => {
    try {
      toast.info(t("generatingPdf"));
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `https://hfvoehsrsimvgyyxirwj.supabase.co/functions/v1/generate-pdf`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ type: "payslip", payroll_item_id: payrollItemId }),
        }
      );
      if (!res.ok) throw new Error("Failed to generate payslip");
      const html = await res.text();
      const w = window.open("", "_blank");
      if (w) { w.document.write(html); w.document.close(); }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const getStatus = () => {
    if (!employee) return "active";
    if (employee.is_archived) return "archived";
    const effDate = employee.early_termination_date || employee.termination_date;
    if (effDate && new Date(effDate) <= new Date()) return "terminated";
    return "active";
  };
  const statusColor = (s: string) => s === "active" ? "default" : s === "archived" ? "outline" : "destructive";
  const empTypeLabel = (t_: string) => ({ full_time: t("fullTime"), part_time: t("partTime"), contract: t("contractType"), intern: t("intern") }[t_] || t_);

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!employee) return <div className="text-center py-12 text-muted-foreground">{t("noResults")}</div>;

  const status = getStatus();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/hr/employees")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{employee.full_name}</h1>
            <Badge variant={statusColor(status)}>
              {status === "active" ? t("active") : status === "archived" ? t("isArchived") : t("terminated")}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            {employee.position || (employee as any).position_templates?.name || "—"} · {(employee as any).departments?.name || "—"} · {(employee as any).locations?.name || "—"}
          </p>
        </div>
        <Button onClick={openEdit}><Pencil className="h-4 w-4 mr-2" />{t("edit")}</Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="personal">
        <TabsList className="flex-wrap">
          <TabsTrigger value="personal">{t("personalInfo")}</TabsTrigger>
          <TabsTrigger value="contracts">{t("contracts")}</TabsTrigger>
          <TabsTrigger value="salaries">{t("salaryHistory")}</TabsTrigger>
          <TabsTrigger value="payslips">{t("payslips")}</TabsTrigger>
          <TabsTrigger value="leave">{t("leaveRequests")}</TabsTrigger>
          <TabsTrigger value="worklogs">{t("workLogs")}</TabsTrigger>
          <TabsTrigger value="deductions">{t("deductionsModule")}</TabsTrigger>
        </TabsList>

        {/* Personal Info */}
        <TabsContent value="personal">
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <InfoField label={t("firstName")} value={employee.first_name} />
                <InfoField label={t("lastName")} value={employee.last_name} />
                <InfoField label={t("email")} value={employee.email} />
                <InfoField label={t("phone")} value={employee.phone} />
                <InfoField label={t("jmbg")} value={employee.jmbg} />
                <InfoField label={t("address")} value={employee.address} />
                <InfoField label={t("city")} value={employee.city} />
                <InfoField label={t("department")} value={(employee as any).departments?.name} />
                <InfoField label={t("location")} value={(employee as any).locations?.name} />
                <InfoField label={t("position")} value={employee.position || (employee as any).position_templates?.name} />
                <InfoField label={t("employmentType")} value={empTypeLabel(employee.employment_type)} />
                <InfoField label={t("hireDate")} value={formatDate(employee.hire_date)} />
                <InfoField label={t("terminationDate")} value={formatDate(employee.termination_date)} />
                <InfoField label={t("earlyTerminationDate")} value={formatDate(employee.early_termination_date)} />
                <InfoField label={t("annualLeaveDays")} value={String(employee.annual_leave_days)} />
                <InfoField label={t("slavaDate")} value={formatDate(employee.slava_date)} />
                <InfoField label={t("dailyWorkHoursLabel")} value={String(employee.daily_work_hours)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contracts */}
        <TabsContent value="contracts">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>{t("contractTypeLabel")}</TableHead>
                <TableHead>{t("startDate")}</TableHead>
                <TableHead>{t("endDate")}</TableHead>
                <TableHead>{t("grossSalary")}</TableHead>
                <TableHead>{t("status")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {contracts.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">{t("noResults")}</TableCell></TableRow>
                : contracts.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.contract_type}</TableCell>
                    <TableCell>{formatDate(c.start_date)}</TableCell>
                    <TableCell>{formatDate(c.end_date)}</TableCell>
                    <TableCell>{formatNum(Number(c.gross_salary))}</TableCell>
                    <TableCell><Badge variant={c.is_active ? "default" : "outline"}>{c.is_active ? t("active") : t("inactive")}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        {/* Salary History */}
        <TabsContent value="salaries">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>{t("amount")}</TableHead>
                <TableHead>{t("amountTypeLabel")}</TableHead>
                <TableHead>{t("startDate")}</TableHead>
                <TableHead>{t("endDate")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {salaries.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">{t("noResults")}</TableCell></TableRow>
                : salaries.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell>{formatNum(Number(s.amount))}</TableCell>
                    <TableCell>{s.amount_type === "net" ? t("net") : t("gross")}</TableCell>
                    <TableCell>{formatDate(s.start_date)}</TableCell>
                    <TableCell>{formatDate(s.end_date)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        {/* Payslips */}
        <TabsContent value="payslips">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>{t("periodMonth")}</TableHead>
                <TableHead>{t("grossSalary")}</TableHead>
                <TableHead>{t("netSalary")}</TableHead>
                <TableHead>{t("incomeTax")}</TableHead>
                <TableHead>{t("totalCost")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("actions")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {payslips.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">{t("noResults")}</TableCell></TableRow>
                : payslips.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell>{monthLabel(p.payroll_runs?.period_month, p.payroll_runs?.period_year)}</TableCell>
                    <TableCell>{formatNum(p.gross_salary)}</TableCell>
                    <TableCell>{formatNum(p.net_salary)}</TableCell>
                    <TableCell>{formatNum(p.income_tax)}</TableCell>
                    <TableCell>{formatNum(p.total_cost)}</TableCell>
                    <TableCell><Badge variant="outline">{p.payroll_runs?.status}</Badge></TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => downloadPayslip(p.id)}>
                        <Download className="h-4 w-4 mr-1" />{t("downloadPayslip")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        {/* Leave Requests */}
        <TabsContent value="leave">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>{t("leaveType")}</TableHead>
                <TableHead>{t("startDate")}</TableHead>
                <TableHead>{t("endDate")}</TableHead>
                <TableHead>{t("daysCount")}</TableHead>
                <TableHead>{t("status")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {leaveRequests.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">{t("noResults")}</TableCell></TableRow>
                : leaveRequests.map((lr: any) => (
                  <TableRow key={lr.id}>
                    <TableCell>{lr.leave_type}</TableCell>
                    <TableCell>{formatDate(lr.start_date)}</TableCell>
                    <TableCell>{formatDate(lr.end_date)}</TableCell>
                    <TableCell>{lr.days_count}</TableCell>
                    <TableCell><Badge variant={lr.status === "approved" ? "default" : lr.status === "rejected" ? "destructive" : "outline"}>{lr.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        {/* Work Logs */}
        <TabsContent value="worklogs">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{t("workLogType")}</TableHead>
                <TableHead>{t("hours")}</TableHead>
                <TableHead>{t("notes")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {workLogs.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">{t("noResults")}</TableCell></TableRow>
                : workLogs.map((wl: any) => (
                  <TableRow key={wl.id}>
                    <TableCell>{formatDate(wl.date)}</TableCell>
                    <TableCell>{wl.type}</TableCell>
                    <TableCell>{wl.hours}</TableCell>
                    <TableCell>{wl.notes || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        {/* Deductions */}
        <TabsContent value="deductions">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>{t("type")}</TableHead>
                <TableHead>{t("description")}</TableHead>
                <TableHead>{t("totalAmount")}</TableHead>
                <TableHead>{t("paidAmountLabel")}</TableHead>
                <TableHead>{t("remainingAmount")}</TableHead>
                <TableHead>{t("status")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {deductions.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">{t("noResults")}</TableCell></TableRow>
                : deductions.map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell>{d.type}</TableCell>
                    <TableCell>{d.description}</TableCell>
                    <TableCell>{formatNum(d.total_amount)}</TableCell>
                    <TableCell>{formatNum(d.paid_amount)}</TableCell>
                    <TableCell>{formatNum(d.total_amount - d.paid_amount)}</TableCell>
                    <TableCell><Badge variant={d.is_active ? "default" : "outline"}>{d.is_active ? t("active") : t("inactive")}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      {form && (
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{t("editEmployee")}</DialogTitle></DialogHeader>
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
                <div className="grid gap-2">
                  <Label>{t("position")}</Label>
                  {positionTemplates.length > 0 ? (
                    <Select value={form.position_template_id || "__none"} onValueChange={v => {
                      const tpl = positionTemplates.find((p: any) => p.id === v);
                      setForm({ ...form, position_template_id: v === "__none" ? null : v, position: tpl ? tpl.name : form.position });
                    }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">{t("manual")}</SelectItem>
                        {positionTemplates.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} />
                  )}
                </div>
              </div>
              {!form.position_template_id && positionTemplates.length > 0 && (
                <div className="grid gap-2">
                  <Label>{t("position")} ({t("manual")})</Label>
                  <Input value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} />
                </div>
              )}
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
                <div className="grid gap-2"><Label>{t("dailyWorkHoursLabel")}</Label><Input type="number" step="0.5" value={form.daily_work_hours} onChange={e => setForm({ ...form, daily_work_hours: +e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2"><Label>{t("hireDate")}</Label><Input type="date" value={form.hire_date} onChange={e => setForm({ ...form, hire_date: e.target.value, start_date: e.target.value })} /></div>
                <div className="grid gap-2"><Label>{t("terminationDate")}</Label><Input type="date" value={form.termination_date} onChange={e => setForm({ ...form, termination_date: e.target.value })} /></div>
                <div className="grid gap-2"><Label>{t("earlyTerminationDate")}</Label><Input type="date" value={form.early_termination_date} onChange={e => setForm({ ...form, early_termination_date: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2"><Label>{t("annualLeaveDays")}</Label><Input type="number" value={form.annual_leave_days} onChange={e => setForm({ ...form, annual_leave_days: +e.target.value })} /></div>
                <div className="grid gap-2"><Label>{t("slavaDate")}</Label><Input type="date" value={form.slava_date} onChange={e => setForm({ ...form, slava_date: e.target.value })} /></div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={form.is_archived} onCheckedChange={v => setForm({ ...form, is_archived: !!v })} />
                {t("isArchived")}
              </label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)}>{t("cancel")}</Button>
              <Button onClick={() => mutation.mutate(form)} disabled={!form.first_name || !form.last_name || mutation.isPending}>
                {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-medium">{value || "—"}</p>
    </div>
  );
}
