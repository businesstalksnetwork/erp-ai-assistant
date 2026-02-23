import { useMemo } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GanttChart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function ProductionGantt() {
  const { t, locale } = useLanguage();
  const { tenantId } = useTenant();
  const navigate = useNavigate();

  const { data: orders = [] } = useQuery({
    queryKey: ["production-gantt", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_orders")
        .select("*, products(name)")
        .eq("tenant_id", tenantId!)
        .not("status", "eq", "cancelled")
        .not("planned_start", "is", null)
        .order("planned_start");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { minDate, maxDate, totalDays } = useMemo(() => {
    if (orders.length === 0) {
      const now = new Date();
      const min = new Date(now.getFullYear(), now.getMonth(), 1);
      const max = new Date(now.getFullYear(), now.getMonth() + 2, 0);
      return { minDate: min, maxDate: max, totalDays: Math.ceil((max.getTime() - min.getTime()) / 86400000) };
    }
    const dates = orders.flatMap((o: any) => [
      new Date(o.planned_start),
      new Date(o.planned_end || o.planned_start),
    ]);
    const min = new Date(Math.min(...dates.map(d => d.getTime())));
    const max = new Date(Math.max(...dates.map(d => d.getTime())));
    // Add padding
    min.setDate(min.getDate() - 2);
    max.setDate(max.getDate() + 5);
    const totalDays = Math.max(Math.ceil((max.getTime() - min.getTime()) / 86400000), 14);
    return { minDate: min, maxDate: max, totalDays };
  }, [orders]);

  const getBarStyle = (order: any) => {
    const start = new Date(order.planned_start);
    const end = new Date(order.planned_end || order.planned_start);
    end.setDate(end.getDate() + 1); // Include end day
    const left = Math.max(0, (start.getTime() - minDate.getTime()) / 86400000 / totalDays * 100);
    const width = Math.max(2, (end.getTime() - start.getTime()) / 86400000 / totalDays * 100);
    return { left: `${left}%`, width: `${Math.min(width, 100 - left)}%` };
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "completed": return "bg-green-500";
      case "in_progress": return "bg-amber-500";
      case "planned": return "bg-blue-500";
      default: return "bg-muted-foreground";
    }
  };

  // Generate date markers
  const dateMarkers = useMemo(() => {
    const markers: { date: Date; label: string; pct: number }[] = [];
    const d = new Date(minDate);
    while (d <= maxDate) {
      const pct = (d.getTime() - minDate.getTime()) / 86400000 / totalDays * 100;
      if (d.getDate() === 1 || d.getDay() === 1) {
        markers.push({ date: new Date(d), label: d.toLocaleDateString(locale === "sr" ? "sr-Latn" : "en", { month: "short", day: "numeric" }), pct });
      }
      d.setDate(d.getDate() + 1);
    }
    return markers;
  }, [minDate, maxDate, totalDays, locale]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={locale === "sr" ? "Gantt dijagram" : "Production Gantt"}
        description={locale === "sr" ? "Vremenski pregled planiranih i aktivnih radnih naloga" : "Timeline view of planned and active production orders"}
        icon={GanttChart}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{locale === "sr" ? "Vremenski plan" : "Timeline"}</CardTitle>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">{locale === "sr" ? "Nema naloga sa planiranim datumima" : "No orders with planned dates"}</p>
          ) : (
            <div className="space-y-1">
              {/* Date axis */}
              <div className="relative h-8 border-b mb-2">
                {dateMarkers.map((m, i) => (
                  <span key={i} className="absolute text-[10px] text-muted-foreground -translate-x-1/2" style={{ left: `${m.pct}%` }}>
                    {m.label}
                  </span>
                ))}
              </div>

              {/* Order bars */}
              <TooltipProvider>
                {orders.map((order: any) => {
                  const style = getBarStyle(order);
                  return (
                    <div key={order.id} className="flex items-center gap-2 h-8 group">
                      <div className="w-36 min-w-[9rem] truncate text-xs font-medium pr-2 text-right">
                        {order.products?.name || order.order_number}
                      </div>
                      <div className="flex-1 relative h-6 bg-muted/30 rounded">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className={`absolute h-full rounded cursor-pointer ${statusColor(order.status)} opacity-80 hover:opacity-100 transition-opacity`}
                              style={style}
                              onClick={() => navigate(`/production/orders/${order.id}`)}
                            >
                              <span className="text-[10px] text-white px-1 truncate block leading-6">
                                {order.order_number}
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-xs space-y-1">
                              <p className="font-medium">{order.products?.name}</p>
                              <p>{order.planned_start} → {order.planned_end || "?"}</p>
                              <p>{t("quantity")}: {order.quantity} | {t("status")}: {t(order.status as any)}</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  );
                })}
              </TooltipProvider>

              {/* Legend */}
              <div className="flex gap-4 mt-4 pt-2 border-t">
                {[
                  { label: "Draft", color: "bg-muted-foreground" },
                  { label: "Planned", color: "bg-blue-500" },
                  { label: "In Progress", color: "bg-amber-500" },
                  { label: "Completed", color: "bg-green-500" },
                ].map(l => (
                  <div key={l.label} className="flex items-center gap-1 text-xs text-muted-foreground">
                    <div className={`h-3 w-3 rounded ${l.color}`} />
                    {l.label}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
