import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, Clock, RefreshCw } from "lucide-react";
import { differenceInDays, format } from "date-fns";
import { useLanguage } from "@/i18n/LanguageContext";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface Props {
  tenantId: string;
}

export function ComplianceDeadlineWidget({ tenantId }: Props) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const today = new Date();
  const currentYear = today.getFullYear();

  // Load deadlines from tax_calendar table
  const { data: deadlines = [], isLoading } = useQuery({
    queryKey: ["tax-calendar-deadlines", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tax_calendar")
        .select("*")
        .eq("tenant_id", tenantId)
        .in("status", ["pending", "overdue"])
        .gte("due_date", new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().split("T")[0])
        .order("due_date", { ascending: true })
        .limit(8);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 5,
  });

  // Fallback: also load PDV periods for backward compat when tax_calendar is empty
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
    enabled: !!tenantId && deadlines.length === 0,
    staleTime: 1000 * 60 * 10,
  });

  // Generate tax calendar for current year
  const generateMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("generate_tax_calendar", {
        p_tenant_id: tenantId,
        p_fiscal_year: currentYear,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ["tax-calendar-deadlines"] });
      toast({ title: t("taxCalendarGenerated"), description: `${count} ${t("deadlinesCreated")}` });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const getStatusIcon = (status: string, daysLeft: number) => {
    if (status === "completed") return <CheckCircle className="h-4 w-4 text-primary" />;
    if (status === "overdue" || daysLeft < 0) return <AlertTriangle className="h-4 w-4 text-destructive" />;
    if (daysLeft <= 5) return <AlertTriangle className="h-4 w-4 text-accent" />;
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  const getStatusBadge = (status: string, daysLeft: number) => {
    if (status === "completed") return <Badge variant="default" className="text-xs">{t("deadlineSubmitted")}</Badge>;
    if (status === "overdue" || daysLeft < 0) return <Badge variant="destructive" className="text-xs">{t("deadlineLate")}</Badge>;
    if (daysLeft <= 5) return <Badge variant="secondary" className="text-xs">{daysLeft}d</Badge>;
    return <Badge variant="outline" className="text-xs">{daysLeft}d</Badge>;
  };

  // Use tax_calendar data if available, otherwise fallback to hardcoded
  const hasCalendar = deadlines.length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{t("complianceDeadlinesTitle")}</CardTitle>
            <p className="text-xs text-muted-foreground">{t("complianceDeadlinesSubtitle")}</p>
          </div>
          {!hasCalendar && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${generateMutation.isPending ? "animate-spin" : ""}`} />
              {t("generateTaxCalendar")}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {hasCalendar ? (
            deadlines.map((d) => {
              const dueDate = new Date(d.due_date);
              const daysLeft = differenceInDays(dueDate, today);
              return (
                <div key={d.id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {getStatusIcon(d.status, daysLeft)}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{d.title}</p>
                      {d.description && (
                        <p className="text-xs text-muted-foreground truncate">{d.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground hidden sm:block">
                      {format(dueDate, "dd.MM.")}
                    </span>
                    {getStatusBadge(d.status, daysLeft)}
                  </div>
                </div>
              );
            })
          ) : (
            // Fallback: hardcoded deadlines when tax_calendar is empty
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-2">{t("noTaxCalendarData")}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${generateMutation.isPending ? "animate-spin" : ""}`} />
                {t("generateTaxCalendar")}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
