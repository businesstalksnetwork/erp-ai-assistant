import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export default function Deferrals() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();

  const { data: deferrals = [], isLoading } = useQuery({
    queryKey: ["deferrals", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase.from("deferrals").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("deferrals")}</h1>
        <Button size="sm" disabled><Plus className="h-4 w-4 mr-1" />{t("add")}</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>{t("deferrals")}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">{t("loading")}</p>
          ) : deferrals.length === 0 ? (
            <p className="text-muted-foreground">{t("noResults")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("type")}</TableHead>
                  <TableHead>{t("description")}</TableHead>
                  <TableHead>{t("total")}</TableHead>
                  <TableHead>{t("recognized")}</TableHead>
                  <TableHead>{t("startDate")}</TableHead>
                  <TableHead>{t("endDate")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deferrals.map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell>{d.type === "revenue" ? t("revenueType") : t("expenseType")}</TableCell>
                    <TableCell>{d.description || "—"}</TableCell>
                    <TableCell>{Number(d.total_amount).toLocaleString()}</TableCell>
                    <TableCell>{Number(d.recognized_amount).toLocaleString()}</TableCell>
                    <TableCell>{d.start_date}</TableCell>
                    <TableCell>{d.end_date}</TableCell>
                    <TableCell><Badge variant={d.status === "active" ? "default" : "secondary"}>{t(d.status)}</Badge></TableCell>
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
