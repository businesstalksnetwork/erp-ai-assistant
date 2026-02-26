import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";

interface Props {
  employeeId: string;
}

export function ProfileAttendanceCard({ employeeId }: Props) {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const now = new Date();
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");

  const { data: records = [] } = useQuery({
    queryKey: ["profile-attendance", employeeId, monthStart],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance_records")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("employee_id", employeeId)
        .gte("date", monthStart)
        .lte("date", monthEnd)
        .order("date");
      return data || [];
    },
    enabled: !!tenantId && !!employeeId,
  });

  const totalHours = records.reduce((sum: number, r: any) => sum + (r.hours_worked || 0), 0);
  const presentDays = records.filter((r: any) => r.status === "present" || r.status === "remote").length;
  const absentDays = records.filter((r: any) => r.status === "absent" || r.status === "sick" || r.status === "vacation").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          {t("profileAttendanceSummary" as any)} — {format(now, "MMMM yyyy")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold">{presentDays}</p>
            <p className="text-xs text-muted-foreground">{t("profilePresentDays" as any)}</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{absentDays}</p>
            <p className="text-xs text-muted-foreground">{t("profileAbsentDays" as any)}</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{totalHours.toFixed(1)}h</p>
            <p className="text-xs text-muted-foreground">{t("profileTotalHours" as any)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
