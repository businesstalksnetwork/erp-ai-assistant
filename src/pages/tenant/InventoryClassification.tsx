import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Grid3X3, RefreshCw, Package, TrendingUp } from "lucide-react";
import { fmtNum } from "@/lib/utils";
import { toast } from "sonner";

const CLASS_COLORS: Record<string, string> = {
  AX: "bg-green-600", AY: "bg-green-500", AZ: "bg-yellow-500",
  BX: "bg-green-400", BY: "bg-yellow-400", BZ: "bg-orange-400",
  CX: "bg-yellow-300", CY: "bg-orange-300", CZ: "bg-red-400",
};

export default function InventoryClassification() {
  const { locale } = useLanguage();
  const { tenantId } = useTenant();
  const sr = locale === "sr";
  const t = (en: string, srText: string) => sr ? srText : en;
  const [result, setResult] = useState<any>(null);
  const [filterClass, setFilterClass] = useState<string>("all");

  const runClassification = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("inventory-classification", {
        body: { tenant_id: tenantId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setResult(data);
      toast.success(t(`Classified ${data.products?.length || 0} products`, `Klasifikovano ${data.products?.length || 0} proizvoda`));
    },
    onError: () => toast.error(t("Classification failed", "Klasifikacija neuspešna")),
  });

  const products = result?.products || [];
  const matrix = result?.matrix || {};
  const strategies = result?.strategies || {};
  const filtered = filterClass === "all" ? products : products.filter((p: any) => p.class === filterClass);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("ABC/XYZ Classification", "ABC/XYZ Klasifikacija")}
        description={t("Inventory classification by value and demand variability", "Klasifikacija zaliha po vrednosti i varijabilnosti potražnje")}
      />

      <div className="flex items-center gap-3">
        <Button onClick={() => runClassification.mutate()} disabled={runClassification.isPending}>
          <Grid3X3 className="mr-2 h-4 w-4" />
          {runClassification.isPending ? t("Analyzing...", "Analiza...") : t("Run Classification", "Pokreni klasifikaciju")}
        </Button>
        {products.length > 0 && (
          <Select value={filterClass} onValueChange={setFilterClass}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t("All Classes", "Sve klase")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("All Classes", "Sve klase")}</SelectItem>
              {["AX", "AY", "AZ", "BX", "BY", "BZ", "CX", "CY", "CZ"].map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {result && (
        <>
          {/* Summary KPIs */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("Total Products", "Ukupno proizvoda")}</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{result.summary?.total_products || 0}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("A Products", "A proizvodi")}</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold text-green-600">{result.summary?.a_count || 0}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("B Products", "B proizvodi")}</CardTitle>
              </CardHeader>
              <CardContent><div className="text-2xl font-bold text-yellow-600">{result.summary?.b_count || 0}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("C Products", "C proizvodi")}</CardTitle>
              </CardHeader>
              <CardContent><div className="text-2xl font-bold text-red-600">{result.summary?.c_count || 0}</div></CardContent>
            </Card>
          </div>

          {/* 3x3 Matrix Heatmap */}
          <Card>
            <CardHeader>
              <CardTitle>{t("Classification Matrix", "Matrica klasifikacije")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-center">
                  <thead>
                    <tr>
                      <th className="p-2"></th>
                      <th className="p-2 font-semibold">X ({t("Stable", "Stabilna")})</th>
                      <th className="p-2 font-semibold">Y ({t("Variable", "Promenljiva")})</th>
                      <th className="p-2 font-semibold">Z ({t("Erratic", "Nepredvidljiva")})</th>
                    </tr>
                  </thead>
                  <tbody>
                    {["A", "B", "C"].map(abc => (
                      <tr key={abc}>
                        <td className="p-2 font-semibold">{abc} ({abc === "A" ? t("High", "Visoka") : abc === "B" ? t("Medium", "Srednja") : t("Low", "Niska")})</td>
                        {["X", "Y", "Z"].map(xyz => {
                          const key = `${abc}${xyz}`;
                          const cell = matrix[key] || { count: 0, revenue: 0 };
                          return (
                            <td key={key} className="p-2">
                              <button
                                onClick={() => setFilterClass(key)}
                                className={`w-full rounded-lg p-3 text-white transition-transform hover:scale-105 ${CLASS_COLORS[key]}`}
                              >
                                <div className="text-lg font-bold">{cell.count}</div>
                                <div className="text-xs opacity-90">{fmtNum(cell.revenue)}</div>
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Strategy for selected class */}
              {filterClass !== "all" && strategies[filterClass] && (
                <div className="mt-4 p-4 rounded-lg bg-muted/50 border border-border">
                  <h4 className="font-semibold mb-1">{filterClass} {t("Strategy", "Strategija")}:</h4>
                  <p className="text-sm text-muted-foreground">{strategies[filterClass]}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Product Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Product", "Proizvod")}</TableHead>
                <TableHead>{t("SKU", "Šifra")}</TableHead>
                <TableHead>{t("Class", "Klasa")}</TableHead>
                <TableHead>{t("ABC", "ABC")}</TableHead>
                <TableHead>{t("XYZ", "XYZ")}</TableHead>
                <TableHead className="text-right">{t("Annual Revenue", "Godišnji prihod")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(0, 100).map((p: any) => (
                <TableRow key={p.product_id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.sku || "—"}</TableCell>
                  <TableCell>
                    <Badge className={`${CLASS_COLORS[p.class]} text-white`}>{p.class}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.abc === "A" ? "default" : p.abc === "B" ? "secondary" : "outline"}>{p.abc}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.xyz === "X" ? "default" : p.xyz === "Y" ? "secondary" : "outline"}>{p.xyz}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{fmtNum(p.annual_revenue)}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    {t("No products to display", "Nema proizvoda za prikaz")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </>
      )}

      {!result && !runClassification.isPending && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Grid3X3 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t("No classification data", "Nema podataka o klasifikaciji")}</h3>
            <p className="text-muted-foreground mb-4">
              {t("Click 'Run Classification' to analyze your inventory", "Kliknite 'Pokreni klasifikaciju' za analizu zaliha")}
            </p>
          </CardContent>
        </Card>
      )}

      {runClassification.isPending && <Skeleton className="h-64 w-full" />}
    </div>
  );
}
