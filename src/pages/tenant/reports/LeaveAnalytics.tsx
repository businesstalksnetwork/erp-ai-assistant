import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, lazy, Suspense } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from "recharts";

const LeaveBalanceSummaryTable = lazy(() => import("@/components/hr/LeaveBalanceSummaryTable"));
const AbsenteeismReport = lazy(() => import("@/components/hr/AbsenteeismReport"));

const COLORS = ["hsl(var(--primary))", "hsl(var(--destructive))", "hsl(var(--accent))", "#f59e0b", "#8b5cf6", "#06b6d4"];

export default function LeaveAnalytics() {
  const { t, locale } = useLanguage();
  const { tenantId } = useTenant();
  const [year, setYear] = useState(new Date().getFullYear());
  const sr = locale === "sr";

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["leave-analytics", tenantId, year],
    queryFn: async () => {
      const { data } = await supabase
        .from("leave_requests")
        .select("*, employees!inner(first_name, last_name, department_id, departments(name))")
        .eq("tenant_id", tenantId!)
        .gte("start_date", `${year}-01-01`)
        .lte("start_date", `${year}-12-31`)
        .order("start_date");
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Type breakdown
  const typeMap = new Map<string, number>();
  const statusMap = new Map<string, number>();
  const monthlyMap = new Map<number, { approved: number; rejected: number; pending: number }>();
  const deptMap = new Map<string, number>();

  requests.forEach((r: any) => {
    const days = r.total_days || 1;
    typeMap.set(r.leave_type, (typeMap.get(r.leave_type) || 0) + days);
    statusMap.set(r.status, (statusMap.get(r.status) || 0) + 1);
    const month = new Date(r.start_date).getMonth();
    const m = monthlyMap.get(month) || { approved: 0, rejected: 0, pending: 0 };
    if (r.status === "approved") m.approved += days;
    else if (r.status === "rejected") m.rejected++;
    else if (r.status === "pending") m.pending++;
    monthlyMap.set(month, m);
    const dept = r.employees?.departments?.name || (sr ? "Bez odeljenja" : "No Department");
    if (r.status === "approved") deptMap.set(dept, (deptMap.get(dept) || 0) + days);
  });

  const typeData = Array.from(typeMap, ([name, value]) => ({ name, value }));
  const statusData = Array.from(statusMap, ([name, value]) => ({ name, value }));
  const monthNames = sr
    ? ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Avg", "Sep", "Okt", "Nov", "Dec"]
    : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthlyData = monthNames.map((name, i) => ({
    name,
    ...(monthlyMap.get(i) || { approved: 0, rejected: 0, pending: 0 }),
  }));
  const deptData = Array.from(deptMap, ([name, days]) => ({ name, days })).sort((a, b) => b.days - a.days);

  const totalApproved = requests.filter((r: any) => r.status === "approved").length;
  const totalDays = requests.filter((r: any) => r.status === "approved").reduce((s: number, r: any) => s + (r.total_days || 1), 0);

  const Loading = <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{sr ? "Analitika odsustva" : "Leave Analytics"}</h1>
        <Input type="number" className="w-24" value={year} onChange={e => setYear(+e.target.value)} />
      </div>

      {isLoading ? Loading : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card><CardContent className="pt-4 text-center">
              <div className="text-3xl font-bold text-primary">{requests.length}</div>
              <div className="text-sm text-muted-foreground">{sr ? "Ukupno zahteva" : "Total Requests"}</div>
            </CardContent></Card>
            <Card><CardContent className="pt-4 text-center">
              <div className="text-3xl font-bold text-primary">{totalApproved}</div>
              <div className="text-sm text-muted-foreground">{sr ? "Odobreno" : "Approved"}</div>
            </CardContent></Card>
            <Card><CardContent className="pt-4 text-center">
              <div className="text-3xl font-bold text-primary">{totalDays}</div>
              <div className="text-sm text-muted-foreground">{sr ? "Ukupno dana" : "Total Days Used"}</div>
            </CardContent></Card>
            <Card><CardContent className="pt-4 text-center">
              <div className="text-3xl font-bold text-primary">{requests.length > 0 ? (totalDays / Math.max(totalApproved, 1)).toFixed(1) : "0"}</div>
              <div className="text-sm text-muted-foreground">{sr ? "Prosek dana/zahtev" : "Avg Days/Request"}</div>
            </CardContent></Card>
          </div>

          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">{sr ? "Pregled" : "Overview"}</TabsTrigger>
              <TabsTrigger value="balances">{sr ? "Stanja" : "Balances"}</TabsTrigger>
              <TabsTrigger value="absenteeism">{sr ? "Izostanci" : "Absenteeism"}</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Monthly Trend */}
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">{sr ? "Mesečni trend" : "Monthly Trend"}</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="name" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip />
                        <Line type="monotone" dataKey="approved" stroke="hsl(var(--primary))" strokeWidth={2} name={sr ? "Odobreni dani" : "Approved Days"} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Type Breakdown Pie */}
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">{sr ? "Po tipu odsustva" : "By Leave Type"}</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie data={typeData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" label>
                          {typeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Department Usage */}
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">{sr ? "Po odeljenju" : "By Department"}</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={deptData.slice(0, 8)} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis type="number" className="text-xs" />
                        <YAxis dataKey="name" type="category" width={120} className="text-xs" />
                        <Tooltip />
                        <Bar dataKey="days" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name={sr ? "Dana" : "Days"} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Status Distribution */}
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">{sr ? "Status zahteva" : "Request Status"}</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie data={statusData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label>
                          {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="balances">
              <Suspense fallback={Loading}><LeaveBalanceSummaryTable year={year} /></Suspense>
            </TabsContent>

            <TabsContent value="absenteeism">
              <Suspense fallback={Loading}><AbsenteeismReport year={year} /></Suspense>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
