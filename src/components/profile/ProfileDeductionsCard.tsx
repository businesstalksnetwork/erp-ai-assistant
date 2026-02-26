import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MinusCircle } from "lucide-react";

interface Props {
  employeeId: string;
}

export function ProfileDeductionsCard({ employeeId }: Props) {
  const { t } = useLanguage();
  const { tenantId } = useTenant();

  const { data: deductions = [] } = useQuery({
    queryKey: ["profile-deductions", tenantId, employeeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("deductions")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("employee_id", employeeId)
        .order("start_date", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId && !!employeeId,
  });

  const fmtNum = (n: number) => n?.toLocaleString("sr-RS", { minimumFractionDigits: 2 }) ?? "—";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MinusCircle className="h-5 w-5" />
          {t("profileDeductions" as any)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {deductions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("profileNoDeductions" as any)}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("type")}</TableHead>
                <TableHead className="text-right">{t("totalAmount")}</TableHead>
                <TableHead className="text-right">{t("paidAmountLabel")}</TableHead>
                <TableHead>{t("startDate")}</TableHead>
                <TableHead>{t("endDate" as any)}</TableHead>
                <TableHead>{t("status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deductions.map((d: any) => (
                <TableRow key={d.id}>
                  <TableCell>{d.type}</TableCell>
                  <TableCell className="text-right">{fmtNum(d.total_amount)}</TableCell>
                  <TableCell className="text-right">{fmtNum(d.paid_amount)}</TableCell>
                  <TableCell>{d.start_date || "—"}</TableCell>
                  <TableCell>{d.end_date || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={d.is_active ? "default" : "secondary"}>
                      {d.is_active ? t("active") : t("inactive")}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
