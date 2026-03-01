import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar, DollarSign, Clock, FileText } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function EmployeeDashboard() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const navigate = useNavigate();
  const now = new Date();
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");

  const { data: employee, isLoading } = useQuery({
    queryKey: ["my-employee", user?.id, tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("employees")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!tenantId && !!user,
  });

  const { data: leaveBalance } = useQuery({
    queryKey: ["my-leave-balance", employee?.id, now.getFullYear()],
    queryFn: async () => {
      const { data } = await supabase
        .from("annual_leave_balances")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("employee_id", employee!.id)
        .eq("year", now.getFullYear())
        .maybeSingle();
      return data;
    },
    enabled: !!employee?.id && !!tenantId,
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ["my-attendance-summary", employee?.id, monthStart],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance_records")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("employee_id", employee!.id)
        .gte("date", monthStart)
        .lte("date", monthEnd);
      return data || [];
    },
    enabled: !!employee?.id && !!tenantId,
  });

  const { data: pendingLeaves = [] } = useQuery({
    queryKey: ["my-pending-leaves", employee?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("leave_requests")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("employee_id", employee!.id)
        .eq("status", "pending")
        .order("start_date")
        .limit(5);
      return data || [];
    },
    enabled: !!employee?.id && !!tenantId,
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  if (!employee) return (
    <div className="text-center py-12 space-y-4">
      <p className="text-muted-foreground">Vaš nalog nije povezan sa profilom zaposlenog.</p>
      <p className="text-sm text-muted-foreground">Obratite se administratoru.</p>
    </div>
  );

  const totalHours = attendance.reduce((sum: number, r: any) => sum + (r.hours_worked || 0), 0);
  const presentDays = attendance.filter((r: any) => r.status === "present" || r.status === "remote").length;
  const remaining = leaveBalance ? (leaveBalance.entitled_days + leaveBalance.carried_over_days - leaveBalance.used_days - leaveBalance.pending_days) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Moj dashboard</h1>
        <p className="text-muted-foreground">{employee.first_name} {employee.last_name} — {employee.position || "—"}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/hr/my-leaves")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Preostali odmor</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{remaining ?? "—"}</div>
            <p className="text-xs text-muted-foreground">dana u {now.getFullYear()}</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/hr/my-attendance")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Prisutnost ovog meseca</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{presentDays}</div>
            <p className="text-xs text-muted-foreground">{totalHours.toFixed(1)}h ukupno</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/hr/my-payslips")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Platni listići</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <FileText className="h-5 w-5 inline mr-1" />Pregled
            </div>
            <p className="text-xs text-muted-foreground">Pogledajte vaše obračune</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Zahtevi na čekanju</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingLeaves.length}</div>
            <p className="text-xs text-muted-foreground">otvorenih zahteva za odmor</p>
          </CardContent>
        </Card>
      </div>

      {pendingLeaves.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Zahtevi na čekanju</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingLeaves.map((lr: any) => (
                <div key={lr.id} className="flex justify-between items-center border-b border-border/40 pb-2">
                  <div>
                    <span className="font-medium">{lr.leave_type}</span>
                    <span className="text-sm text-muted-foreground ml-2">
                      {format(new Date(lr.start_date), "dd.MM.yyyy")} — {format(new Date(lr.end_date), "dd.MM.yyyy")}
                    </span>
                  </div>
                  <Badge variant="outline">Na čekanju</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
