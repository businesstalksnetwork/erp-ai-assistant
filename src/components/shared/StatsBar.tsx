import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { MiniSparkline } from "@/components/shared/MiniSparkline";
import type { LucideIcon } from "lucide-react";

export interface StatItem {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: number; // percentage change, positive = up
  color?: string; // tailwind text color class using semantic tokens
  sparklineData?: number[]; // last N data points for mini sparkline
}

interface StatsBarProps {
  stats: StatItem[];
}

function trendBorderColor(trend?: number): string {
  if (trend === undefined || trend === 0) return "border-l-muted-foreground/20";
  return trend > 0 ? "border-l-accent" : "border-l-destructive";
}

export function StatsBar({ stats }: StatsBarProps) {
  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card
          key={stat.label}
          className={`overflow-hidden border-l-[3px] ${trendBorderColor(stat.trend)} transition-shadow hover:shadow-md`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">
                {stat.label}
              </p>
              <stat.icon className={`h-4 w-4 shrink-0 ${stat.color || "text-muted-foreground"}`} />
            </div>
            <div className="mt-2 flex items-end justify-between gap-2">
              <div className="flex items-end gap-2 min-w-0">
                <span className="text-2xl font-bold tracking-tight">{stat.value}</span>
                {stat.trend !== undefined && stat.trend !== 0 && (
                  <span className={`flex items-center text-xs font-medium pb-0.5 ${stat.trend > 0 ? "text-accent" : "text-destructive"}`}>
                    {stat.trend > 0 ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
                    {Math.abs(stat.trend).toFixed(0)}%
                  </span>
                )}
              </div>
              {stat.sparklineData && stat.sparklineData.length >= 2 && (
                <MiniSparkline
                  data={stat.sparklineData}
                  width={56}
                  height={22}
                  color={
                    stat.trend !== undefined && stat.trend !== 0
                      ? stat.trend > 0
                        ? "hsl(var(--accent))"
                        : "hsl(var(--destructive))"
                      : "hsl(var(--primary))"
                  }
                  className="shrink-0 opacity-80"
                />
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
