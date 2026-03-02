import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";
import { format } from "date-fns";

interface Props {
  employeeId: string;
}

export function ProfileContractCard({ employeeId }: Props) {
  const { t } = useLanguage();
  const { tenantId } = useTenant();

  const { data: contracts = [] } = useQuery({
    queryKey: ["profile-contracts", employeeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("employee_contracts")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("employee_id", employeeId)
        .order("start_date", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId && !!employeeId,
  });

  const active = contracts.find((c: any) => c.is_active);
  const fmtDate = (d: string | null) => d ? format(new Date(d), "dd.MM.yyyy") : "—";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          {t("profileContractInfo")}
          {active && <Badge variant="secondary">{t("active")}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {contracts.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">{t("profileNoContract")}</p>
        ) : (
          <>
            {(active ? [active] : contracts.slice(0, 1)).map((c: any) => (
              <div key={c.id} className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("profileContractType")}</span>
                  <span>{c.contract_type || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("startDate")}</span>
                  <span>{fmtDate(c.start_date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("endDate")}</span>
                  <span>{fmtDate(c.end_date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("profileWorkingHours")}</span>
                  <span>{c.working_hours_per_week ? `${c.working_hours_per_week}h/${t("profileWeek")}` : "—"}</span>
                </div>
              </div>
            ))}
            {contracts.length > 1 && (
              <p className="text-xs text-muted-foreground pt-2">
                + {contracts.length - 1} {t("profilePreviousContracts")}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
