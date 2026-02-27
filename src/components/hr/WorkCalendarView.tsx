import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const DAY_LABELS: Record<string, Record<string, string>> = {
  en: { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" },
  sr: { mon: "Pon", tue: "Uto", wed: "Sre", thu: "Čet", fri: "Pet", sat: "Sub", sun: "Ned" },
};

const DEFAULT_CONFIG = { mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false };

export default function WorkCalendarView({ year }: { year: number }) {
  const { t, locale: language } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const labels = DAY_LABELS[language] || DAY_LABELS.en;

  const { data: calendar, isLoading } = useQuery({
    queryKey: ["work-calendar", tenantId, year],
    queryFn: async () => {
      const { data } = await supabase
        .from("work_calendars")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("year", year)
        .maybeSingle();
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: holidays = [] } = useQuery({
    queryKey: ["holidays-year", tenantId, year],
    queryFn: async () => {
      const { data } = await supabase
        .from("holidays")
        .select("*")
        .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
        .gte("date", `${year}-01-01`)
        .lte("date", `${year}-12-31`)
        .order("date");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const config = (calendar?.working_days_config as Record<string, boolean>) || DEFAULT_CONFIG;
  const [editConfig, setEditConfig] = useState<Record<string, boolean> | null>(null);
  const activeConfig = editConfig || config;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const cfg = editConfig || config;
      // Calculate total working days for the year excluding holidays
      const { error } = await supabase.from("work_calendars").upsert(
        { tenant_id: tenantId!, year, working_days_config: cfg as any, generated_at: new Date().toISOString() },
        { onConflict: "tenant_id,year" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-calendar"] });
      setEditConfig(null);
      toast.success(t("success"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Calculate working days per month
  const monthStats = Array.from({ length: 12 }, (_, m) => {
    const monthStart = new Date(year, m, 1);
    const monthEnd = new Date(year, m + 1, 0);
    let workDays = 0;
    let holidayDays = 0;
    const holidayDates = new Set(holidays.map((h: any) => h.date));

    for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay();
      const dayKey = DAYS[dow === 0 ? 6 : dow - 1];
      const dateStr = d.toISOString().split("T")[0];
      if (activeConfig[dayKey]) {
        if (holidayDates.has(dateStr)) {
          holidayDays++;
        } else {
          workDays++;
        }
      }
    }
    return { workDays, holidayDays, total: workDays + holidayDays };
  });

  const monthNames = language === "sr"
    ? ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Avg", "Sep", "Okt", "Nov", "Dec"]
    : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const totalWorkDays = monthStats.reduce((s, m) => s + m.workDays, 0);
  const totalHolidays = monthStats.reduce((s, m) => s + m.holidayDays, 0);

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center justify-between">
            {language === "sr" ? "Radni dani u nedelji" : "Working Days Configuration"}
            <div className="flex gap-2">
              {editConfig && (
                <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-1" />{t("save")}</>}
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {DAYS.map((day) => (
              <div key={day} className="flex items-center gap-2">
                <Switch
                  checked={activeConfig[day] ?? false}
                  onCheckedChange={(checked) => setEditConfig({ ...activeConfig, [day]: checked })}
                />
                <Label className="text-sm font-medium">{labels[day]}</Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-3">
            {language === "sr" ? `Radni kalendar ${year}` : `Work Calendar ${year}`}
            <Badge variant="outline">{totalWorkDays} {language === "sr" ? "radnih dana" : "work days"}</Badge>
            <Badge variant="secondary">{totalHolidays} {language === "sr" ? "praznika" : "holidays"}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {monthStats.map((stat, i) => (
              <div key={i} className="rounded-lg border p-3 text-center space-y-1">
                <div className="font-semibold text-sm">{monthNames[i]}</div>
                <div className="text-2xl font-bold text-primary">{stat.workDays}</div>
                <div className="text-xs text-muted-foreground">
                  {stat.holidayDays > 0 && <span className="text-destructive">{stat.holidayDays} {language === "sr" ? "praz." : "hol."}</span>}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {holidays.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{language === "sr" ? "Praznici u ovoj godini" : "Holidays This Year"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {holidays.map((h: any) => (
                <div key={h.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <span className="text-sm font-medium">{language === "sr" && h.name_sr ? h.name_sr : h.name}</span>
                  <Badge variant={h.tenant_id ? "secondary" : "default"} className="text-xs">
                    {h.date}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
