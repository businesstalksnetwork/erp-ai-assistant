import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";

interface Props {
  employeeId: string;
}

export function ProfileInsuranceCard({ employeeId }: Props) {
  const { t } = useLanguage();
  const { tenantId } = useTenant();

  const { data: records = [] } = useQuery({
    queryKey: ["profile-insurance", tenantId, employeeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("insurance_records")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("employee_id", employeeId)
        .order("registration_date", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId && !!employeeId,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          {t("profileInsurance" as any)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {records.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("profileNoInsurance" as any)}</p>
        ) : (
          <div className="space-y-4">
            {records.map((r: any) => (
              <div key={r.id} className="border rounded-lg p-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("name")}</span>
                  <span>{[r.first_name, r.middle_name, r.last_name].filter(Boolean).join(" ")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("profileJmbg")}</span>
                  <span className="font-mono">{r.jmbg ? `•••••••${r.jmbg.slice(-6)}` : "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">LBO</span>
                  <span className="font-mono">{r.lbo || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("profileInsuranceStart" as any)}</span>
                  <span>{r.insurance_start || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("profileInsuranceEnd" as any)}</span>
                  <span>{r.insurance_end || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("profileRegistrationDate" as any)}</span>
                  <span>{r.registration_date || "—"}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
