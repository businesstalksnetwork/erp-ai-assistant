import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AiAnalyticsNarrative } from "@/components/ai/AiAnalyticsNarrative";
import { Skeleton } from "@/components/ui/skeleton";
import { Banknote, Users } from "lucide-react";
import { fmtNum } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

export default function PayrollBenchmark() {
  const { locale } = useLanguage();
  const { tenantId } = useTenant();
  const sr = locale === "sr";
  const t = (en: string, srText: string) => sr ? srText : en;

  const { data, isLoading } = useQuery({
    queryKey: ["payroll-benchmark", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const year = new Date().getFullYear();

      // Get payroll runs
      const { data: payrolls } = await (supabase
        .from("payroll_runs")
        .select("id, month, year, total_gross, total_net, status")
        .eq("tenant_id", tenantId!)
        .in("status", ["approved", "paid"]) as any);

      // Get employee count
      const { data: employees } = await supabase
        .from("employees")
        .select("id, status")
        .eq("tenant_id", tenantId!)
        .eq("status", "active");

      // Get revenue from journal lines
      const { data: lines } = await (supabase
        .from("journal_lines")
        .select("debit, credit, chart_of_accounts:account_id(account_type), journal:journal_entry_id(status, entry_date, tenant_id)")
        .eq("journal.tenant_id", tenantId!) as any);

      // Monthly revenue
      const monthlyRevenue = new Map<string, number>();
      for (const line of (lines as any[]) || []) {
        if (line.journal?.status !== "posted") continue;
        if (line.chart_of_accounts?.account_type !== "revenue") continue;
        const d = line.journal.entry_date || "";
        const lineYear = parseInt(d.substring(0, 4));
        if (lineYear !== year) continue;
        const month = parseInt(d.substring(5, 7));
        const key = `${month}`;
        monthlyRevenue.set(key, (monthlyRevenue.get(key) || 0) + ((Number(line.credit) || 0) - (Number(line.debit) || 0)));
      }

      // Monthly payroll
      const monthlyPayroll = new Map<string, number>();
      let totalPayrollYTD = 0;
      for (const p of payrolls || []) {
        if (p.year !== year) continue;
        const gross = Number(p.total_gross) || 0;
        monthlyPayroll.set(`${p.month}`, gross);
        totalPayrollYTD += gross;
      }

      let totalRevenueYTD = 0;
      monthlyRevenue.forEach(v => totalRevenueYTD += v);

      const employeeCount = (employees || []).length || 1;
      const payrollOfRevenue = totalRevenueYTD > 0 ? (totalPayrollYTD / totalRevenueYTD * 100) : 0;
      const costPerEmployee = totalPayrollYTD / employeeCount;

      // Build trend data
      const trend = [];
      for (let m = 1; m <= 12; m++) {
        const rev = monthlyRevenue.get(`${m}`) || 0;
        const pay = monthlyPayroll.get(`${m}`) || 0;
        if (rev > 0 || pay > 0) {
          trend.push({
            month: sr ? `${m}. mesec` : `Month ${m}`,
            revenue: Math.round(rev),
            payroll: Math.round(pay),
          });
        }
      }

      return {
        payrollOfRevenue: Math.round(payrollOfRevenue * 10) / 10,
        costPerEmployee: Math.round(costPerEmployee),
        totalPayrollYTD: Math.round(totalPayrollYTD),
        totalRevenueYTD: Math.round(totalRevenueYTD),
        employeeCount,
        trend,
      };
    },
  });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="space-y-6">
      <PageHeader title={t("Payroll Burden & Salary Benchmark", "Benchmark zarada i troškova rada")} icon={Banknote} />

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase">{t("Payroll % Revenue", "Zarade % prihoda")}</p><p className={`text-2xl font-bold mt-1 ${(data?.payrollOfRevenue || 0) > 50 ? "text-destructive" : ""}`}>{data?.payrollOfRevenue || 0}%</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase">{t("Cost per Employee", "Trošak po zaposlenom")}</p><p className="text-2xl font-bold mt-1">{fmtNum(data?.costPerEmployee || 0)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase">{t("Headcount", "Zaposleni")}</p><p className="text-2xl font-bold mt-1">{data?.employeeCount || 0}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase">{t("Total Payroll YTD", "Ukupne zarade YTD")}</p><p className="text-2xl font-bold mt-1">{fmtNum(data?.totalPayrollYTD || 0)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">{t("Payroll vs Revenue Trend", "Zarade vs prihodi — trend")}</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data?.trend || []}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" className="text-xs" />
              <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} className="text-xs" />
              <Tooltip formatter={(v: number) => `${fmtNum(v)} RSD`} />
              <Legend />
              <Line type="monotone" dataKey="revenue" name={t("Revenue", "Prihodi")} stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="payroll" name={t("Payroll", "Zarade")} stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {tenantId && data && (
        <AiAnalyticsNarrative
          tenantId={tenantId}
          contextType="payroll_benchmark"
          data={{
            payrollPercentOfRevenue: data.payrollOfRevenue,
            costPerEmployee: data.costPerEmployee,
            employeeCount: data.employeeCount,
            totalPayrollYTD: data.totalPayrollYTD,
            totalRevenueYTD: data.totalRevenueYTD,
          }}
        />
      )}
    </div>
  );
}
