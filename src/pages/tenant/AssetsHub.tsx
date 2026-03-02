import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Package, CheckCircle, XCircle, TrendingDown, Plus, List, FolderTree, Calculator, Trash2, TrendingUp, UserCheck, ClipboardList, Car, FileSignature, MapPin, FileSpreadsheet, UserX } from "lucide-react";

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
    { label: t("assetsTotalAssets"), value: stats?.total ?? 0, icon: Package, color: "text-primary" },
    { label: t("assetsActive"), value: stats?.active ?? 0, icon: CheckCircle, color: "text-emerald-500" },
    { label: t("assetsDisposed"), value: stats?.disposed ?? 0, icon: XCircle, color: "text-destructive" },
    { label: t("assetsDraft"), value: stats?.draft ?? 0, icon: TrendingDown, color: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("assetsModule")}</h1>
          <p className="text-muted-foreground text-sm">{t("assetsModuleDesc")}</p>
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
              <p className="font-semibold">{t("assetsNewAsset")}</p>
              <p className="text-sm text-muted-foreground">{t("assetsNewAssetDesc")}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/assets/registry")}>
          <CardContent className="flex items-center gap-3 py-6">
            <List className="h-8 w-8 text-primary" />
            <div>
              <p className="font-semibold">{t("assetsRegistry")}</p>
              <p className="text-sm text-muted-foreground">{t("assetsRegistryDesc")}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/assets/depreciation")}>
          <CardContent className="flex items-center gap-3 py-6">
            <Calculator className="h-8 w-8 text-primary" />
            <div>
              <p className="font-semibold">{t("assetsDepreciation")}</p>
              <p className="text-sm text-muted-foreground">{t("assetsDepSchedule")}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/assets/disposals")}>
          <CardContent className="flex items-center gap-3 py-6">
            <Trash2 className="h-8 w-8 text-primary" />
            <div>
              <p className="font-semibold">{t("assetsDisposals")}</p>
              <p className="text-sm text-muted-foreground">{t("assetsDisposalHistory")}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/assets/revaluations")}>
          <CardContent className="flex items-center gap-3 py-6">
            <TrendingUp className="h-8 w-8 text-primary" />
            <div>
              <p className="font-semibold">{t("assetsRevalImpairment")}</p>
              <p className="text-sm text-muted-foreground">MRS 16 / MRS 36</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/assets/assignments")}>
          <CardContent className="flex items-center gap-3 py-6">
            <UserCheck className="h-8 w-8 text-primary" />
            <div>
              <p className="font-semibold">{t("assetsAssignments")}</p>
              <p className="text-sm text-muted-foreground">{t("assetsAssignmentHistory")}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/assets/reverses")}>
          <CardContent className="flex items-center gap-3 py-6">
            <FileSignature className="h-8 w-8 text-primary" />
            <div>
              <p className="font-semibold">{t("reversDocuments")}</p>
              <p className="text-sm text-muted-foreground">{t("reversHandover")} / {t("reversReturn")}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/assets/inventory-count")}>
          <CardContent className="flex items-center gap-3 py-6">
            <ClipboardList className="h-8 w-8 text-primary" />
            <div>
              <p className="font-semibold">{t("assetsInventoryCount")}</p>
              <p className="text-sm text-muted-foreground">{t("assetsCountSheet")}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/assets/categories")}>
          <CardContent className="flex items-center gap-3 py-6">
            <FolderTree className="h-8 w-8 text-primary" />
            <div>
              <p className="font-semibold">{t("assetsCategories")}</p>
              <p className="text-sm text-muted-foreground">{t("assetsCategoriesDesc")}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/assets/fleet")}>
          <CardContent className="flex items-center gap-3 py-6">
            <Car className="h-8 w-8 text-primary" />
            <div>
              <p className="font-semibold">{t("fleetDashboard")}</p>
              <p className="text-sm text-muted-foreground">{t("fleetManagement")}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/assets/leases")}>
          <CardContent className="flex items-center gap-3 py-6">
            <FileSignature className="h-8 w-8 text-primary" />
            <div>
              <p className="font-semibold">{t("leaseContracts")}</p>
              <p className="text-sm text-muted-foreground">{t("leaseAccounting")}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/assets/locations")}>
          <CardContent className="flex items-center gap-3 py-6">
            <MapPin className="h-8 w-8 text-primary" />
            <div>
              <p className="font-semibold">{t("assetsLocationsTitle")}</p>
              <p className="text-sm text-muted-foreground">{t("locBuilding")} / {t("locRoom")} / {t("locWarehouse")}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/assets/reports")}>
          <CardContent className="flex items-center gap-3 py-6">
            <FileSpreadsheet className="h-8 w-8 text-primary" />
            <div>
              <p className="font-semibold">{t("assetsReports")}</p>
              <p className="text-sm text-muted-foreground">PDF / Excel</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/assets/offboarding")}>
          <CardContent className="flex items-center gap-3 py-6">
            <UserX className="h-8 w-8 text-primary" />
            <div>
              <p className="font-semibold">{t("offboardingTitle")}</p>
              <p className="text-sm text-muted-foreground">{t("offboardingDesc")}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
