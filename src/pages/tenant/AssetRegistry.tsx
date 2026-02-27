import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { MobileFilterBar } from "@/components/shared/MobileFilterBar";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/shared/ResponsiveTable";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  in_use: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  maintenance: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  disposed: "bg-destructive/10 text-destructive",
  written_off: "bg-destructive/10 text-destructive",
};

export default function AssetRegistry() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ["assets-registry", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("assets")
        .select("*, asset_categories(name, code), partners!assets_supplier_id_fkey(name), employees!assets_responsible_employee_id_fkey(full_name), warehouses(name), purchase_orders(order_number)")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const filtered = assets.filter((a: any) => {
    const matchesType = typeFilter === "all" || a.asset_type === typeFilter;
    const matchesSearch =
      !search ||
      a.name?.toLowerCase().includes(search.toLowerCase()) ||
      a.asset_code?.toLowerCase().includes(search.toLowerCase()) ||
      a.serial_number?.toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesSearch;
  });

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("sr-Latn-RS", { style: "decimal", minimumFractionDigits: 2 }).format(val || 0);

  const columns: ResponsiveColumn<any>[] = [
    { key: "code", label: t("code" as any), primary: true, sortable: true, sortValue: (a) => a.asset_code || "", render: (a) => <span className="font-mono text-sm">{a.asset_code}</span> },
    { key: "name", label: t("name" as any), sortable: true, sortValue: (a) => a.name, render: (a) => <span className="font-medium">{a.name}</span> },
    { key: "category", label: t("assetsCategory" as any), hideOnMobile: true, sortable: true, sortValue: (a) => a.asset_categories?.name || "", render: (a) => a.asset_categories?.name || "—" },
    { key: "supplier", label: t("supplier" as any), hideOnMobile: true, render: (a) => a.partners?.name || "—" },
    { key: "warehouse", label: t("warehouse" as any), hideOnMobile: true, render: (a) => a.warehouses?.name || "—" },
    { key: "employee", label: t("assetsCrossEmployee" as any), hideOnMobile: true, render: (a) => a.employees?.full_name || "—" },
    { key: "status", label: t("status"), sortable: true, sortValue: (a) => a.status, render: (a) => <Badge className={STATUS_COLORS[a.status] || ""}>{a.status}</Badge> },
    { key: "value", label: t("assetsCurrentValue" as any), align: "right" as const, sortable: true, sortValue: (a) => Number(a.current_value || 0), render: (a) => <span className="font-mono">{formatCurrency(a.current_value)}</span> },
  ];

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-1">
      <PageHeader
        title={t("assetsRegistry" as any)}
        actions={
          <Button onClick={() => navigate("/assets/registry/new")}>
            <Plus className="h-4 w-4 mr-1" /> {t("assetsNewAsset" as any)}
          </Button>
        }
      />

      <MobileFilterBar
        search={<Input placeholder={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} />}
        filters={<></>}
      />

      <Tabs value={typeFilter} onValueChange={setTypeFilter}>
        <TabsList>
          <TabsTrigger value="all">{t("all" as any)}</TabsTrigger>
          <TabsTrigger value="fixed_asset">{t("assetsFixedAsset" as any)}</TabsTrigger>
          <TabsTrigger value="intangible">{t("assetsIntangible" as any)}</TabsTrigger>
          <TabsTrigger value="material_good">{t("assetsMaterialGood" as any)}</TabsTrigger>
          <TabsTrigger value="vehicle">{t("assetsVehicle" as any)}</TabsTrigger>
        </TabsList>
      </Tabs>

      <ResponsiveTable
        data={filtered}
        columns={columns}
        keyExtractor={(a) => a.id}
        onRowClick={(a) => navigate(`/assets/registry/${a.id}`)}
        emptyMessage={t("noResults")}
        enableExport
        exportFilename="assets-registry"
        enableColumnToggle
      />
    </div>
  );
}
