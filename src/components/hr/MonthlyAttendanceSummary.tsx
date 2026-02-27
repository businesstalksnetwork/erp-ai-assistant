import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/i18n/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { Loader2, TrendingUp, Clock, CalendarOff, Briefcase } from "lucide-react";

interface Props {
  employeeId?: string;
  month: number; // 1-12
  year: number;
}

export function MonthlyAttendanceSummary({ employeeId, month, year }: Props) {
  const { t } = useLanguage();
  const { tenantId } = useTenant();

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 0).toISOString().split("T")[0]; // last day of month

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["attendance-summary", tenantId, employeeId, month, year],
    queryFn: async () => {
      let q = supabase
        .from("attendance_records")
        .select("status, hours_worked, leave_request_id")
        .eq("tenant_id", tenantId!)
        .gte("date", startDate)
        .lte("date", endDate);
      if (employeeId) q = q.eq("employee_id", employeeId);
      const { data } = await q;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const summary = useMemo(() => {
    const s = { present: 0, absent: 0, sick: 0, vacation: 0, holiday: 0, remote: 0, totalHours: 0, leaveDays: 0 };
    records.forEach((r: any) => {
      s[r.status as keyof typeof s] = (s[r.status as keyof typeof s] as number || 0) + 1;
      s.totalHours += r.hours_worked || 0;
      if (r.leave_request_id) s.leaveDays++;
    });
    return s;
  }, [records]);

  const cards = [
    { label: t("present"), value: summary.present + summary.remote, icon: Briefcase, color: "text-green-600" },
    { label: t("sickLeave"), value: summary.sick, icon: CalendarOff, color: "text-red-600" },
    { label: t("vacation"), value: summary.vacation, icon: CalendarOff, color: "text-blue-600" },
    { label: t("hoursWorked"), value: `${summary.totalHours}h`, icon: Clock, color: "text-primary" },
  ];

  if (isLoading) return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="p-4 flex items-center gap-3">
            <c.icon className={`h-5 w-5 ${c.color}`} />
            <div>
              <p className="text-2xl font-bold">{c.value}</p>
              <p className="text-xs text-muted-foreground">{c.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
