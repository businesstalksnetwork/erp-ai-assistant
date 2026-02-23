import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { MiniSparkline } from "@/components/shared/MiniSparkline";
import type { LucideIcon } from "lucide-react";

export interface StatItem {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: number;
  color?: string;
  sparklineData?: number[];
}

interface StatsBarProps {
  stats: StatItem[];
}

function trendTopColor(trend?: number): string {
  if (trend === undefined || trend === 0) return "border-t-muted-foreground/20";
  return trend > 0 ? "border-t-accent" : "border-t-destructive";
}

export function StatsBar({ stats }: StatsBarProps) {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <Card
          key={stat.label}
          className={`overflow-hidden border-t-[3px] ${trendTopColor(stat.trend)} transition-all hover:shadow-lg hover:-translate-y-1 border-border/60`}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">
                {stat.label}
              </p>
              <stat.icon className={`h-4 w-4 shrink-0 ${stat.color || "text-muted-foreground"}`} />
            </div>
            <div className="mt-2 flex items-end justify-between gap-2">
              <div className="flex items-end gap-2 min-w-0">
                <span className="text-2xl font-bold tracking-tight tabular-nums">{stat.value}</span>
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
