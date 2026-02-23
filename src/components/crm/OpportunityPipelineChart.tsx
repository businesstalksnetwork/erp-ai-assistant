import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { fmtNum } from "@/lib/utils";
import { useOpportunityStages } from "@/hooks/useOpportunityStages";

interface Props {
  opportunities: Array<{ stage: string; value: number }>;
}

export function OpportunityPipelineChart({ opportunities }: Props) {
  const { data: stages = [] } = useOpportunityStages();

  const data = stages.map((s) => ({
    stage: s.name_sr || s.name,
    value: opportunities.filter((o) => o.stage === s.code).reduce((sum, o) => sum + (o.value || 0), 0),
    color: s.color || "hsl(var(--muted-foreground))",
  }));

  const fmt = (n: number) => fmtNum(n);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pipeline</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} layout="vertical">
            <XAxis type="number" className="text-xs" tickFormatter={fmt} />
            <YAxis dataKey="stage" type="category" width={100} className="text-xs" />
            <Tooltip formatter={(v: number) => fmt(v)} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
