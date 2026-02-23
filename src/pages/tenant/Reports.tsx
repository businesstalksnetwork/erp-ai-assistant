import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { FileText, Scale, TrendingUp, PieChart } from "lucide-react";

const reports = [
  { key: "trialBalance" as const, url: "/accounting/reports/trial-balance", icon: FileText },
  { key: "incomeStatement" as const, url: "/accounting/reports/income-statement", icon: TrendingUp },
  { key: "balanceSheet" as const, url: "/accounting/reports/balance-sheet", icon: Scale },
  { key: "agingReports" as const, url: "/accounting/reports/aging", icon: PieChart },
];

export default function Reports() {
  const { t } = useLanguage();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("reports")}</h1>
      <div className="grid gap-4 md:grid-cols-3">
        {reports.map((r) => (
          <Link key={r.key} to={r.url}>
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
              <CardHeader className="flex flex-row items-center gap-3">
                <r.icon className="h-6 w-6 text-primary" />
                <CardTitle className="text-lg">{t(r.key)}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{t(r.key)}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
