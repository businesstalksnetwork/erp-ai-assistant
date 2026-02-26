import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Package, CheckCircle, XCircle, TrendingDown, Plus, List, FolderTree, Calculator, Trash2, TrendingUp, UserCheck, ClipboardList } from "lucide-react";

export default function AssetsHub() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const navigate = useNavigate();

  const { data: stats } = useQuery({
    queryKey: ["assets-stats", tenantId],
    queryFn: async () => {
      if (!tenantId) return { total: 0, active: 0, disposed: 0, draft: 0 };
      const { data, error } = await supabase
        .from("assets")
        .select("status")
        .eq("tenant_id", tenantId);
      if (error) throw error;
      const total = data?.length || 0;
      const active = data?.filter((a: any) => a.status === "active" || a.status === "in_use").length || 0;
      const disposed = data?.filter((a: any) => a.status === "disposed" || a.status === "written_off").length || 0;
      const draft = data?.filter((a: any) => a.status === "draft").length || 0;
      return { total, active, disposed, draft };
    },
    enabled: !!tenantId,
  });

  const kpis = [
    { label: t("assetsTotalAssets" as any), value: stats?.total ?? 0, icon: Package, color: "text-primary" },
    { label: t("assetsActive" as any), value: stats?.active ?? 0, icon: CheckCircle, color: "text-emerald-500" },
    { label: t("assetsDisposed" as any), value: stats?.disposed ?? 0, icon: XCircle, color: "text-destructive" },
    { label: t("assetsDraft" as any), value: stats?.draft ?? 0, icon: TrendingDown, color: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("assetsModule" as any)}</h1>
          <p className="text-muted-foreground text-sm">{t("assetsModuleDesc" as any)}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.label}</CardTitle>
              <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{kpi.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/assets/registry/new")}>
          <CardContent className="flex items-center gap-3 py-6">
            <Plus className="h-8 w-8 text-primary" />
            <div>
              <p className="font-semibold">{t("assetsNewAsset" as any)}</p>
              <p className="text-sm text-muted-foreground">{t("assetsNewAssetDesc" as any)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/assets/registry")}>
          <CardContent className="flex items-center gap-3 py-6">
            <List className="h-8 w-8 text-primary" />
            <div>
              <p className="font-semibold">{t("assetsRegistry" as any)}</p>
              <p className="text-sm text-muted-foreground">{t("assetsRegistryDesc" as any)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/assets/depreciation")}>
          <CardContent className="flex items-center gap-3 py-6">
            <Calculator className="h-8 w-8 text-primary" />
            <div>
              <p className="font-semibold">{t("assetsDepreciation" as any)}</p>
              <p className="text-sm text-muted-foreground">{t("assetsDepSchedule" as any)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/assets/disposals")}>
          <CardContent className="flex items-center gap-3 py-6">
            <Trash2 className="h-8 w-8 text-primary" />
            <div>
              <p className="font-semibold">{t("assetsDisposals" as any)}</p>
              <p className="text-sm text-muted-foreground">{t("assetsDisposalHistory" as any)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/assets/revaluations")}>
          <CardContent className="flex items-center gap-3 py-6">
            <TrendingUp className="h-8 w-8 text-primary" />
            <div>
              <p className="font-semibold">{t("assetsRevalImpairment" as any)}</p>
              <p className="text-sm text-muted-foreground">MRS 16 / MRS 36</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/assets/assignments")}>
          <CardContent className="flex items-center gap-3 py-6">
            <UserCheck className="h-8 w-8 text-primary" />
            <div>
              <p className="font-semibold">{t("assetsAssignments" as any)}</p>
              <p className="text-sm text-muted-foreground">{t("assetsAssignmentHistory" as any)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/assets/inventory-count")}>
          <CardContent className="flex items-center gap-3 py-6">
            <ClipboardList className="h-8 w-8 text-primary" />
            <div>
              <p className="font-semibold">{t("assetsInventoryCount" as any)}</p>
              <p className="text-sm text-muted-foreground">{t("assetsCountSheet" as any)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/assets/categories")}>
          <CardContent className="flex items-center gap-3 py-6">
            <FolderTree className="h-8 w-8 text-primary" />
            <div>
              <p className="font-semibold">{t("assetsCategories" as any)}</p>
              <p className="text-sm text-muted-foreground">{t("assetsCategoriesDesc" as any)}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
