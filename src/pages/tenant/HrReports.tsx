import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle } from "lucide-react";
import { ExportButton } from "@/components/ExportButton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AiModuleInsights } from "@/components/shared/AiModuleInsights";
import { AiAnalyticsNarrative } from "@/components/ai/AiAnalyticsNarrative";
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { endOfMonth, format } from "date-fns";
import { fmtNum } from "@/lib/utils";

const WORK_LOG_TYPES = ["workday", "weekend", "holiday", "vacation", "sick_leave", "paid_leave", "unpaid_leave", "maternity_leave", "holiday_work", "slava"] as const;

export default function HrReports() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const navigate = useNavigate();
  const now = new Date();
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);

  const periodStart = format(new Date(filterYear, filterMonth - 1, 1), "yyyy-MM-dd");
  const periodEnd = format(endOfMonth(new Date(filterYear, filterMonth - 1, 1)), "yyyy-MM-dd");

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-report", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("employees").select("id, full_name, daily_work_hours, position, department_id, departments(name), position_template_id, position_templates(name)").eq("tenant_id", tenantId!).eq("is_ghost", false).order("full_name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: workLogs = [], isLoading } = useQuery({
    queryKey: ["work-logs-report", tenantId, periodStart, periodEnd],
    queryFn: async () => {
      const { data } = await supabase.from("work_logs").select("*").eq("tenant_id", tenantId!).gte("date", periodStart).lte("date", periodEnd);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: overtimeData = [] } = useQuery({
    queryKey: ["overtime-report", tenantId, filterYear, filterMonth],
    queryFn: async () => {
      const { data } = await supabase.from("overtime_hours").select("*").eq("tenant_id", tenantId!).eq("year", filterYear).eq("month", filterMonth);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: nightData = [] } = useQuery({
    queryKey: ["night-work-report", tenantId, filterYear, filterMonth],
    queryFn: async () => {
      const { data } = await supabase.from("night_work_hours").select("*").eq("tenant_id", tenantId!).eq("year", filterYear).eq("month", filterMonth);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: leaveBalances = [] } = useQuery({
    queryKey: ["annual-leave-report", tenantId, filterYear],
    queryFn: async () => {
      const { data } = await supabase.from("annual_leave_balances").select("*, employees(full_name)").eq("tenant_id", tenantId!).eq("year", filterYear).order("created_at");
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Payroll cost data for the selected month
  const { data: payrollCostData } = useQuery({
    queryKey: ["payroll-cost-report", tenantId, filterYear, filterMonth],
    queryFn: async () => {
      const { data: runs } = await supabase.from("payroll_runs")
        .select("id").eq("tenant_id", tenantId!)
        .eq("period_year", filterYear).eq("period_month", filterMonth)
        .in("status", ["approved", "paid"]) as any;
      if (!runs?.length) return [];
      const runIds = runs.map((r: any) => r.id);
      const { data: items } = await supabase.from("payroll_items")
        .select("employee_id, gross_salary, net_salary, income_tax, pension_contribution, health_contribution, unemployment_contribution, employer_pio, employer_health, pension_employer, health_employer, subsidy_amount, meal_allowance, transport_allowance, payroll_category_id")
        .in("payroll_run_id", runIds) as any;
      return items || [];
    },
    enabled: !!tenantId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["payroll-categories-report", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("payroll_income_categories").select("id, code, name").eq("tenant_id", tenantId!) as any;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const payrollCostReport = useMemo(() => {
    if (!payrollCostData?.length) return [];
    return employees.map((emp: any) => {
      const items = payrollCostData.filter((i: any) => i.employee_id === emp.id);
      if (!items.length) return null;
      const sum = (field: string) => items.reduce((s: number, i: any) => s + (Number(i[field]) || 0), 0);
      const gross = sum("gross_salary");
      const net = sum("net_salary");
      const tax = sum("income_tax");
      const empContrib = sum("pension_contribution") + sum("health_contribution") + sum("unemployment_contribution");
      const erContrib = (sum("employer_pio") || sum("pension_employer")) + (sum("employer_health") || sum("health_employer"));
      const subsidy = sum("subsidy_amount");
      const catId = items[0]?.payroll_category_id;
      const cat = categories.find((c: any) => c.id === catId);
      return {
        id: emp.id, name: emp.full_name,
        category: cat ? cat.code : "—",
        gross, net, tax, empContrib, erContrib,
        totalCost: gross + erContrib,
        subsidy,
      };
    }).filter(Boolean);
  }, [payrollCostData, employees, categories]);

  const monthlyReport = employees.map((emp: any) => {
    const empLogs = workLogs.filter((l: any) => l.employee_id === emp.id);
    const byType: Record<string, number> = {};
    WORK_LOG_TYPES.forEach(tp => { byType[tp] = 0; });
    empLogs.forEach((l: any) => { byType[l.type] = (byType[l.type] || 0) + Number(l.hours); });

    const overtime = overtimeData.find((o: any) => o.employee_id === emp.id);
    const night = nightData.find((n: any) => n.employee_id === emp.id);
    const overtimeHrs = overtime ? Number(overtime.hours) : 0;
    const nightHrs = night ? Number(night.hours) : 0;

    const regularHours = Object.values(byType).reduce((a, b) => a + b, 0);
    const totalHours = regularHours - nightHrs + overtimeHrs;

    return {
      id: emp.id, name: emp.full_name,
      department: (emp as any).departments?.name || "—",
      position: (emp as any).position_templates?.name || emp.position || "—",
      ...byType, overtime: overtimeHrs, night: nightHrs, regular: regularHours, total: totalHours,
    };
  });

  // Department breakdown
  const deptBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; headcount: number; totalHours: number; overtime: number }>();
    monthlyReport.forEach(r => {
      const dept = r.department;
      const existing = map.get(dept) || { name: dept, headcount: 0, totalHours: 0, overtime: 0 };
      existing.headcount += 1;
      existing.totalHours += r.total;
      existing.overtime += r.overtime;
      map.set(dept, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.headcount - a.headcount);
  }, [monthlyReport]);

  // Position breakdown
  const posBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; headcount: number; totalHours: number }>();
    monthlyReport.forEach(r => {
      const pos = r.position;
      const existing = map.get(pos) || { name: pos, headcount: 0, totalHours: 0 };
      existing.headcount += 1;
      existing.totalHours += r.total;
      map.set(pos, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.headcount - a.headcount);
  }, [monthlyReport]);

  const exportColumns = [
    { key: "name", label: t("employee") },
    { key: "department", label: t("department") },
    { key: "position", label: t("position") },
    ...WORK_LOG_TYPES.map(tp => ({ key: tp, label: t(tp as any) || tp })),
    { key: "overtime", label: t("overtimeHours") },
    { key: "night", label: t("nightWork") },
    { key: "total", label: t("totalHours") },
  ];

  return (
    <div className="space-y-6 min-w-0 overflow-hidden">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("hrReports")}</h1>
        <ExportButton data={monthlyReport} columns={exportColumns} filename="hr-monthly-report" />
      </div>

      <div className="flex gap-4">
        <div className="grid gap-1"><Label>{t("year")}</Label><Input type="number" className="w-24" value={filterYear} onChange={e => setFilterYear(+e.target.value)} /></div>
        <div className="grid gap-1"><Label>{t("periodMonth")}</Label><Input type="number" min={1} max={12} className="w-24" value={filterMonth} onChange={e => setFilterMonth(+e.target.value)} /></div>
      </div>

      {tenantId && <AiModuleInsights tenantId={tenantId} module="hr" />}

      {(() => {
        const excessiveOvertime = monthlyReport.filter(r => r.overtime > 40);
        const missingLogs = monthlyReport.filter(r => r.total === 0);
        if (excessiveOvertime.length === 0 && missingLogs.length === 0) return null;
        return (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {excessiveOvertime.length > 0 && (
                <span className="block">
                  ⚠️ {excessiveOvertime.length} {t("employees").toLowerCase()} with excessive overtime (&gt;40h): {excessiveOvertime.slice(0, 3).map(r => `${r.name} (${r.overtime}h)`).join(", ")}
                </span>
              )}
              {missingLogs.length > 0 && (
                <span className="block">
                  ⚠️ {missingLogs.length} {t("employees").toLowerCase()} with no logged hours: {missingLogs.slice(0, 3).map(r => r.name).join(", ")}
                </span>
              )}
            </AlertDescription>
          </Alert>
        );
      })()}

      {tenantId && (
        <AiAnalyticsNarrative
          tenantId={tenantId}
          contextType="dashboard"
          data={{
            employeeCount: employees.length,
            totalHours: monthlyReport.reduce((a, b) => a + b.total, 0),
            totalOvertime: monthlyReport.reduce((a, b) => a + b.overtime, 0),
            excessiveOvertimeCount: monthlyReport.filter(r => r.overtime > 40).length,
            missingLogsCount: monthlyReport.filter(r => r.total === 0).length,
            avgHoursPerEmployee: employees.length > 0 ? Math.round(monthlyReport.reduce((a, b) => a + b.total, 0) / employees.length) : 0,
          }}
        />
      )}

      <Tabs defaultValue="monthly">
        <TabsList className="flex-wrap">
          <TabsTrigger value="monthly">{t("monthlyReport")}</TabsTrigger>
          <TabsTrigger value="payrollCost">{t("payroll")}</TabsTrigger>
          <TabsTrigger value="leave">{t("annualLeaveReport")}</TabsTrigger>
          <TabsTrigger value="byDepartment">{t("department")}</TabsTrigger>
          <TabsTrigger value="byPosition">{t("position")}</TabsTrigger>
          <TabsTrigger value="analytics">{t("hrAnalytics")}</TabsTrigger>
        </TabsList>

        <TabsContent value="monthly">
          <Card><CardContent className="p-0 overflow-auto">
            {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="sticky left-0 bg-card">{t("employee")}</TableHead>
                  <TableHead>{t("department")}</TableHead>
                  <TableHead>{t("position")}</TableHead>
                  {WORK_LOG_TYPES.map(tp => <TableHead key={tp} className="text-right text-xs">{t(tp as any) || tp}</TableHead>)}
                  <TableHead className="text-right">{t("overtimeHours")}</TableHead>
                  <TableHead className="text-right">{t("nightWork")}</TableHead>
                  <TableHead className="text-right font-semibold">{t("totalHours")}</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {monthlyReport.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="sticky left-0 bg-card font-medium"><span className="text-primary hover:underline cursor-pointer" onClick={() => navigate(`/hr/employees/${r.id}`)}>{r.name}</span></TableCell>
                      <TableCell>{r.department}</TableCell>
                      <TableCell>{r.position}</TableCell>
                      {WORK_LOG_TYPES.map(tp => <TableCell key={tp} className="text-right">{(r as any)[tp] || "—"}</TableCell>)}
                      <TableCell className="text-right">{r.overtime || "—"}</TableCell>
                      <TableCell className="text-right">{r.night || "—"}</TableCell>
                      <TableCell className="text-right font-semibold">{r.total}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="payrollCost">
          <Card><CardContent className="p-0 overflow-auto">
            {payrollCostReport.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">{t("noResults")}</p>
            ) : (
              <>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="sticky left-0 bg-card">{t("employee")}</TableHead>
                    <TableHead>{t("category")}</TableHead>
                    <TableHead className="text-right">{t("grossSalary")}</TableHead>
                    <TableHead className="text-right">{t("netSalary")}</TableHead>
                    <TableHead className="text-right">{t("tax")}</TableHead>
                    <TableHead className="text-right">{t("contributions")}</TableHead>
                    <TableHead className="text-right">{t("employerContrib")}</TableHead>
                    <TableHead className="text-right font-semibold">{t("totalCost")}</TableHead>
                    <TableHead className="text-right">{t("subsidies")}</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {payrollCostReport.map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell className="sticky left-0 bg-card font-medium"><span className="text-primary hover:underline cursor-pointer" onClick={() => navigate(`/hr/employees/${r.id}`)}>{r.name}</span></TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{r.category}</Badge></TableCell>
                        <TableCell className="text-right tabular-nums">{fmtNum(r.gross)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtNum(r.net)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtNum(r.tax)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtNum(r.empContrib)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtNum(r.erContrib)}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">{fmtNum(r.totalCost)}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.subsidy > 0 ? fmtNum(r.subsidy) : "—"}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell className="sticky left-0 bg-muted/50">{t("total")}</TableCell>
                      <TableCell />
                      <TableCell className="text-right tabular-nums">{fmtNum(payrollCostReport.reduce((s: number, r: any) => s + r.gross, 0))}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtNum(payrollCostReport.reduce((s: number, r: any) => s + r.net, 0))}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtNum(payrollCostReport.reduce((s: number, r: any) => s + r.tax, 0))}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtNum(payrollCostReport.reduce((s: number, r: any) => s + r.empContrib, 0))}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtNum(payrollCostReport.reduce((s: number, r: any) => s + r.erContrib, 0))}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtNum(payrollCostReport.reduce((s: number, r: any) => s + r.totalCost, 0))}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtNum(payrollCostReport.reduce((s: number, r: any) => s + r.subsidy, 0))}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="leave">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>{t("employee")}</TableHead>
                <TableHead className="text-right">{t("entitledDays")}</TableHead>
                <TableHead className="text-right">{t("carriedOverDays")}</TableHead>
                <TableHead className="text-right">{t("usedDays")}</TableHead>
                <TableHead className="text-right">{t("remainingDays")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {leaveBalances.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">{t("noResults")}</TableCell></TableRow>
                : leaveBalances.map((b: any) => (
                  <TableRow key={b.id}>
                    <TableCell><span className="text-primary hover:underline cursor-pointer font-medium" onClick={() => navigate(`/hr/employees/${b.employee_id}`)}>{b.employees?.full_name}</span></TableCell>
                    <TableCell className="text-right">{b.entitled_days}</TableCell>
                    <TableCell className="text-right">{b.carried_over_days}</TableCell>
                    <TableCell className="text-right">{b.used_days}</TableCell>
                    <TableCell className="text-right font-semibold">{b.entitled_days + b.carried_over_days - b.used_days}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="byDepartment">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>{t("department")}</TableHead>
                <TableHead className="text-right">{t("employees")}</TableHead>
                <TableHead className="text-right">{t("totalHours")}</TableHead>
                <TableHead className="text-right">{t("overtimeHours")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {deptBreakdown.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">{t("noResults")}</TableCell></TableRow>
                : deptBreakdown.map(d => (
                  <TableRow key={d.name}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell className="text-right">{d.headcount}</TableCell>
                    <TableCell className="text-right">{d.totalHours}</TableCell>
                    <TableCell className="text-right">{d.overtime}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="byPosition">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>{t("position")}</TableHead>
                <TableHead className="text-right">{t("employees")}</TableHead>
                <TableHead className="text-right">{t("totalHours")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {posBreakdown.length === 0 ? <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">{t("noResults")}</TableCell></TableRow>
                : posBreakdown.map(p => (
                  <TableRow key={p.name}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-right">{p.headcount}</TableCell>
                    <TableCell className="text-right">{p.totalHours}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="analytics">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card><CardHeader><CardTitle className="text-sm">{t("employees")}</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{employees.length}</div></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm">{t("totalHours")}</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{monthlyReport.reduce((a, b) => a + b.total, 0)}</div></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm">{t("overtimeHours")}</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{monthlyReport.reduce((a, b) => a + b.overtime, 0)}</div></CardContent></Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
