import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface Props {
  opportunities: Array<{ stage: string }>;
}

export function WinLossChart({ opportunities }: Props) {
  const { t } = useLanguage();

  const won = opportunities.filter((o) => o.stage === "closed_won").length;
  const lost = opportunities.filter((o) => o.stage === "closed_lost").length;

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
              <Cell fill="hsl(var(--accent))" />
              <Cell fill="hsl(var(--destructive))" />
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
