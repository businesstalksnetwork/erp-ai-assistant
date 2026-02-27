import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileSpreadsheet, FileText, Search } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/shared/ResponsiveTable";

export default function AssetReports() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("registry");

  const { data: assets = [], isLoading: assetsLoading } = useQuery({
    queryKey: ["asset-report-registry", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("assets").select("*, asset_categories(name, code), asset_locations(name), employees(first_name, last_name)").eq("tenant_id", tenantId).order("asset_code");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: depreciations = [], isLoading: depLoading } = useQuery({
    queryKey: ["asset-report-depreciation", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("fixed_asset_depreciation_schedules").select("*, assets(name, asset_code)").eq("tenant_id", tenantId).order("period_start", { ascending: false }).limit(500);
      return data || [];
    },
    enabled: !!tenantId && tab === "depreciation",
  });

  const { data: counts = [], isLoading: countsLoading } = useQuery({
    queryKey: ["asset-report-counts", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("asset_inventory_counts").select("*").eq("tenant_id", tenantId).order("count_date", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId && tab === "inventory",
  });

  const filteredAssets = assets.filter((a: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return a.name?.toLowerCase().includes(s) || a.asset_code?.toLowerCase().includes(s) || a.serial_number?.toLowerCase().includes(s);
  });

  const exportToExcel = (data: any[], filename: string) => {
    if (!data.length) { toast({ title: t("noResults") }); return; }
    const ws = XLSX.utils.json_to_sheet(data.map((r: any) => {
      if (tab === "registry") return { [t("code" as any)]: r.asset_code, [t("name" as any)]: r.name, [t("type" as any)]: r.asset_type, [t("assetsCategories" as any)]: r.asset_categories?.name || "", [t("assetsLocation" as any)]: r.asset_locations?.name || "", [t("assetsAcquisitionCost" as any)]: r.acquisition_cost, [t("assetsCurrentValue" as any)]: r.current_value, [t("status")]: r.status, [t("date" as any)]: r.acquisition_date };
      if (tab === "depreciation") return { [t("code" as any)]: r.assets?.asset_code, [t("name" as any)]: r.assets?.name, [t("period" as any)]: r.period_start, [t("assetsDepAmount" as any)]: r.depreciation_amount, [t("assetsAccumDep" as any)]: r.accumulated_depreciation, [t("assetsNetBookValue" as any)]: r.net_book_value };
      return { [t("reversNumber" as any)]: r.count_number, [t("date" as any)]: r.count_date, [t("status")]: r.status, [t("assetsTotalAssets" as any)]: r.total_assets, [t("assetsFound" as any)]: r.found_count, [t("assetsMissing" as any)]: r.missing_count };
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `${filename}.xlsx`);
  };

  const handlePdfExport = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("generate-pdf", { body: { type: "asset_registry_report", tenant_id: tenantId } });
      if (error) throw error;
      const blob = new Blob([data], { type: "text/html" });
      window.open(URL.createObjectURL(blob), "_blank");
    } catch (e: any) {
      toast({ title: t("error"), description: e.message, variant: "destructive" });
    }
  };

  const registryColumns: ResponsiveColumn<any>[] = [
    { key: "code", label: t("code" as any), primary: true, sortable: true, sortValue: (a) => a.asset_code, render: (a) => <span className="font-mono text-sm">{a.asset_code}</span> },
    { key: "name", label: t("name" as any), sortable: true, sortValue: (a) => a.name, render: (a) => <span className="font-medium">{a.name}</span> },
    { key: "type", label: t("type" as any), sortable: true, sortValue: (a) => a.asset_type, render: (a) => <Badge variant="outline">{a.asset_type}</Badge> },
    { key: "category", label: t("assetsCategories" as any), hideOnMobile: true, render: (a) => a.asset_categories?.name || "—" },
    { key: "location", label: t("assetsLocation" as any), hideOnMobile: true, render: (a) => a.asset_locations?.name || "—" },
    { key: "acquisition_cost", label: t("assetsAcquisitionCost" as any), align: "right", sortable: true, sortValue: (a) => a.acquisition_cost || 0, render: (a) => <span className="font-mono">{a.acquisition_cost?.toLocaleString("sr-RS", { minimumFractionDigits: 2 }) || "—"}</span> },
    { key: "current_value", label: t("assetsCurrentValue" as any), align: "right", sortable: true, sortValue: (a) => a.current_value || 0, render: (a) => <span className="font-mono">{a.current_value?.toLocaleString("sr-RS", { minimumFractionDigits: 2 }) || "—"}</span> },
    { key: "status", label: t("status"), sortable: true, sortValue: (a) => a.status, render: (a) => <Badge variant="secondary">{a.status}</Badge> },
  ];

  const depColumns: ResponsiveColumn<any>[] = [
    { key: "code", label: t("code" as any), primary: true, sortable: true, sortValue: (d) => d.assets?.asset_code || "", render: (d) => <span className="font-mono text-sm">{d.assets?.asset_code}</span> },
    { key: "name", label: t("name" as any), sortable: true, sortValue: (d) => d.assets?.name || "", render: (d) => d.assets?.name },
    { key: "period", label: t("period" as any), sortable: true, sortValue: (d) => d.period_start, render: (d) => d.period_start },
    { key: "dep_amount", label: t("assetsDepAmount" as any), align: "right", sortable: true, sortValue: (d) => Number(d.depreciation_amount), render: (d) => <span className="font-mono">{Number(d.depreciation_amount).toLocaleString("sr-RS", { minimumFractionDigits: 2 })}</span> },
    { key: "accum_dep", label: t("assetsAccumDep" as any), align: "right", sortable: true, sortValue: (d) => Number(d.accumulated_depreciation), render: (d) => <span className="font-mono">{Number(d.accumulated_depreciation).toLocaleString("sr-RS", { minimumFractionDigits: 2 })}</span> },
    { key: "nbv", label: t("assetsNetBookValue" as any), align: "right", sortable: true, sortValue: (d) => Number(d.net_book_value), render: (d) => <span className="font-mono">{Number(d.net_book_value).toLocaleString("sr-RS", { minimumFractionDigits: 2 })}</span> },
  ];

  const countColumns: ResponsiveColumn<any>[] = [
    { key: "count_number", label: t("reversNumber" as any), primary: true, sortable: true, sortValue: (c) => c.count_number, render: (c) => <span className="font-mono text-sm">{c.count_number}</span> },
    { key: "date", label: t("date" as any), sortable: true, sortValue: (c) => c.count_date, render: (c) => c.count_date },
    { key: "status", label: t("status"), sortable: true, sortValue: (c) => c.status, render: (c) => <Badge variant="secondary">{c.status}</Badge> },
    { key: "total", label: t("assetsTotalAssets" as any), align: "right", sortable: true, sortValue: (c) => c.total_assets || 0, render: (c) => c.total_assets || 0 },
    { key: "found", label: t("assetsFound" as any), align: "right", sortable: true, sortValue: (c) => c.found_count || 0, render: (c) => c.found_count || 0 },
    { key: "missing", label: t("assetsMissing" as any), align: "right", sortable: true, sortValue: (c) => c.missing_count || 0, render: (c) => c.missing_count || 0 },
  ];

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">{t("assetsReports" as any)}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportToExcel(tab === "registry" ? filteredAssets : tab === "depreciation" ? depreciations : counts, `assets-${tab}-report`)}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
          </Button>
          {tab === "registry" && <Button variant="outline" onClick={handlePdfExport}><FileText className="h-4 w-4 mr-1" /> PDF</Button>}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="registry">{t("assetsRegistry" as any)}</TabsTrigger>
          <TabsTrigger value="depreciation">{t("assetsDepreciation" as any)}</TabsTrigger>
          <TabsTrigger value="inventory">{t("assetsInventoryCount" as any)}</TabsTrigger>
        </TabsList>

        {tab === "registry" && (
          <div className="relative max-w-sm mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        )}

        <TabsContent value="registry">
          <ResponsiveTable data={filteredAssets} columns={registryColumns} keyExtractor={(a) => a.id} emptyMessage={t("noResults")} enableExport exportFilename="asset_registry" enableColumnToggle />
        </TabsContent>

        <TabsContent value="depreciation">
          <ResponsiveTable data={depreciations} columns={depColumns} keyExtractor={(d) => d.id} emptyMessage={t("noResults")} enableExport exportFilename="asset_depreciation" />
        </TabsContent>

        <TabsContent value="inventory">
          <ResponsiveTable data={counts} columns={countColumns} keyExtractor={(c) => c.id} emptyMessage={t("noResults")} enableExport exportFilename="asset_inventory_counts" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
