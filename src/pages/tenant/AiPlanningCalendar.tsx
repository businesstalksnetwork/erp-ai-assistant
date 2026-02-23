import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { startOfMonth, endOfMonth, eachDayOfInterval, format, isSameDay, isToday, parseISO, getDay, addMonths, subMonths } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted-foreground/40",
  in_progress: "bg-primary",
  completed: "bg-accent",
  cancelled: "bg-destructive/40",
};

const DAILY_CAPACITY = 5; // configurable

export default function AiPlanningCalendar() {
  const { t, locale } = useLanguage();
  const { tenantId } = useTenant();
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState("all");

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad start to align with week grid (Monday start)
  const startDay = getDay(monthStart);
  const padStart = startDay === 0 ? 6 : startDay - 1;

  const { data: orders = [] } = useQuery({
    queryKey: ["production-calendar-orders", tenantId, format(monthStart, "yyyy-MM")],
    queryFn: async () => {
      const { data, error } = await supabase.from("production_orders")
        .select("id, order_number, status, planned_start, planned_end, product_id, products(name), bom_template_id, bom_templates(name)")
        .eq("tenant_id", tenantId!)
        .gte("planned_start", monthStart.toISOString())
        .lte("planned_start", monthEnd.toISOString())
        .order("planned_start");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const filteredOrders = statusFilter === "all" ? orders : orders.filter((o: any) => o.status === statusFilter);

  const getOrdersForDay = (day: Date) => filteredOrders.filter((o: any) => o.planned_start && isSameDay(parseISO(o.planned_start), day));

  const weekDays = locale === "sr"
    ? ["Pon", "Uto", "Sre", "Čet", "Pet", "Sub", "Ned"]
    : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="space-y-6">
      <PageHeader title={t("productionCalendar")} icon={CalendarDays} />

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-lg font-semibold min-w-[160px] text-center">{format(currentMonth, "MMMM yyyy")}</h3>
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">{t("status")}:</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px] h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("all")}</SelectItem>
              <SelectItem value="draft">{t("draft")}</SelectItem>
              <SelectItem value="in_progress">{t("in_progress")}</SelectItem>
              <SelectItem value="completed">{t("completed")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-3 ml-auto text-xs">
          {Object.entries(STATUS_COLORS).filter(([k]) => k !== "cancelled").map(([status, cls]) => (
            <div key={status} className="flex items-center gap-1">
              <span className={`h-2.5 w-2.5 rounded-full ${cls}`} />
              <span className="capitalize">{t(status as any)}</span>
            </div>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-2">
          {/* Week header */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {weekDays.map(d => (
              <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground uppercase py-1">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Padding cells */}
            {Array.from({ length: padStart }).map((_, i) => <div key={`pad-${i}`} className="min-h-[100px]" />)}

            {days.map(day => {
              const dayOrders = getOrdersForDay(day);
              const capacityUsed = Math.min((dayOrders.length / DAILY_CAPACITY) * 100, 100);

              return (
                <div key={day.toISOString()}
                  className={`min-h-[100px] border rounded-md p-1 transition-colors ${isToday(day) ? "border-primary ring-1 ring-primary/20" : "border-border"}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-medium ${isToday(day) ? "text-primary" : "text-foreground"}`}>{format(day, "d")}</span>
                    {dayOrders.length > 0 && (
                      <Progress value={capacityUsed} className="w-10 h-1.5" />
                    )}
                  </div>
                  <div className="space-y-0.5">
                    {dayOrders.slice(0, 3).map((order: any) => (
                      <button key={order.id}
                        onClick={() => navigate(`/production/orders/${order.id}`)}
                        className={`w-full text-left text-[9px] px-1 py-0.5 rounded truncate text-primary-foreground ${STATUS_COLORS[order.status] || "bg-muted"}`}
                        title={`${order.order_number} — ${order.products?.name}`}>
                        {order.order_number}
                      </button>
                    ))}
                    {dayOrders.length > 3 && (
                      <span className="text-[9px] text-muted-foreground pl-1">+{dayOrders.length - 3}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
