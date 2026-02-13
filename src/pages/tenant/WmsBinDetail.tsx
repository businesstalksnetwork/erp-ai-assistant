import { useParams, useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Package, ArrowLeft } from "lucide-react";

export default function WmsBinDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const navigate = useNavigate();

  const { data: bin } = useQuery({
    queryKey: ["wms-bin", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("wms_bins").select("*, wms_zones(name, zone_type), wms_aisles(name), warehouses(name)").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!tenantId,
  });

  const { data: stock = [] } = useQuery({
    queryKey: ["wms-bin-stock", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("wms_bin_stock").select("*, products(name, sku)").eq("bin_id", id!).order("received_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!tenantId,
  });

  if (!bin) return <div className="p-6">{t("loading")}</div>;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-2"><ArrowLeft className="h-4 w-4 mr-1" />{t("back")}</Button>
      <PageHeader title={`Bin ${bin.code}`} description={`${(bin as any).warehouses?.name} · ${(bin as any).wms_zones?.name}`} icon={Package} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t("binType")}</CardTitle></CardHeader><CardContent className="text-lg font-semibold capitalize">{bin.bin_type}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t("level")} / {t("accessibilityScore")}</CardTitle></CardHeader><CardContent className="text-lg font-semibold">L{bin.level} · Score {bin.accessibility_score}/10</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t("capacity")}</CardTitle></CardHeader><CardContent className="text-lg font-semibold">{bin.max_units ?? "∞"} units · {bin.max_weight ?? "∞"} kg · {bin.max_volume ?? "∞"} m³</CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>{t("currentContents")}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>{t("product")}</TableHead><TableHead>SKU</TableHead><TableHead>{t("quantity")}</TableHead><TableHead>{t("status")}</TableHead><TableHead>{t("lot")}</TableHead><TableHead>{t("receivedAt")}</TableHead></TableRow></TableHeader>
            <TableBody>
              {stock.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>
              ) : stock.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.products?.name}</TableCell>
                  <TableCell className="font-mono text-xs">{s.products?.sku}</TableCell>
                  <TableCell>{s.quantity}</TableCell>
                  <TableCell><Badge variant={s.status === "available" ? "default" : "secondary"}>{s.status}</Badge></TableCell>
                  <TableCell>{s.lot_number || "—"}</TableCell>
                  <TableCell className="text-xs">{new Date(s.received_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
