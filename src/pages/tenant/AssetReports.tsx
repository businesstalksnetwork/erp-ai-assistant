import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileSpreadsheet, FileText, Search, Download } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

export default function AssetReports() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("registry");

  // ─── Registry Report ───
  const { data: assets = [], isLoading: assetsLoading } = useQuery({
    queryKey: ["asset-report-registry", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("assets")
        .select("*, asset_categories(name, code), asset_locations(name), employees(first_name, last_name)")
        .eq("tenant_id", tenantId)
        .order("asset_code");
      return data || [];
    },
    enabled: !!tenantId,
  });

  // ─── Depreciation Report ───
  const { data: depreciations = [], isLoading: depLoading } = useQuery({
    queryKey: ["asset-report-depreciation", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("fixed_asset_depreciation_schedules")
        .select("*, assets(name, asset_code)")
        .eq("tenant_id", tenantId)
        .order("period_date", { ascending: false })
        .limit(500);
      return data || [];
    },
    enabled: !!tenantId && tab === "depreciation",
  });

  // ─── Inventory Count Report ───
  const { data: counts = [], isLoading: countsLoading } = useQuery({
    queryKey: ["asset-report-counts", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("asset_inventory_counts")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("count_date", { ascending: false });
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
      if (tab === "registry") {
        return {
          [t("code" as any)]: r.asset_code,
          [t("name" as any)]: r.name,
          [t("type" as any)]: r.asset_type,
          [t("assetsCategories" as any)]: r.asset_categories?.name || "",
          [t("assetsLocation" as any)]: r.asset_locations?.name || "",
          [t("assetsAcquisitionCost" as any)]: r.acquisition_cost,
          [t("assetsCurrentValue" as any)]: r.current_value,
          [t("status")]: r.status,
          [t("date" as any)]: r.acquisition_date,
        };
      }
      if (tab === "depreciation") {
        return {
          [t("code" as any)]: r.assets?.asset_code,
          [t("name" as any)]: r.assets?.name,
          [t("period" as any)]: r.period_date,
          [t("assetsDepAmount" as any)]: r.depreciation_amount,
          [t("assetsAccumDep" as any)]: r.accumulated_depreciation,
          [t("assetsNetBookValue" as any)]: r.net_book_value,
        };
      }
      return {
        [t("reversNumber" as any)]: r.count_number,
        [t("date" as any)]: r.count_date,
        [t("status")]: r.status,
        [t("assetsTotalAssets" as any)]: r.total_assets,
        [t("assetsFound" as any)]: r.found_count,
        [t("assetsMissing" as any)]: r.missing_count,
      };
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `${filename}.xlsx`);
  };

  const handlePdfExport = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("generate-pdf", {
        body: { type: "asset_registry_report", tenant_id: tenantId },
      });
      if (error) throw error;
      const blob = new Blob([data], { type: "text/html" });
      window.open(URL.createObjectURL(blob), "_blank");
    } catch (e: any) {
      toast({ title: t("error"), description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">{t("assetsReports" as any)}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportToExcel(
            tab === "registry" ? filteredAssets : tab === "depreciation" ? depreciations : counts,
            `assets-${tab}-report`
          )}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
          </Button>
          {tab === "registry" && (
            <Button variant="outline" onClick={handlePdfExport}>
              <FileText className="h-4 w-4 mr-1" /> PDF
            </Button>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="registry">{t("assetsRegistry" as any)}</TabsTrigger>
          <TabsTrigger value="depreciation">{t("assetsDepreciation" as any)}</TabsTrigger>
          <TabsTrigger value="inventory">{t("assetsInventoryCount" as any)}</TabsTrigger>
        </TabsList>

        <div className="relative max-w-sm mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        <TabsContent value="registry">
          <Card>
            <CardHeader><CardTitle>{t("assetsRegistry" as any)}</CardTitle></CardHeader>
            <CardContent>
              {assetsLoading ? (
                <div className="flex justify-center py-8"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("code" as any)}</TableHead>
                      <TableHead>{t("name" as any)}</TableHead>
                      <TableHead>{t("type" as any)}</TableHead>
                      <TableHead>{t("assetsCategories" as any)}</TableHead>
                      <TableHead>{t("assetsLocation" as any)}</TableHead>
                      <TableHead className="text-right">{t("assetsAcquisitionCost" as any)}</TableHead>
                      <TableHead className="text-right">{t("assetsCurrentValue" as any)}</TableHead>
                      <TableHead>{t("status")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAssets.map((a: any) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-mono text-sm">{a.asset_code}</TableCell>
                        <TableCell className="font-medium">{a.name}</TableCell>
                        <TableCell><Badge variant="outline">{a.asset_type}</Badge></TableCell>
                        <TableCell>{a.asset_categories?.name || "—"}</TableCell>
                        <TableCell>{a.asset_locations?.name || "—"}</TableCell>
                        <TableCell className="text-right font-mono">{a.acquisition_cost?.toLocaleString("sr-RS", { minimumFractionDigits: 2 }) || "—"}</TableCell>
                        <TableCell className="text-right font-mono">{a.current_value?.toLocaleString("sr-RS", { minimumFractionDigits: 2 }) || "—"}</TableCell>
                        <TableCell><Badge variant="secondary">{a.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="depreciation">
          <Card>
            <CardHeader><CardTitle>{t("assetsDepreciation" as any)}</CardTitle></CardHeader>
            <CardContent>
              {depLoading ? (
                <div className="flex justify-center py-8"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>
              ) : depreciations.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">{t("noResults")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("code" as any)}</TableHead>
                      <TableHead>{t("name" as any)}</TableHead>
                      <TableHead>{t("period" as any)}</TableHead>
                      <TableHead className="text-right">{t("assetsDepAmount" as any)}</TableHead>
                      <TableHead className="text-right">{t("assetsAccumDep" as any)}</TableHead>
                      <TableHead className="text-right">{t("assetsNetBookValue" as any)}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {depreciations.map((d: any) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-mono text-sm">{d.assets?.asset_code}</TableCell>
                        <TableCell>{d.assets?.name}</TableCell>
                        <TableCell>{d.period_date}</TableCell>
                        <TableCell className="text-right font-mono">{Number(d.depreciation_amount).toLocaleString("sr-RS", { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right font-mono">{Number(d.accumulated_depreciation).toLocaleString("sr-RS", { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right font-mono">{Number(d.net_book_value).toLocaleString("sr-RS", { minimumFractionDigits: 2 })}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory">
          <Card>
            <CardHeader><CardTitle>{t("assetsInventoryCount" as any)}</CardTitle></CardHeader>
            <CardContent>
              {countsLoading ? (
                <div className="flex justify-center py-8"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>
              ) : counts.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">{t("noResults")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("reversNumber" as any)}</TableHead>
                      <TableHead>{t("date" as any)}</TableHead>
                      <TableHead>{t("status")}</TableHead>
                      <TableHead className="text-right">{t("assetsTotalAssets" as any)}</TableHead>
                      <TableHead className="text-right">{t("assetsFound" as any)}</TableHead>
                      <TableHead className="text-right">{t("assetsMissing" as any)}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {counts.map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-sm">{c.count_number}</TableCell>
                        <TableCell>{c.count_date}</TableCell>
                        <TableCell><Badge variant="secondary">{c.status}</Badge></TableCell>
                        <TableCell className="text-right">{c.total_assets || 0}</TableCell>
                        <TableCell className="text-right">{c.found_count || 0}</TableCell>
                        <TableCell className="text-right">{c.missing_count || 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
