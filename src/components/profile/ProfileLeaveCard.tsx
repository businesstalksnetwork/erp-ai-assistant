import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays } from "lucide-react";

interface Props {
  employeeId: string;
  annualLeaveDays?: number | null;
}

export function ProfileLeaveCard({ employeeId, annualLeaveDays }: Props) {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const currentYear = new Date().getFullYear();

  const { data: balance } = useQuery({
    queryKey: ["profile-leave-balance", employeeId, currentYear],
    queryFn: async () => {
      const { data } = await supabase
        .from("annual_leave_balances")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("employee_id", employeeId)
        .eq("year", currentYear)
        .maybeSingle();
      return data;
    },
    enabled: !!tenantId && !!employeeId,
  });

  const entitled = balance?.entitled_days ?? annualLeaveDays ?? 0;
  const used = balance?.used_days ?? 0;
  const carriedOver = balance?.carried_over_days ?? 0;
  const remaining = entitled + carriedOver - used;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          {t("profileLeaveBalance" as any)} ({currentYear})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold">{entitled}</p>
            <p className="text-xs text-muted-foreground">{t("profileEntitled" as any)}</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{carriedOver}</p>
            <p className="text-xs text-muted-foreground">{t("profileCarriedOver" as any)}</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{used}</p>
            <p className="text-xs text-muted-foreground">{t("profileUsed" as any)}</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-primary">{remaining}</p>
            <p className="text-xs text-muted-foreground">{t("profileRemaining" as any)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
