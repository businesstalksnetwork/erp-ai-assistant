import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { startOfMonth, endOfMonth, eachDayOfInterval, format, addMonths, subMonths, getDay } from "date-fns";

const typeColors: Record<string, string> = {
  workday: "bg-primary/20 text-primary", weekend: "bg-muted text-muted-foreground", holiday: "bg-amber-100 text-amber-800",
  vacation: "bg-blue-100 text-blue-800", sick_leave: "bg-red-100 text-red-800", paid_leave: "bg-green-100 text-green-800",
  unpaid_leave: "bg-gray-100 text-gray-800", maternity_leave: "bg-pink-100 text-pink-800",
  holiday_work: "bg-orange-100 text-orange-800", slava: "bg-purple-100 text-purple-800",
};

export default function WorkLogsCalendar() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedEmp, setSelectedEmp] = useState<string>("__all");

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-active", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("employees").select("id, full_name").eq("tenant_id", tenantId!).eq("status", "active").order("full_name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["work-logs-month", tenantId, format(monthStart, "yyyy-MM")],
    queryFn: async () => {
      let q = supabase.from("work_logs").select("*, employees(full_name)").eq("tenant_id", tenantId!).gte("date", format(monthStart, "yyyy-MM-dd")).lte("date", format(monthEnd, "yyyy-MM-dd"));
      const { data } = await q;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const filtered = selectedEmp === "__all" ? logs : logs.filter((l: any) => l.employee_id === selectedEmp);
  const logsByDate = new Map<string, any[]>();
  filtered.forEach((l: any) => {
    const key = l.date;
    if (!logsByDate.has(key)) logsByDate.set(key, []);
    logsByDate.get(key)!.push(l);
  });

  const startPadding = (getDay(monthStart) + 6) % 7; // Monday-based

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("workLogsCalendar")}</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="font-semibold min-w-[150px] text-center">{format(currentMonth, "MMMM yyyy")}</span>
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <Select value={selectedEmp} onValueChange={setSelectedEmp}>
        <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__all">{t("allTypes")}</SelectItem>
          {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
        </SelectContent>
      </Select>

      <Card>
        <CardContent className="p-4">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
                <div key={d} className="text-center text-xs font-semibold text-muted-foreground p-2">{d}</div>
              ))}
              {Array.from({ length: startPadding }).map((_, i) => <div key={`pad-${i}`} />)}
              {days.map(day => {
                const dateStr = format(day, "yyyy-MM-dd");
                const dayLogs = logsByDate.get(dateStr) || [];
                return (
                  <div key={dateStr} className="min-h-[80px] border rounded p-1">
                    <div className="text-xs font-medium mb-1">{format(day, "d")}</div>
                    {dayLogs.slice(0, 3).map((l: any) => (
                      <div key={l.id} className={`text-[10px] rounded px-1 py-0.5 mb-0.5 truncate ${typeColors[l.type] || "bg-muted"}`}>
                        {selectedEmp === "__all" ? l.employees?.full_name?.split(" ")[0] : ""} {t(l.type as any) || l.type}
                      </div>
                    ))}
                    {dayLogs.length > 3 && <div className="text-[10px] text-muted-foreground">+{dayLogs.length - 3}</div>}
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
