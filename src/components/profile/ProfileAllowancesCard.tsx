import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlusCircle } from "lucide-react";

interface Props {
  employeeId: string;
}

export function ProfileAllowancesCard({ employeeId }: Props) {
  const { t } = useLanguage();
  const { tenantId } = useTenant();

  const { data: allowances = [] } = useQuery({
    queryKey: ["profile-allowances", tenantId, employeeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("allowances")
        .select("*, allowance_types(name)")
        .eq("tenant_id", tenantId!)
        .eq("employee_id", employeeId)
        .order("year", { ascending: false })
        .order("month", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId && !!employeeId,
  });

  const fmtNum = (n: number) => n?.toLocaleString("sr-RS", { minimumFractionDigits: 2 }) ?? "—";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PlusCircle className="h-5 w-5" />
          {t("profileAllowances" as any)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {allowances.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("profileNoAllowances" as any)}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("type")}</TableHead>
                <TableHead className="text-right">{t("amount")}</TableHead>
                <TableHead>{t("month" as any)}</TableHead>
                <TableHead>{t("year" as any)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allowances.map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell>{a.allowance_types?.name || "—"}</TableCell>
                  <TableCell className="text-right">{fmtNum(a.amount)}</TableCell>
                  <TableCell>{a.month}</TableCell>
                  <TableCell>{a.year}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
