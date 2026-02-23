import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useOpportunityStages } from "@/hooks/useOpportunityStages";

interface Props {
  opportunities: Array<{ stage: string }>;
}

export function WinLossChart({ opportunities }: Props) {
  const { t } = useLanguage();
  const { data: stages = [] } = useOpportunityStages();

  const wonStages = stages.filter(s => s.is_won).map(s => s.code);
  const lostStages = stages.filter(s => s.is_lost).map(s => s.code);
  const wonColor = stages.find(s => s.is_won)?.color || "hsl(var(--accent))";
  const lostColor = stages.find(s => s.is_lost)?.color || "hsl(var(--destructive))";

  const won = opportunities.filter((o) => wonStages.includes(o.stage)).length;
  const lost = opportunities.filter((o) => lostStages.includes(o.stage)).length;

  const data = [
    { name: t("closed_won"), value: won },
    { name: t("closed_lost"), value: lost },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">{t("winLoss") || "Win / Loss"}</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground text-center py-8">{t("noResults")}</p></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("winLoss") || "Win / Loss"}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
              <Cell fill={wonColor} />
              <Cell fill={lostColor} />
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
