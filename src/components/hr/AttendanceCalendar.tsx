import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import {
  startOfMonth, endOfMonth, eachDayOfInterval, format, isWeekend,
} from "date-fns";

interface Props {
  employeeId: string;
}

const statusColors: Record<string, string> = {
  present: "bg-green-500",
  remote: "bg-teal-500",
  absent: "bg-red-500",
  sick: "bg-orange-500",
  vacation: "bg-blue-500",
  holiday: "bg-purple-500",
};

const statusLabels: Record<string, string> = {
  present: "Prisutan",
  remote: "Rad od kuće",
  absent: "Odsutan",
  sick: "Bolovanje",
  vacation: "Godišnji",
  holiday: "Praznik",
};

const dayNamesSr = ["Ned", "Pon", "Uto", "Sre", "Čet", "Pet", "Sub"];

export function AttendanceCalendar({ employeeId }: Props) {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const startDate = format(monthStart, "yyyy-MM-dd");
  const endDate = format(monthEnd, "yyyy-MM-dd");

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["attendance-calendar", tenantId, employeeId, startDate],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance_records")
        .select("date, status, hours_worked, leave_request_id, notes")
        .eq("tenant_id", tenantId!)
        .eq("employee_id", employeeId)
        .gte("date", startDate)
        .lte("date", endDate);
      return data || [];
    },
    enabled: !!tenantId && !!employeeId,
  });

  const recordMap = useMemo(() => {
    const m = new Map<string, any>();
    records.forEach((r: any) => m.set(r.date, r));
    return m;
  }, [records]);

  // Pad start of month to align with day-of-week grid (Monday start)
  const firstDayOfWeek = (monthStart.getDay() + 6) % 7; // 0=Mon

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{t("attendance")}</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-7 w-7"
              onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[120px] text-center">
              {format(currentMonth, "LLLL yyyy")}
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7"
              onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {/* Legend */}
        <div className="flex flex-wrap gap-2 mt-2">
          {Object.entries(statusLabels).map(([key, label]) => (
            <div key={key} className="flex items-center gap-1 text-xs">
              <div className={`h-3 w-3 rounded-sm ${statusColors[key]}`} />
              <span className="text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {["Pon", "Uto", "Sre", "Čet", "Pet", "Sub", "Ned"].map((d) => (
                <div key={d} className="text-center text-xs font-medium text-muted-foreground">{d}</div>
              ))}
            </div>
            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {/* Empty cells for padding */}
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`pad-${i}`} className="h-10" />
              ))}
              {days.map((day) => {
                const dateStr = format(day, "yyyy-MM-dd");
                const record = recordMap.get(dateStr);
                const weekend = isWeekend(day);
                return (
                  <div
                    key={dateStr}
                    className={`h-10 rounded-md flex flex-col items-center justify-center text-xs relative
                      ${weekend ? "bg-muted/40" : "bg-muted/10"}
                      ${record ? "ring-1 ring-inset ring-border" : ""}
                    `}
                    title={record ? `${statusLabels[record.status] || record.status}${record.notes ? ` — ${record.notes}` : ""}` : ""}
                  >
                    <span className={`text-[10px] ${weekend ? "text-muted-foreground" : ""}`}>{day.getDate()}</span>
                    {record && (
                      <div className={`h-2 w-2 rounded-full mt-0.5 ${statusColors[record.status] || "bg-muted-foreground"}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
