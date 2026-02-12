import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface StatItem {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: number; // percentage change, positive = up
  color?: string; // tailwind text color class using semantic tokens
}

interface StatsBarProps {
  stats: StatItem[];
}

export function StatsBar({ stats }: StatsBarProps) {
  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{stat.label}</p>
              <stat.icon className={`h-4 w-4 ${stat.color || "text-muted-foreground"}`} />
            </div>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-2xl font-bold">{stat.value}</span>
              {stat.trend !== undefined && stat.trend !== 0 && (
                <span className={`flex items-center text-xs font-medium ${stat.trend > 0 ? "text-accent" : "text-destructive"}`}>
                  {stat.trend > 0 ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
                  {Math.abs(stat.trend).toFixed(0)}%
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
