import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserCheck } from "lucide-react";

interface Props {
  employee: any;
  departmentName?: string;
  locationName?: string;
  managerName?: string;
}

export function ProfilePersonalCard({ employee, departmentName, locationName, managerName }: Props) {
  const { t } = useLanguage();

  const maskJmbg = (jmbg: string | null) => {
    if (!jmbg || jmbg.length < 5) return jmbg || "—";
    return jmbg.slice(0, 4) + "•".repeat(jmbg.length - 4);
  };

  const rows: [string, string | null | undefined][] = [
    [t("name" as any), employee.full_name],
    [t("email"), employee.email],
    [t("phone" as any), employee.phone],
    [t("profileJmbg" as any), maskJmbg(employee.jmbg)],
    [t("address" as any), [employee.address, employee.city].filter(Boolean).join(", ") || null],
    [t("department" as any), departmentName],
    [t("profilePosition" as any), employee.position],
    [t("profileLocation" as any), locationName],
    [t("profileEmploymentType" as any), employee.employment_type],
    [t("profileDailyHours" as any), employee.daily_work_hours ? `${employee.daily_work_hours}h` : null],
    ["Manager", managerName],
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCheck className="h-5 w-5" />
          {t("profilePersonalData" as any)}
          {employee.is_ghost && <Badge variant="outline" className="text-xs">{t("profileGhost" as any)}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {rows.map(([label, value], i) => (
          <div key={i} className="flex justify-between">
            <span className="text-muted-foreground">{label}</span>
            <span className="text-right max-w-[60%]">{value || "—"}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
