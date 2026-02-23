import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface Props {
  leads: Array<{ status: string }>;
}

const FUNNEL_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(220, 60%, 65%)",
  "hsl(160, 50%, 55%)",
  "hsl(var(--destructive))",
];

export function LeadFunnelChart({ leads }: Props) {
  const { t } = useLanguage();

  const stages = ["new", "contacted", "qualified", "converted", "lost"];
  const data = stages.map((s, i) => ({
    stage: t(s as any) || s,
    count: leads.filter((l) => l.status === s).length,
    fill: FUNNEL_COLORS[i],
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("leadFunnel") || "Lead Funnel"}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data}>
            <XAxis dataKey="stage" className="text-xs" />
            <YAxis className="text-xs" />
            <Tooltip />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
