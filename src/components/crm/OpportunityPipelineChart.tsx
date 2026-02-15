import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { fmtNum } from "@/lib/utils";

interface Props {
  opportunities: Array<{ stage: string; value: number }>;
}

const STAGE_COLORS: Record<string, string> = {
  qualification: "hsl(var(--primary))",
  proposal: "hsl(220, 60%, 65%)",
  negotiation: "hsl(var(--accent))",
  closed_won: "hsl(160, 70%, 40%)",
  closed_lost: "hsl(var(--destructive))",
};

export function OpportunityPipelineChart({ opportunities }: Props) {
  const { t } = useLanguage();

  const stages = ["qualification", "proposal", "negotiation", "closed_won", "closed_lost"];
  const data = stages.map((s) => ({
    stage: t(s as any) || s,
    value: opportunities.filter((o) => o.stage === s).reduce((sum, o) => sum + (o.value || 0), 0),
    color: STAGE_COLORS[s] || "hsl(var(--muted-foreground))",
  }));

  const fmt = (n: number) => fmtNum(n);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("pipeline") || "Pipeline"}</CardTitle>
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
