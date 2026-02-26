import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Props {
  employeeId: string;
}

export function EmployeeAssetsTab({ employeeId }: Props) {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const navigate = useNavigate();

  // Assets where employee is responsible
  const { data: responsibleAssets = [] } = useQuery({
    queryKey: ["employee-responsible-assets", employeeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("assets")
        .select("id, asset_code, name, status, current_value, asset_type")
        .eq("tenant_id", tenantId!)
        .eq("responsible_employee_id", employeeId)
        .order("name");
      return data || [];
    },
    enabled: !!tenantId && !!employeeId,
  });

  // Active assignments
  const { data: assignments = [] } = useQuery({
    queryKey: ["employee-asset-assignments", employeeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("asset_assignments")
        .select("id, assigned_date, status, assets(id, asset_code, name, status, current_value)")
        .eq("tenant_id", tenantId!)
        .eq("employee_id", employeeId)
        .eq("status", "active")
        .order("assigned_date", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId && !!employeeId,
  });

  const allAssets = [
    ...responsibleAssets.map((a: any) => ({ ...a, source: t("assetsCrossResponsible" as any) })),
    ...assignments
      .filter((a: any) => a.assets && !responsibleAssets.some((r: any) => r.id === a.assets.id))
      .map((a: any) => ({ ...a.assets, source: t("assetsCrossAssigned" as any), assigned_date: a.assigned_date })),
  ];

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("sr-Latn-RS", { style: "decimal", minimumFractionDigits: 2 }).format(val || 0);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Package className="h-5 w-5" /> {t("assetsCrossEmployeeAssets" as any)} ({allAssets.length})
      </h3>

      {allAssets.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">{t("assetsCrossNoAssets" as any)}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("code" as any)}</TableHead>
              <TableHead>{t("name" as any)}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead className="text-right">{t("assetsCurrentValue" as any)}</TableHead>
              <TableHead>{t("assetsCrossSource" as any)}</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allAssets.map((asset: any) => (
              <TableRow key={asset.id}>
                <TableCell className="font-mono text-sm">{asset.asset_code}</TableCell>
                <TableCell className="font-medium">{asset.name}</TableCell>
                <TableCell><Badge variant="outline">{asset.status}</Badge></TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(asset.current_value || 0)}</TableCell>
                <TableCell><Badge variant="secondary">{asset.source}</Badge></TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" onClick={() => navigate(`/assets/registry/${asset.id}`)}>
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
