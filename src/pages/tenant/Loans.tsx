import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export default function Loans() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();

  const { data: loans = [], isLoading } = useQuery({
    queryKey: ["loans", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase.from("loans").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("loans")}</h1>
        <Button size="sm" disabled><Plus className="h-4 w-4 mr-1" />{t("add")}</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>{t("loans")}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">{t("loading")}</p>
          ) : loans.length === 0 ? (
            <p className="text-muted-foreground">{t("noResults")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("type")}</TableHead>
                  <TableHead>{t("description")}</TableHead>
                  <TableHead>{t("principal")}</TableHead>
                  <TableHead>{t("interestRate")}</TableHead>
                  <TableHead>{t("termMonths")}</TableHead>
                  <TableHead>{t("startDate")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loans.map((l: any) => (
                  <TableRow key={l.id}>
                    <TableCell>{l.type === "receivable" ? t("accountsReceivable") : t("accountsPayable")}</TableCell>
                    <TableCell>{l.description || "—"}</TableCell>
                    <TableCell>{Number(l.principal).toLocaleString()} {l.currency}</TableCell>
                    <TableCell>{l.interest_rate}%</TableCell>
                    <TableCell>{l.term_months}</TableCell>
                    <TableCell>{l.start_date}</TableCell>
                    <TableCell><Badge variant={l.status === "active" ? "default" : "secondary"}>{t(l.status)}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
