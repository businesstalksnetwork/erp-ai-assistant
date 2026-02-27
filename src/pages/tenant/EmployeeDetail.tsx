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
import { ArrowLeft, Download, Loader2, Pencil, Plus } from "lucide-react";
import { EmployeeAssetsTab } from "@/components/assets/EmployeeAssetsTab";
import { EmployeeDocumentsTab } from "@/components/hr/EmployeeDocumentsTab";
import { EmployeeOnboardingTab } from "@/components/hr/EmployeeOnboardingTab";
import { toast } from "sonner";
import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RateChangeHistory } from "@/components/hr/RateChangeHistory";

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
  payroll_category_id: string | null;
  bank_account_iban: string;
  bank_name: string;
  recipient_code: string;
  pib: string;
  manager_id: string | null;
  org_level: number;
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
  const [contractOpen, setContractOpen] = useState(false);
  const [contractForm, setContractForm] = useState({
    contract_type: "indefinite", start_date: new Date().toISOString().split("T")[0],
    end_date: "", gross_salary: 0, net_salary: 0, working_hours_per_week: 40,
    currency: "RSD", is_active: true, position_template_id: "",
  });
  const [salaryOpen, setSalaryOpen] = useState(false);
  const [salaryForm, setSalaryForm] = useState({
    amount: 0, amount_type: "gross", start_date: new Date().toISOString().split("T")[0], end_date: "",
  });

  const { data: employee, isLoading } = useQuery({
    queryKey: ["employee-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*, departments!employees_department_id_fkey(name), locations(name), position_templates(name), manager:employees!employees_manager_id_fkey(id, full_name)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!tenantId,
  });

  const { data: payrollCategories = [] } = useQuery({
    queryKey: ["payroll-categories-list", tenantId],
    queryFn: async () => {
      const { data } = await (supabase
        .from("payroll_income_categories")
        .select("id, code, name")
        .eq("tenant_id", tenantId!)
        .eq("is_active", true)
        .order("code") as any);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ["employee-contracts", id],
    queryFn: async () => {
      const { data } = await supabase.from("employee_contracts").select("*, position_templates(name)").eq("employee_id", id!).order("start_date", { ascending: false });
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

  const { data: insuranceRecords = [] } = useQuery({
    queryKey: ["employee-insurance", id],
    queryFn: async () => {
      const { data } = await supabase.from("insurance_records").select("*").eq("employee_id", id!).order("insurance_start", { ascending: false });
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

  const { data: fellowEmployees = [] } = useQuery({
    queryKey: ["fellow-employees", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("employees").select("id, full_name").eq("tenant_id", tenantId!).eq("is_archived", false).order("full_name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const mutation = useMutation({
    mutationFn: async (f: EmployeeForm) => {
      const full_name = `${f.first_name} ${f.last_name}`.trim();
      const payload: any = {
        first_name: f.first_name, last_name: f.last_name, full_name,
        email: f.email, phone: f.phone, jmbg: f.jmbg, address: f.address, city: f.city,
        position: f.position, position_template_id: f.position_template_id || null,
        department_id: f.department_id || null, location_id: f.location_id || null,
        employment_type: f.employment_type, start_date: f.start_date,
        hire_date: f.hire_date || f.start_date || null,
        termination_date: f.termination_date || null,
        early_termination_date: f.early_termination_date || null,
        annual_leave_days: f.annual_leave_days, slava_date: f.slava_date || null,
        daily_work_hours: f.daily_work_hours, is_archived: f.is_archived,
        status: f.is_archived ? "inactive" : "active",
        tenant_id: tenantId!,
        payroll_category_id: f.payroll_category_id || null,
        bank_account_iban: f.bank_account_iban || null,
        bank_name: f.bank_name || null,
        recipient_code: f.recipient_code || null,
        pib: f.pib || null,
        manager_id: f.manager_id || null,
        org_level: f.org_level,
      };
      const { error } = await supabase.from("employees").update(payload).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employee-detail"] }); qc.invalidateQueries({ queryKey: ["employees"] }); setEditOpen(false); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const contractMutation = useMutation({
    mutationFn: async (f: typeof contractForm) => {
      const payload = {
        employee_id: id!, tenant_id: tenantId!, contract_type: f.contract_type,
        start_date: f.start_date, end_date: f.end_date || null,
        gross_salary: f.gross_salary, net_salary: f.net_salary,
        working_hours_per_week: f.working_hours_per_week, currency: f.currency, is_active: f.is_active,
        position_template_id: f.position_template_id || null,
      };
      const { error } = await supabase.from("employee_contracts").insert([payload]);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employee-contracts"] }); setContractOpen(false); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const salaryMutation = useMutation({
    mutationFn: async (f: typeof salaryForm) => {
      const payload = {
        employee_id: id!, tenant_id: tenantId!, amount: f.amount,
        amount_type: f.amount_type, start_date: f.start_date, end_date: f.end_date || null,
      };
      const { error } = await supabase.from("employee_salaries").insert([payload]);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employee-salaries"] }); setSalaryOpen(false); toast.success(t("success")); },
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
      payroll_category_id: (employee as any).payroll_category_id || null,
      bank_account_iban: (employee as any).bank_account_iban || "",
      bank_name: (employee as any).bank_name || "",
      recipient_code: (employee as any).recipient_code || "",
      pib: (employee as any).pib || "",
      manager_id: (employee as any).manager_id || null,
      org_level: (employee as any).org_level ?? 3,
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
  if (!employee) return (
    <div className="text-center py-12 space-y-4">
      <p className="text-muted-foreground">{t("noResults")}</p>
      <Button variant="outline" onClick={() => navigate("/hr/employees")}>
        <ArrowLeft className="h-4 w-4 mr-2" />{t("employees")}
      </Button>
    </div>
  );

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
            <h1 className="text-2xl font-bold">{employee.full_name}</h1>
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
          <TabsTrigger value="insurance">{t("insuranceRecords")}</TabsTrigger>
          <TabsTrigger value="assets">{t("assetsCrossEmployeeAssets" as any)}</TabsTrigger>
          <TabsTrigger value="documents">{t("documents")}</TabsTrigger>
          <TabsTrigger value="onboarding">{t("onboardingChecklists" as any)}</TabsTrigger>
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
                <InfoField label="Manager" value={(employee as any).manager?.full_name} />
                <InfoField label="Org Level" value={
                  ({ 0: "CEO", 1: "Director", 2: "Manager", 3: "Staff" } as Record<number, string>)[(employee as any).org_level ?? 3] || String((employee as any).org_level)
                } />
              </div>
            </CardContent>
          </Card>

          {/* Payroll Data Section */}
          <Card className="mt-4">
            <CardHeader><CardTitle className="text-base">{t("payrollDataSection")}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <InfoField label={t("incomeCategory")} value={
                  payrollCategories.find((c: any) => c.id === (employee as any).payroll_category_id)
                    ? `${(payrollCategories.find((c: any) => c.id === (employee as any).payroll_category_id) as any).code} – ${(payrollCategories.find((c: any) => c.id === (employee as any).payroll_category_id) as any).name}`
                    : "—"
                } />
                <InfoField label="IBAN" value={(employee as any).bank_account_iban} />
                <InfoField label="Banka" value={(employee as any).bank_name} />
                <InfoField label="Šifra primaoca" value={(employee as any).recipient_code} />
                <InfoField label="PIB" value={(employee as any).pib} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contracts */}
        <TabsContent value="contracts">
          <div className="flex justify-end mb-4">
            <Button onClick={() => { setContractForm({ contract_type: "indefinite", start_date: new Date().toISOString().split("T")[0], end_date: "", gross_salary: 0, net_salary: 0, working_hours_per_week: 40, currency: "RSD", is_active: true, position_template_id: employee?.position_template_id || "" }); setContractOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />{t("addContract")}
            </Button>
          </div>
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>{t("contractTypeLabel")}</TableHead>
                <TableHead>{t("position")}</TableHead>
                <TableHead>{t("startDate")}</TableHead>
                <TableHead>{t("endDate")}</TableHead>
                <TableHead>{t("grossSalary")}</TableHead>
                <TableHead>{t("status")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {contracts.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">{t("noResults")}</TableCell></TableRow>
                : contracts.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.contract_type}</TableCell>
                    <TableCell>{c.position_templates?.name || "—"}</TableCell>
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
          <div className="flex justify-end mb-4">
            <Button onClick={() => { setSalaryForm({ amount: 0, amount_type: "gross", start_date: new Date().toISOString().split("T")[0], end_date: "" }); setSalaryOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />{t("addSalary")}
            </Button>
          </div>
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

          {/* Rate Change History */}
          <RateChangeHistory employeeId={id!} tenantId={tenantId!} />
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

        {/* Insurance Records */}
        <TabsContent value="insurance">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>{t("jmbg")}</TableHead>
                <TableHead>{t("lbo")}</TableHead>
                <TableHead>{t("insuranceStart")}</TableHead>
                <TableHead>{t("insuranceEnd")}</TableHead>
                <TableHead>{t("registrationDate")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {insuranceRecords.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">{t("noResults")}</TableCell></TableRow>
                : insuranceRecords.map((ir: any) => (
                  <TableRow key={ir.id}>
                    <TableCell className="font-mono">{ir.jmbg}</TableCell>
                    <TableCell>{ir.lbo || "—"}</TableCell>
                    <TableCell>{formatDate(ir.insurance_start)}</TableCell>
                    <TableCell>{formatDate(ir.insurance_end)}</TableCell>
                    <TableCell>{formatDate(ir.registration_date)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        {/* Assets */}
        <TabsContent value="assets">
          <EmployeeAssetsTab employeeId={id!} />
        </TabsContent>

        {/* Documents */}
        <TabsContent value="documents">
          <EmployeeDocumentsTab employeeId={id!} tenantId={tenantId!} />
        </TabsContent>

        {/* Onboarding */}
        <TabsContent value="onboarding">
          <EmployeeOnboardingTab employeeId={id!} tenantId={tenantId!} />
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
                  <Label>{t("manager") || "Manager"}</Label>
                  <Select value={form.manager_id || "__none"} onValueChange={v => setForm({ ...form, manager_id: v === "__none" ? null : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">—</SelectItem>
                      {fellowEmployees.filter((e: any) => e.id !== id).map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Org Level</Label>
                  <Select value={String(form.org_level)} onValueChange={v => setForm({ ...form, org_level: +v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">CEO</SelectItem>
                      <SelectItem value="1">Director</SelectItem>
                      <SelectItem value="2">Manager</SelectItem>
                      <SelectItem value="3">Staff</SelectItem>
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

              {/* Payroll Data Fields */}
              <div className="border-t pt-4 mt-2">
                <p className="text-sm font-semibold mb-3">Podaci za obračun zarada</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Kategorija prihoda</Label>
                    <Select value={form.payroll_category_id || "__none"} onValueChange={v => setForm({ ...form, payroll_category_id: v === "__none" ? null : v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">—</SelectItem>
                        {payrollCategories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.code} – {c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2"><Label>IBAN</Label><Input value={form.bank_account_iban} onChange={e => setForm({ ...form, bank_account_iban: e.target.value })} placeholder="RS35..." /></div>
                </div>
                <div className="grid grid-cols-3 gap-4 mt-3">
                  <div className="grid gap-2"><Label>Banka</Label><Input value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })} /></div>
                  <div className="grid gap-2"><Label>Šifra primaoca</Label><Input value={form.recipient_code} onChange={e => setForm({ ...form, recipient_code: e.target.value })} /></div>
                  <div className="grid gap-2"><Label>PIB</Label><Input value={form.pib} onChange={e => setForm({ ...form, pib: e.target.value })} /></div>
                </div>
              </div>
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

      {/* Add Contract Dialog */}
      <Dialog open={contractOpen} onOpenChange={setContractOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t("addContract")}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("contractTypeLabel")} *</Label>
                <Select value={contractForm.contract_type} onValueChange={v => setContractForm({ ...contractForm, contract_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="indefinite">{t("indefinite")}</SelectItem>
                    <SelectItem value="fixed_term">{t("fixedTerm")}</SelectItem>
                    <SelectItem value="temporary">{t("temporary")}</SelectItem>
                    <SelectItem value="contract">{t("contractType")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{t("position")}</Label>
                <Select value={contractForm.position_template_id || "__none"} onValueChange={v => setContractForm({ ...contractForm, position_template_id: v === "__none" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                    {positionTemplates.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>{t("startDate")} *</Label><Input type="date" value={contractForm.start_date} onChange={e => setContractForm({ ...contractForm, start_date: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("endDate")}</Label><Input type="date" value={contractForm.end_date} onChange={e => setContractForm({ ...contractForm, end_date: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>{t("grossSalary")}</Label><Input type="number" value={contractForm.gross_salary} onChange={e => setContractForm({ ...contractForm, gross_salary: +e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("netSalary")}</Label><Input type="number" value={contractForm.net_salary} onChange={e => setContractForm({ ...contractForm, net_salary: +e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>{t("workingHours")}</Label><Input type="number" value={contractForm.working_hours_per_week} onChange={e => setContractForm({ ...contractForm, working_hours_per_week: +e.target.value })} /></div>
              <div className="grid gap-2">
                <Label>{t("currency")}</Label>
                <Select value={contractForm.currency} onValueChange={v => setContractForm({ ...contractForm, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RSD">RSD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={contractForm.is_active} onCheckedChange={v => setContractForm({ ...contractForm, is_active: v })} />
              {t("active")}
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContractOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => contractMutation.mutate(contractForm)} disabled={!contractForm.start_date || contractMutation.isPending}>
              {contractMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Salary Dialog */}
      <Dialog open={salaryOpen} onOpenChange={setSalaryOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("addSalary")}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2"><Label>{t("amount")} *</Label><Input type="number" value={salaryForm.amount} onChange={e => setSalaryForm({ ...salaryForm, amount: +e.target.value })} /></div>
            <div className="grid gap-2">
              <Label>{t("amountTypeLabel")}</Label>
              <Select value={salaryForm.amount_type} onValueChange={v => setSalaryForm({ ...salaryForm, amount_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gross">{t("gross")}</SelectItem>
                  <SelectItem value="net">{t("net")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>{t("startDate")} *</Label><Input type="date" value={salaryForm.start_date} onChange={e => setSalaryForm({ ...salaryForm, start_date: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("endDate")}</Label><Input type="date" value={salaryForm.end_date} onChange={e => setSalaryForm({ ...salaryForm, end_date: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSalaryOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => salaryMutation.mutate(salaryForm)} disabled={!salaryForm.amount || !salaryForm.start_date || salaryMutation.isPending}>
              {salaryMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
