import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle } from "lucide-react";
import { ExportButton } from "@/components/ExportButton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AiModuleInsights } from "@/components/shared/AiModuleInsights";
import { AiAnalyticsNarrative } from "@/components/ai/AiAnalyticsNarrative";
import { useState } from "react";
import { startOfMonth, endOfMonth, format } from "date-fns";

const WORK_LOG_TYPES = ["workday", "weekend", "holiday", "vacation", "sick_leave", "paid_leave", "unpaid_leave", "maternity_leave", "holiday_work", "slava"] as const;

export default function HrReports() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const now = new Date();
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);

  const periodStart = format(new Date(filterYear, filterMonth - 1, 1), "yyyy-MM-dd");
  const periodEnd = format(endOfMonth(new Date(filterYear, filterMonth - 1, 1)), "yyyy-MM-dd");

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-report", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("employees").select("id, full_name, daily_work_hours").eq("tenant_id", tenantId!).order("full_name");
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

  // Build monthly report data
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

    return { id: emp.id, name: emp.full_name, ...byType, overtime: overtimeHrs, night: nightHrs, regular: regularHours, total: totalHours };
  });

  const exportColumns = [
    { key: "name", label: t("employee") },
    ...WORK_LOG_TYPES.map(tp => ({ key: tp, label: t(tp as any) || tp })),
    { key: "overtime", label: t("overtimeHours") },
    { key: "night", label: t("nightWork") },
    { key: "total", label: t("totalHours") },
  ];

  return (
    <div className="space-y-6">
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
        <TabsList>
          <TabsTrigger value="monthly">{t("monthlyReport")}</TabsTrigger>
          <TabsTrigger value="leave">{t("annualLeaveReport")}</TabsTrigger>
          <TabsTrigger value="analytics">{t("hrAnalytics")}</TabsTrigger>
        </TabsList>

        <TabsContent value="monthly">
          <Card><CardContent className="p-0 overflow-auto">
            {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="sticky left-0 bg-card">{t("employee")}</TableHead>
                  {WORK_LOG_TYPES.map(tp => <TableHead key={tp} className="text-right text-xs">{t(tp as any) || tp}</TableHead>)}
                  <TableHead className="text-right">{t("overtimeHours")}</TableHead>
                  <TableHead className="text-right">{t("nightWork")}</TableHead>
                  <TableHead className="text-right font-semibold">{t("totalHours")}</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {monthlyReport.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="sticky left-0 bg-card font-medium">{r.name}</TableCell>
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
                    <TableCell>{b.employees?.full_name}</TableCell>
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
