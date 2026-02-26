import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AiAnalyticsNarrative } from "@/components/ai/AiAnalyticsNarrative";
import { Skeleton } from "@/components/ui/skeleton";
import { Banknote } from "lucide-react";
import { fmtNum } from "@/lib/utils";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from "recharts";

const COLORS = [
  "hsl(var(--primary))", "hsl(var(--destructive))", "hsl(var(--accent-foreground))",
  "#f59e0b", "#10b981", "#6366f1", "#ec4899", "#14b8a6", "#8b5cf6", "#f97316", "#06b6d4", "#84cc16",
];

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

      const [{ data: payrolls }, { data: items }, { data: employees }, { data: categories }, { data: lines }] = await Promise.all([
        supabase.from("payroll_runs").select("id, period_month, period_year, total_gross, total_net, total_taxes, total_contributions, status")
          .eq("tenant_id", tenantId!).in("status", ["approved", "paid"]) as any,
        supabase.from("payroll_items").select("payroll_run_id, gross_salary, net_salary, income_tax, pension_contribution, health_contribution, unemployment_contribution, pension_employer, health_employer, employer_pio, employer_health, subsidy_amount, meal_allowance, transport_allowance, payroll_category_id, employee_id")
          .order("created_at") as any,
        supabase.from("employees").select("id, status, full_name").eq("tenant_id", tenantId!).eq("status", "active").eq("is_ghost", false),
        supabase.from("payroll_income_categories").select("id, code, name").eq("tenant_id", tenantId!) as any,
        supabase.from("journal_lines").select("debit, credit, chart_of_accounts:account_id(account_type), journal:journal_entry_id(status, entry_date, tenant_id)")
          .eq("journal.tenant_id", tenantId!) as any,
      ]);

      const yearRuns = (payrolls || []).filter((p: any) => p.period_year === year);
      const yearRunIds = new Set(yearRuns.map((r: any) => r.id));
      const yearItems = (items || []).filter((i: any) => yearRunIds.has(i.payroll_run_id));

      // Monthly revenue
      const monthlyRevenue = new Map<number, number>();
      for (const line of (lines as any[]) || []) {
        if (line.journal?.status !== "posted" || line.chart_of_accounts?.account_type !== "revenue") continue;
        const d = line.journal.entry_date || "";
        if (parseInt(d.substring(0, 4)) !== year) continue;
        const month = parseInt(d.substring(5, 7));
        monthlyRevenue.set(month, (monthlyRevenue.get(month) || 0) + ((Number(line.credit) || 0) - (Number(line.debit) || 0)));
      }

      // Monthly payroll trend with cost breakdown
      const monthlyData = new Map<number, { gross: number; net: number; tax: number; empContrib: number; erContrib: number; subsidies: number; allowances: number }>();
      for (const item of yearItems) {
        const run = yearRuns.find((r: any) => r.id === item.payroll_run_id);
        if (!run) continue;
        const m = run.period_month;
        const existing = monthlyData.get(m) || { gross: 0, net: 0, tax: 0, empContrib: 0, erContrib: 0, subsidies: 0, allowances: 0 };
        existing.gross += Number(item.gross_salary) || 0;
        existing.net += Number(item.net_salary) || 0;
        existing.tax += Number(item.income_tax) || 0;
        existing.empContrib += (Number(item.pension_contribution) || 0) + (Number(item.health_contribution) || 0) + (Number(item.unemployment_contribution) || 0);
        existing.erContrib += (Number(item.employer_pio || item.pension_employer) || 0) + (Number(item.employer_health || item.health_employer) || 0);
        existing.subsidies += Number(item.subsidy_amount) || 0;
        existing.allowances += (Number(item.meal_allowance) || 0) + (Number(item.transport_allowance) || 0);
        monthlyData.set(m, existing);
      }

      // Category breakdown
      const catMap = new Map<string, { name: string; gross: number; count: number; erCost: number; subsidies: number }>();
      for (const item of yearItems) {
        const catId = item.payroll_category_id || "uncategorized";
        const cat = (categories || []).find((c: any) => c.id === catId);
        const catName = cat ? `${cat.code} — ${cat.name}` : t("Uncategorized", "Nekategorizovano");
        const existing = catMap.get(catId) || { name: catName, gross: 0, count: 0, erCost: 0, subsidies: 0 };
        existing.gross += Number(item.gross_salary) || 0;
        existing.count += 1;
        existing.erCost += (Number(item.employer_pio || item.pension_employer) || 0) + (Number(item.employer_health || item.health_employer) || 0);
        existing.subsidies += Number(item.subsidy_amount) || 0;
        catMap.set(catId, existing);
      }

      let totalPayrollYTD = 0, totalRevenueYTD = 0;
      yearRuns.forEach((p: any) => totalPayrollYTD += Number(p.total_gross) || 0);
      monthlyRevenue.forEach(v => totalRevenueYTD += v);

      const totalErContrib = yearItems.reduce((s: number, i: any) => s + (Number(i.employer_pio || i.pension_employer) || 0) + (Number(i.employer_health || i.health_employer) || 0), 0);
      const totalSubsidies = yearItems.reduce((s: number, i: any) => s + (Number(i.subsidy_amount) || 0), 0);
      const totalAllowances = yearItems.reduce((s: number, i: any) => s + (Number(i.meal_allowance) || 0) + (Number(i.transport_allowance) || 0), 0);
      const totalEmployerCost = totalPayrollYTD + totalErContrib;

      const employeeCount = (employees || []).length || 1;

      const trend = [];
      for (let m = 1; m <= 12; m++) {
        const rev = monthlyRevenue.get(m) || 0;
        const md = monthlyData.get(m);
        if (rev > 0 || md) {
          trend.push({
            month: sr ? `${m}. mes.` : `M${m}`,
            revenue: Math.round(rev),
            gross: Math.round(md?.gross || 0),
            erContrib: Math.round(md?.erContrib || 0),
            net: Math.round(md?.net || 0),
            tax: Math.round(md?.tax || 0),
          });
        }
      }

      const categoryBreakdown = Array.from(catMap.values())
        .sort((a, b) => b.gross - a.gross)
        .map(c => ({ ...c, gross: Math.round(c.gross), erCost: Math.round(c.erCost), subsidies: Math.round(c.subsidies) }));

      return {
        payrollOfRevenue: totalRevenueYTD > 0 ? Math.round(totalPayrollYTD / totalRevenueYTD * 1000) / 10 : 0,
        costPerEmployee: Math.round(totalEmployerCost / employeeCount),
        totalPayrollYTD: Math.round(totalPayrollYTD),
        totalRevenueYTD: Math.round(totalRevenueYTD),
        totalErContrib: Math.round(totalErContrib),
        totalSubsidies: Math.round(totalSubsidies),
        totalAllowances: Math.round(totalAllowances),
        totalEmployerCost: Math.round(totalEmployerCost),
        employeeCount,
        trend,
        categoryBreakdown,
      };
    },
  });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="space-y-6">
      <PageHeader title={t("Payroll Burden & Salary Benchmark", "Benchmark zarada i troškova rada")} icon={Banknote} />

      {/* KPI Cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase">{t("Payroll % Revenue", "Zarade % prihoda")}</p><p className={`text-2xl font-bold mt-1 ${(data?.payrollOfRevenue || 0) > 50 ? "text-destructive" : ""}`}>{data?.payrollOfRevenue || 0}%</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase">{t("Total Employer Cost", "Ukupan trošak poslodavca")}</p><p className="text-2xl font-bold mt-1">{fmtNum(data?.totalEmployerCost || 0)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase">{t("Cost per Employee", "Trošak po zaposlenom")}</p><p className="text-2xl font-bold mt-1">{fmtNum(data?.costPerEmployee || 0)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase">{t("Headcount", "Zaposleni")}</p><p className="text-2xl font-bold mt-1">{data?.employeeCount || 0}</p></CardContent></Card>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase">{t("Total Gross YTD", "Bruto YTD")}</p><p className="text-lg font-semibold mt-1">{fmtNum(data?.totalPayrollYTD || 0)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase">{t("Employer Contrib. YTD", "Doprinosi posl. YTD")}</p><p className="text-lg font-semibold mt-1">{fmtNum(data?.totalErContrib || 0)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase">{t("Subsidies YTD", "Subvencije YTD")}</p><p className="text-lg font-semibold mt-1 text-green-600">{fmtNum(data?.totalSubsidies || 0)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase">{t("Allowances YTD", "Naknade YTD")}</p><p className="text-lg font-semibold mt-1">{fmtNum(data?.totalAllowances || 0)}</p></CardContent></Card>
      </div>

      {/* Employer Cost Trend */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">{t("Employer Cost vs Revenue", "Trošak poslodavca vs prihodi")}</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data?.trend || []}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" className="text-xs" />
              <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} className="text-xs" />
              <Tooltip formatter={(v: number) => `${fmtNum(v)} RSD`} />
              <Legend />
              <Bar dataKey="net" name={t("Net Salary", "Neto")} stackId="cost" fill="hsl(var(--primary))" />
              <Bar dataKey="tax" name={t("Tax", "Porez")} stackId="cost" fill="#f59e0b" />
              <Bar dataKey="erContrib" name={t("Employer Contrib.", "Dopr. posl.")} stackId="cost" fill="hsl(var(--destructive))" />
              <Line type="monotone" dataKey="revenue" name={t("Revenue", "Prihodi")} stroke="#10b981" strokeWidth={2} dot={false} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Category Breakdown */}
      {(data?.categoryBreakdown?.length || 0) > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">{t("Cost by Income Category", "Troškovi po kategoriji prihoda")}</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={data?.categoryBreakdown} dataKey="gross" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name.split("—")[0].trim()} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {data?.categoryBreakdown.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${fmtNum(v)} RSD`} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">{t("Category Detail", "Detalj po kategoriji")}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>{t("Category", "Kategorija")}</TableHead>
                  <TableHead className="text-right">{t("Items", "Stavki")}</TableHead>
                  <TableHead className="text-right">{t("Gross", "Bruto")}</TableHead>
                  <TableHead className="text-right">{t("Employer Cost", "Dopr. posl.")}</TableHead>
                  <TableHead className="text-right">{t("Subsidies", "Subvencije")}</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {data?.categoryBreakdown.map((c: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs font-medium">{c.name}</TableCell>
                      <TableCell className="text-right">{c.count}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtNum(c.gross)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtNum(c.erCost)}</TableCell>
                      <TableCell className="text-right tabular-nums text-green-600">{fmtNum(c.subsidies)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

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
            totalEmployerContributions: data.totalErContrib,
            totalSubsidies: data.totalSubsidies,
            totalAllowances: data.totalAllowances,
            categoryCount: data.categoryBreakdown.length,
          }}
        />
      )}
    </div>
  );
}
