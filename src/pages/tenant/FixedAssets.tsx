import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export default function FixedAssets() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ["fixed_assets", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("fixed_assets")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: depreciations = [] } = useQuery({
    queryKey: ["fixed_asset_depreciation", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("fixed_asset_depreciation")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("period", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const statusColor = (s: string) => {
    if (s === "active") return "default";
    if (s === "disposed") return "destructive";
    return "secondary";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("fixedAssets")}</h1>
        <Button size="sm" disabled><Plus className="h-4 w-4 mr-1" />{t("add")}</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>{t("fixedAssets")}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">{t("loading")}</p>
          ) : assets.length === 0 ? (
            <p className="text-muted-foreground">{t("noResults")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("acquisitionDate")}</TableHead>
                  <TableHead>{t("acquisitionCost")}</TableHead>
                  <TableHead>{t("depreciationMethod")}</TableHead>
                  <TableHead>{t("usefulLife")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell>{a.acquisition_date}</TableCell>
                    <TableCell>{Number(a.acquisition_cost).toLocaleString()} RSD</TableCell>
                    <TableCell>{a.depreciation_method === "straight_line" ? t("straightLine") : t("decliningBalance")}</TableCell>
                    <TableCell>{a.useful_life_months} {t("months")}</TableCell>
                    <TableCell><Badge variant={statusColor(a.status)}>{t(a.status)}</Badge></TableCell>
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
