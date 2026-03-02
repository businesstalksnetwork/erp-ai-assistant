import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, Plus } from "lucide-react";
import { LeaveRequestDialog } from "./LeaveRequestDialog";

interface Props {
  employeeId: string;
  annualLeaveDays?: number | null;
}

export function ProfileLeaveCard({ employeeId, annualLeaveDays }: Props) {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const currentYear = new Date().getFullYear();
  const [dialogOpen, setDialogOpen] = useState(false);

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
  const pending = (balance as any)?.pending_days ?? 0;
  const remaining = entitled + carriedOver - used - pending;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              {t("profileLeaveBalance")} ({currentYear})
            </CardTitle>
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Zatraži odsustvo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{entitled}</p>
              <p className="text-xs text-muted-foreground">{t("profileEntitled")}</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{carriedOver}</p>
              <p className="text-xs text-muted-foreground">{t("profileCarriedOver")}</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{used}</p>
              <p className="text-xs text-muted-foreground">{t("profileUsed")}</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{pending}</p>
              <p className="text-xs text-muted-foreground">Na čekanju</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">{remaining}</p>
              <p className="text-xs text-muted-foreground">{t("profileRemaining")}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <LeaveRequestDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        employeeId={employeeId}
        balance={{ entitled, used, pending, carriedOver }}
      />
    </>
  );
}
