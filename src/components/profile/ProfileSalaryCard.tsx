import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign } from "lucide-react";

interface Props {
  employeeId: string;
}

export function ProfileSalaryCard({ employeeId }: Props) {
  const { t } = useLanguage();
  const { tenantId } = useTenant();

  const { data: salary } = useQuery({
    queryKey: ["profile-salary", tenantId, employeeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("employee_salaries")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("employee_id", employeeId)
        .order("start_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!tenantId && !!employeeId,
  });

  const fmtNum = (n: number) => n?.toLocaleString("sr-RS", { minimumFractionDigits: 2 }) ?? "—";

  if (!salary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            {t("profileSalaryInfo" as any)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("profileNoSalary" as any)}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          {t("profileSalaryInfo" as any)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t("amount")}</span>
          <span className="font-semibold">{fmtNum(salary.amount)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t("salaryType")}</span>
          <span>{salary.salary_type === "monthly" ? t("monthlyRate") : t("hourlyRate")}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t("amountTypeLabel")}</span>
          <span>{salary.amount_type === "gross" ? t("gross") : t("net")}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t("mealAllowance")}</span>
          <span>{fmtNum(salary.meal_allowance)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t("regres")}</span>
          <span>{fmtNum(salary.regres)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t("startDate")}</span>
          <span>{salary.start_date}</span>
        </div>
      </CardContent>
    </Card>
  );
}
