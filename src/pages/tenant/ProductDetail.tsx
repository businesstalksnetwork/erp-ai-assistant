import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Package, DollarSign, Warehouse } from "lucide-react";
import { Button } from "@/components/ui/button";

const fmtNum = (n: number) => n.toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const calcMargin = (price: number, base: number) => base > 0 ? (((price - base) / base) * 100).toFixed(1) + "%" : "—";

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const { tenantId } = useTenant();

  const { data: product } = useQuery({
    queryKey: ["product-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: retailPrices = [] } = useQuery({
    queryKey: ["product-retail-prices", id, tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("retail_prices" as any)
        .select("*, retail_price_lists!inner(name, tenant_id)")
        .eq("product_id", id!)
        .eq("retail_price_lists.tenant_id", tenantId!);
      return (data as any[]) || [];
    },
    enabled: !!id && !!tenantId,
  });

  const { data: webPrices = [] } = useQuery({
    queryKey: ["product-web-prices", id, tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("web_prices" as any)
        .select("*, web_price_lists(name)")
        .eq("product_id", id!)
        .eq("tenant_id", tenantId!);
      return (data as any[]) || [];
    },
    enabled: !!id && !!tenantId,
  });

  const { data: stockLevels = [] } = useQuery({
    queryKey: ["product-stock", id, tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("inventory_stock")
        .select("*, warehouses(name)")
        .eq("product_id", id!)
        .eq("tenant_id", tenantId!);
      return (data as any[]) || [];
    },
    enabled: !!id && !!tenantId,
  });

  const { data: recentMovements = [] } = useQuery({
    queryKey: ["product-movements", id, tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("inventory_movements")
        .select("*, warehouses(name)")
        .eq("product_id", id!)
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false })
        .limit(10);
      return (data as any[]) || [];
    },
    enabled: !!id && !!tenantId,
  });

  if (!product) {
    return <div className="p-6 text-muted-foreground">{t("noResults")}</div>;
  }

  const wholesalePrice = Number(product.default_sale_price);
  const purchasePrice = Number(product.default_purchase_price);
  const totalOnHand = stockLevels.reduce((s: number, r: any) => s + Number(r.quantity_on_hand || 0), 0);
  const totalReserved = stockLevels.reduce((s: number, r: any) => s + Number(r.quantity_reserved || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/inventory/products"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{product.name}</h1>
          {product.name_sr && <p className="text-muted-foreground">{product.name_sr}</p>}
        </div>
        <div className="flex gap-2">
          {product.sku && <Badge variant="outline">SKU: {product.sku}</Badge>}
          {product.barcode && <Badge variant="outline">{product.barcode}</Badge>}
          <Badge variant={product.is_active ? "default" : "secondary"}>
            {product.is_active ? t("active") : t("inactive")}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview"><Package className="h-4 w-4 mr-1" />{t("overview")}</TabsTrigger>
          <TabsTrigger value="pricing"><DollarSign className="h-4 w-4 mr-1" />{t("pricing")}</TabsTrigger>
          <TabsTrigger value="inventory"><Warehouse className="h-4 w-4 mr-1" />{t("inventory")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>{t("details")}</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">{t("unitOfMeasure")}</span><span>{product.unit_of_measure}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t("costingMethod")}</span><span>{product.costing_method === "fifo" ? t("fifo") : t("weightedAverage")}</span></div>
                {product.description && <div className="pt-2 border-t"><p className="text-muted-foreground">{product.description}</p></div>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>{t("defaultPrices")}</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">{t("purchasePrice")}</span><span className="font-mono">{fmtNum(purchasePrice)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t("wholesalePrice")}</span><span className="font-mono">{fmtNum(wholesalePrice)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t("markup")}</span><span className="font-mono">{calcMargin(wholesalePrice, purchasePrice)}</span></div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="pricing">
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Wholesale */}
            <Card>
              <CardHeader><CardTitle className="text-base">{t("wholesalePrice")}</CardTitle></CardHeader>
              <CardContent>
                <p className="text-3xl font-bold font-mono">{fmtNum(wholesalePrice)}</p>
                <p className="text-sm text-muted-foreground mt-1">{t("markup")} vs {t("purchasePrice")}: {calcMargin(wholesalePrice, purchasePrice)}</p>
              </CardContent>
            </Card>

            {/* Retail */}
            <Card>
              <CardHeader><CardTitle className="text-base">{t("retailPrices")}</CardTitle></CardHeader>
              <CardContent>
                {retailPrices.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("noResults")}</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("priceList")}</TableHead>
                        <TableHead className="text-right">{t("retailPrice")}</TableHead>
                        <TableHead className="text-right">{t("markup")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {retailPrices.map((rp: any) => (
                        <TableRow key={rp.id}>
                          <TableCell>{rp.retail_price_lists?.name || "—"}</TableCell>
                          <TableCell className="text-right font-mono">{fmtNum(Number(rp.retail_price))}</TableCell>
                          <TableCell className="text-right font-mono">{calcMargin(Number(rp.retail_price), wholesalePrice)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Web */}
            <Card>
              <CardHeader><CardTitle className="text-base">{t("webPrices")}</CardTitle></CardHeader>
              <CardContent>
                {webPrices.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("noResults")}</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("priceList")}</TableHead>
                        <TableHead className="text-right">{t("webPrice")}</TableHead>
                        <TableHead className="text-right">{t("compareAtPrice")}</TableHead>
                        <TableHead className="text-right">{t("markup")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {webPrices.map((wp: any) => (
                        <TableRow key={wp.id}>
                          <TableCell>{wp.web_price_lists?.name || "—"}</TableCell>
                          <TableCell className="text-right font-mono">{fmtNum(Number(wp.price))}</TableCell>
                          <TableCell className="text-right font-mono">{wp.compare_at_price ? fmtNum(Number(wp.compare_at_price)) : "—"}</TableCell>
                          <TableCell className="text-right font-mono">{calcMargin(Number(wp.price), wholesalePrice)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="inventory">
          <div className="grid gap-4 md:grid-cols-3 mb-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">{t("totalOnHand")}</p>
                <p className="text-2xl font-bold font-mono">{fmtNum(totalOnHand)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">{t("reserved")}</p>
                <p className="text-2xl font-bold font-mono">{fmtNum(totalReserved)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">{t("available")}</p>
                <p className="text-2xl font-bold font-mono">{fmtNum(totalOnHand - totalReserved)}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">{t("stockByWarehouse")}</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("warehouse")}</TableHead>
                      <TableHead className="text-right">{t("onHand")}</TableHead>
                      <TableHead className="text-right">{t("reserved")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stockLevels.map((s: any) => (
                      <TableRow key={s.id}>
                        <TableCell>{s.warehouses?.name || "—"}</TableCell>
                        <TableCell className="text-right font-mono">{fmtNum(Number(s.quantity_on_hand))}</TableCell>
                        <TableCell className="text-right font-mono">{fmtNum(Number(s.quantity_reserved || 0))}</TableCell>
                      </TableRow>
                    ))}
                    {stockLevels.length === 0 && (
                      <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">{t("recentMovements")}</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("date")}</TableHead>
                      <TableHead>{t("type")}</TableHead>
                      <TableHead>{t("warehouse")}</TableHead>
                      <TableHead className="text-right">{t("quantity")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentMovements.map((m: any) => (
                      <TableRow key={m.id}>
                        <TableCell>{new Date(m.created_at).toLocaleDateString()}</TableCell>
                        <TableCell><Badge variant="outline">{m.movement_type}</Badge></TableCell>
                        <TableCell>{m.warehouses?.name || "—"}</TableCell>
                        <TableCell className={`text-right font-mono ${Number(m.quantity) > 0 ? "text-green-600" : "text-red-600"}`}>
                          {Number(m.quantity) > 0 ? "+" : ""}{fmtNum(Number(m.quantity))}
                        </TableCell>
                      </TableRow>
                    ))}
                    {recentMovements.length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
