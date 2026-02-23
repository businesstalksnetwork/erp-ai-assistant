import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { addDays, differenceInDays, format, getDate, getMonth, getYear, setDate } from "date-fns";
import { useLanguage } from "@/i18n/LanguageContext";

interface Props {
  tenantId: string;
}

interface Deadline {
  label: string;
  dueDate: Date;
  status: "ok" | "warning" | "overdue" | "done";
  detail?: string;
}

export function ComplianceDeadlineWidget({ tenantId }: Props) {
  const { t } = useLanguage();
  const today = new Date();
  const currentMonth = getMonth(today) + 1;
  const currentYear = getYear(today);

  // Load PDV periods
  const { data: pdvPeriods } = useQuery({
    queryKey: ["compliance-pdv-periods", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("pdv_periods")
        .select("period_name, status, end_date")
        .eq("tenant_id", tenantId)
        .order("end_date", { ascending: false })
        .limit(3);
      return data || [];
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 10,
  });

  // Build regulatory deadlines
  const deadlines: Deadline[] = [];

  // PDV deadline: 15th of next month after period end
  const pdvDeadline = setDate(
    new Date(currentYear, currentMonth, 1), // next month
    15
  );
  const openPdv = pdvPeriods?.find((p) => p.status === "open" || p.status === "draft");
  deadlines.push({
    label: t("pdvDeadlineLabel"),
    dueDate: pdvDeadline,
    status: openPdv
      ? differenceInDays(pdvDeadline, today) <= 3
        ? "overdue"
        : differenceInDays(pdvDeadline, today) <= 7
        ? "warning"
        : "ok"
      : "done",
    detail: openPdv
      ? `Period ${openPdv.period_name} — ${t("deadlineLate").toLowerCase()}`
      : t("allPdvSubmitted"),
  });

  // SEF evidencija: 12th of month
  const sefDeadline = setDate(today, 12);
  const sefDue = getDate(today) <= 12 ? sefDeadline : setDate(addDays(today, 30), 12);
  deadlines.push({
    label: t("sefDeadlineLabel"),
    dueDate: sefDue,
    status: differenceInDays(sefDue, today) <= 2 ? "warning" : "ok",
    detail: t("sefDeadlineDetail"),
  });

  // PPP-PD: payroll tax filing by end of payment month
  const pppDeadline = setDate(new Date(currentYear, currentMonth, 0), 15);
  deadlines.push({
    label: t("pppDeadlineLabel"),
    dueDate: pppDeadline,
    status: differenceInDays(pppDeadline, today) <= 3
      ? "warning"
      : differenceInDays(pppDeadline, today) < 0
      ? "overdue"
      : "ok",
    detail: t("pppDeadlineDetail"),
  });

  // PIO/ZZO contributions
  const contribDeadline = setDate(new Date(currentYear, currentMonth, 0), 15);
  deadlines.push({
    label: t("pioContribLabel"),
    dueDate: contribDeadline,
    status: differenceInDays(contribDeadline, today) <= 3 ? "warning" : "ok",
    detail: t("contribDeadlineDetail"),
  });

  const getStatusIcon = (status: Deadline["status"]) => {
    if (status === "done") return <CheckCircle className="h-4 w-4 text-primary" />;
    if (status === "overdue") return <AlertTriangle className="h-4 w-4 text-destructive" />;
    if (status === "warning") return <AlertTriangle className="h-4 w-4 text-accent" />;
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  const getStatusBadge = (status: Deadline["status"], daysLeft: number) => {
    if (status === "done") return <Badge variant="default" className="text-xs">{t("deadlineSubmitted")}</Badge>;
    if (status === "overdue") return <Badge variant="destructive" className="text-xs">{t("deadlineLate")}</Badge>;
    if (status === "warning") return <Badge variant="secondary" className="text-xs">{daysLeft}d</Badge>;
    return <Badge variant="outline" className="text-xs">{daysLeft}d</Badge>;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t("complianceDeadlinesTitle")}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("complianceDeadlinesSubtitle")}</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {deadlines.map((d) => {
            const daysLeft = differenceInDays(d.dueDate, today);
            return (
              <div key={d.label} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  {getStatusIcon(d.status)}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{d.label}</p>
                    {d.detail && (
                      <p className="text-xs text-muted-foreground truncate">{d.detail}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground hidden sm:block">
                    {format(d.dueDate, "dd.MM.")}
                  </span>
                  {getStatusBadge(d.status, daysLeft)}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
