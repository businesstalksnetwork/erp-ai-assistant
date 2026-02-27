import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { PivotQueryResult } from "@/hooks/usePivotQuery";
import type { MeasureConfig } from "@/hooks/usePivotConfig";
import { Button } from "@/components/ui/button";
import { BarChart3, LineChart as LineIcon, PieChart as PieIcon, Table2 } from "lucide-react";

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--destructive))", "#8884d8", "#82ca9d", "#ffc658"];

interface Props {
  data: PivotQueryResult | undefined;
  measures: MeasureConfig[];
  chartType: "bar" | "line" | "pie" | null;
  onChartTypeChange: (t: "bar" | "line" | "pie" | null) => void;
}

export function PivotChart({ data, measures, chartType, onChartTypeChange }: Props) {
  if (!data || data.rows.length === 0) return null;

  const dim = data.dimensions[0];
  const measureAlias = measures[0]?.alias;
  if (!dim || !measureAlias) return null;

  const chartData = data.rows.slice(0, 20).map((r) => ({
    name: String(r[dim] ?? ""),
    [measureAlias]: Number(r[measureAlias] || 0),
  }));

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {[
          { type: null, icon: Table2, label: "Tabela" },
          { type: "bar" as const, icon: BarChart3, label: "Bar" },
          { type: "line" as const, icon: LineIcon, label: "Linija" },
          { type: "pie" as const, icon: PieIcon, label: "Pita" },
        ].map(({ type, icon: Icon, label }) => (
          <Button
            key={label}
            variant={chartType === type ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => onChartTypeChange(type)}
          >
            <Icon className="h-3 w-3 mr-1" />{label}
          </Button>
        ))}
      </div>

      {chartType && (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === "bar" ? (
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey={measureAlias} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : chartType === "line" ? (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey={measureAlias} stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            ) : (
              <PieChart>
                <Pie data={chartData} dataKey={measureAlias} nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
