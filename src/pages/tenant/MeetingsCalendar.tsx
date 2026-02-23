import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { useState } from "react";
import { startOfMonth, endOfMonth, eachDayOfInterval, format, addMonths, subMonths, getDay } from "date-fns";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";

const statusColors: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-800",
  in_progress: "bg-amber-100 text-amber-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export default function MeetingsCalendar() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ["meetings-calendar", tenantId, format(monthStart, "yyyy-MM")],
    queryFn: async () => {
      const { data } = await supabase
        .from("meetings")
        .select("id, title, scheduled_at, status, communication_channel, duration_minutes")
        .eq("tenant_id", tenantId!)
        .gte("scheduled_at", format(monthStart, "yyyy-MM-dd"))
        .lte("scheduled_at", format(monthEnd, "yyyy-MM-dd'T'23:59:59"))
        .order("scheduled_at");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const meetingsByDate = new Map<string, any[]>();
  meetings.forEach((m: any) => {
    const key = format(new Date(m.scheduled_at), "yyyy-MM-dd");
    if (!meetingsByDate.has(key)) meetingsByDate.set(key, []);
    meetingsByDate.get(key)!.push(m);
  });

  const startPadding = (getDay(monthStart) + 6) % 7;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("meetingsCalendar")}
        icon={CalendarDays}
        actions={
          <Button variant="outline" onClick={() => navigate("/crm/meetings")}>
            ← {t("meetings")}
          </Button>
        }
      />

      <div className="flex items-center justify-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="font-semibold min-w-[180px] text-center text-lg">
          {format(currentMonth, "MMMM yyyy")}
        </span>
        <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {["Pon", "Uto", "Sre", "Čet", "Pet", "Sub", "Ned"].map(d => (
                <div key={d} className="text-center text-xs font-semibold text-muted-foreground p-2">{d}</div>
              ))}
              {Array.from({ length: startPadding }).map((_, i) => <div key={`pad-${i}`} />)}
              {days.map(day => {
                const dateStr = format(day, "yyyy-MM-dd");
                const dayMeetings = meetingsByDate.get(dateStr) || [];
                const isToday = format(new Date(), "yyyy-MM-dd") === dateStr;
                return (
                  <div
                    key={dateStr}
                    className={`min-h-[90px] border rounded p-1 ${isToday ? "border-primary bg-primary/5" : ""}`}
                  >
                    <div className={`text-xs font-medium mb-1 ${isToday ? "text-primary font-bold" : ""}`}>
                      {format(day, "d")}
                    </div>
                    {dayMeetings.slice(0, 3).map((m: any) => (
                      <div
                        key={m.id}
                        className={`text-[10px] rounded px-1 py-0.5 mb-0.5 truncate cursor-default ${statusColors[m.status] || "bg-muted"}`}
                        title={`${m.title} (${format(new Date(m.scheduled_at), "HH:mm")})`}
                      >
                        {format(new Date(m.scheduled_at), "HH:mm")} {m.title}
                      </div>
                    ))}
                    {dayMeetings.length > 3 && (
                      <div className="text-[10px] text-muted-foreground">+{dayMeetings.length - 3}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
