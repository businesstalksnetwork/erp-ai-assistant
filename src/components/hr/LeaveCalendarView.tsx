import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/i18n/LanguageContext";
import { addDays, format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isWeekend, isSameDay, parseISO } from "date-fns";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  requests: any[];
}

const leaveColors: Record<string, string> = {
  vacation: "bg-blue-500/20 text-blue-700 dark:text-blue-300",
  sick: "bg-red-500/20 text-red-700 dark:text-red-300",
  personal: "bg-purple-500/20 text-purple-700 dark:text-purple-300",
  maternity: "bg-pink-500/20 text-pink-700 dark:text-pink-300",
  paternity: "bg-teal-500/20 text-teal-700 dark:text-teal-300",
  unpaid: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
};

const leaveLabels: Record<string, string> = {
  vacation: "Godišnji",
  sick: "Bolovanje",
  personal: "Lično",
  maternity: "Porodiljsko",
  paternity: "Očinsko",
  unpaid: "Neplaćeno",
};

export function LeaveCalendarView({ requests }: Props) {
  const { t } = useLanguage();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Only show approved and pending requests
  const activeRequests = useMemo(() =>
    requests.filter((r: any) => r.status === "approved" || r.status === "pending"),
    [requests]
  );

  // Group requests by employee
  const employeeRequests = useMemo(() => {
    const map = new Map<string, { name: string; requests: any[] }>();
    activeRequests.forEach((r: any) => {
      const empId = r.employee_id;
      const name = r.employees?.full_name || "—";
      if (!map.has(empId)) map.set(empId, { name, requests: [] });
      map.get(empId)!.requests.push(r);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [activeRequests]);

  const isDateInRange = (date: Date, start: string, end: string) => {
    const d = format(date, "yyyy-MM-dd");
    return d >= start && d <= end;
  };

  const dayNames = ["Pon", "Uto", "Sre", "Čet", "Pet", "Sub", "Ned"];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{t("calendar" as any) || "Kalendar odsustva"}</CardTitle>
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
          {Object.entries(leaveLabels).map(([key, label]) => (
            <Badge key={key} variant="outline" className={`${leaveColors[key]} border-0 text-xs`}>
              {label}
            </Badge>
          ))}
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <div className="min-w-[700px]">
          {/* Day headers */}
          <div className="grid gap-px" style={{ gridTemplateColumns: `180px repeat(${daysInMonth.length}, minmax(24px, 1fr))` }}>
            <div className="text-xs font-medium text-muted-foreground p-1">{t("employee")}</div>
            {daysInMonth.map((day) => (
              <div key={day.toISOString()} className={`text-[10px] text-center p-0.5 ${isWeekend(day) ? "bg-muted/50" : ""}`}>
                <div>{day.getDate()}</div>
              </div>
            ))}
          </div>

          {/* Employee rows */}
          {employeeRequests.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 text-sm">
              {t("noResults")}
            </div>
          ) : employeeRequests.map(([empId, { name, requests: empReqs }]) => (
            <div key={empId} className="grid gap-px border-t border-border"
              style={{ gridTemplateColumns: `180px repeat(${daysInMonth.length}, minmax(24px, 1fr))` }}>
              <div className="text-xs font-medium p-1 truncate" title={name}>{name}</div>
              {daysInMonth.map((day) => {
                const matchingReq = empReqs.find((r: any) => isDateInRange(day, r.start_date, r.end_date));
                const weekend = isWeekend(day);
                return (
                  <div key={day.toISOString()} className={`h-6 ${weekend ? "bg-muted/30" : ""}`}
                    title={matchingReq ? `${leaveLabels[matchingReq.leave_type] || matchingReq.leave_type} (${matchingReq.status})` : ""}>
                    {matchingReq && (
                      <div className={`h-full rounded-sm ${leaveColors[matchingReq.leave_type] || "bg-muted"} ${matchingReq.status === "pending" ? "opacity-60 border border-dashed border-current" : ""}`} />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
