import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search } from "lucide-react";

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

  return (
    <div className="space-y-4 p-1">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">{t("assetsRegistry" as any)}</h1>
        <Button onClick={() => navigate("/assets/registry/new")}>
          <Plus className="h-4 w-4 mr-1" /> {t("assetsNewAsset" as any)}
        </Button>
      </div>

      <div className="flex gap-2 items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Tabs value={typeFilter} onValueChange={setTypeFilter}>
        <TabsList>
          <TabsTrigger value="all">{t("all" as any)}</TabsTrigger>
          <TabsTrigger value="fixed_asset">{t("assetsFixedAsset" as any)}</TabsTrigger>
          <TabsTrigger value="intangible">{t("assetsIntangible" as any)}</TabsTrigger>
          <TabsTrigger value="material_good">{t("assetsMaterialGood" as any)}</TabsTrigger>
          <TabsTrigger value="vehicle">{t("assetsVehicle" as any)}</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("code" as any)}</TableHead>
              <TableHead>{t("name" as any)}</TableHead>
              <TableHead>{t("assetsCategory" as any)}</TableHead>
              <TableHead>{t("supplier" as any)}</TableHead>
              <TableHead>{t("warehouse" as any)}</TableHead>
              <TableHead>{t("assetsCrossEmployee" as any)}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead className="text-right">{t("assetsCurrentValue" as any)}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  {t("noResults")}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((asset: any) => (
                <TableRow
                  key={asset.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/assets/registry/${asset.id}`)}
                >
                  <TableCell className="font-mono text-sm">{asset.asset_code}</TableCell>
                  <TableCell className="font-medium">{asset.name}</TableCell>
                  <TableCell>{(asset.asset_categories as any)?.name || "—"}</TableCell>
                  <TableCell>{(asset as any).partners?.name || "—"}</TableCell>
                  <TableCell>{(asset as any).warehouses?.name || "—"}</TableCell>
                  <TableCell>{(asset as any).employees?.full_name || "—"}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[asset.status] || ""}>{asset.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(asset.current_value)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
      )}
    </div>
  );
}
