import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AiAnalyticsNarrative } from "@/components/ai/AiAnalyticsNarrative";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package, AlertTriangle } from "lucide-react";
import { fmtNum } from "@/lib/utils";

export default function InventoryHealth() {
  const { locale } = useLanguage();
  const { tenantId } = useTenant();
  const sr = locale === "sr";
  const t = (en: string, srText: string) => sr ? srText : en;

  const { data, isLoading } = useQuery({
    queryKey: ["inventory-health", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      // Get inventory stock
      const { data: stock } = await (supabase
        .from("inventory_stock")
        .select("id, product_id, warehouse_id, quantity_on_hand, min_stock_level")
        .eq("tenant_id", tenantId!) as any);

      const { data: products } = await (supabase
        .from("products")
        .select("id, name, purchase_price, sale_price")
        .eq("tenant_id", tenantId!) as any);

      const { data: movements } = await (supabase
        .from("inventory_movements")
        .select("product_id, movement_type, quantity, created_at")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false }) as any);

      const productMap = new Map((products as any[] || []).map((p: any) => [p.id, p]));
      const now = new Date();

      // Last movement per product
      const lastMovement = new Map<string, Date>();
      const monthlyOutbound = new Map<string, number>();
      for (const m of movements || []) {
        if (!lastMovement.has(m.product_id)) {
          lastMovement.set(m.product_id, new Date(m.created_at));
        }
        if (m.movement_type === "out" || m.movement_type === "sale") {
          const monthKey = m.product_id;
          monthlyOutbound.set(monthKey, (monthlyOutbound.get(monthKey) || 0) + Math.abs(Number(m.quantity) || 0));
        }
      }

      // Aggregate by product
      const productStock = new Map<string, number>();
      for (const s of stock || []) {
        productStock.set(s.product_id, (productStock.get(s.product_id) || 0) + (Number(s.quantity_on_hand) || 0));
      }

      let totalValue = 0;
      let deadStockCount = 0;
      let overstockCount = 0;
      const items: Array<{ name: string; qty: number; value: number; daysSinceMovement: number; isDead: boolean; isOverstock: boolean }> = [];

      for (const [productId, qty] of productStock) {
        const product = productMap.get(productId) as any;
        if (!product || qty <= 0) continue;

        const price = Number(product?.purchase_price) || Number(product?.sale_price) || 0;
        const value = qty * price;
        totalValue += value;

        const lastDate = lastMovement.get(productId);
        const daysSince = lastDate ? Math.floor((now.getTime() - lastDate.getTime()) / 86400000) : 999;

        const isDead = daysSince >= 180;
        if (isDead) deadStockCount++;

        // Overstock: qty > 3x average monthly consumption (simplified: total outbound / months)
        const totalOut = monthlyOutbound.get(productId) || 0;
        const avgMonthly = totalOut / 12; // rough average
        const isOverstock = avgMonthly > 0 && qty > avgMonthly * 3;
        if (isOverstock) overstockCount++;

        items.push({
          name: product?.name || "Unknown",
          qty: Math.round(qty),
          value: Math.round(value),
          daysSinceMovement: daysSince,
          isDead,
          isOverstock,
        });
      }

      items.sort((a, b) => b.daysSinceMovement - a.daysSinceMovement);

      // Turnover ratio: total outbound value / average inventory value
      const totalOutboundQty = Array.from(monthlyOutbound.values()).reduce((a, b) => a + b, 0);
      const avgPrice = items.length > 0 ? items.reduce((s, i) => s + (i.qty > 0 ? i.value / i.qty : 0), 0) / items.length : 0;
      const cogsEstimate = totalOutboundQty * avgPrice;
      const turnoverRatio = totalValue > 0 ? (cogsEstimate / totalValue).toFixed(1) : "0";

      return {
        totalValue: Math.round(totalValue),
        productCount: items.length,
        deadStockCount,
        overstockCount,
        turnoverRatio,
        items: items.slice(0, 30),
      };
    },
  });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="space-y-6">
      <PageHeader title={t("Inventory Health Analysis", "Analiza zdravlja zaliha")} icon={Package} />

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase">{t("Total Value", "Ukupna vrednost")}</p><p className="text-2xl font-bold mt-1">{fmtNum(data?.totalValue || 0)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase">{t("Products", "Proizvodi")}</p><p className="text-2xl font-bold mt-1">{data?.productCount || 0}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase">{t("Dead Stock (180+ days)", "Mrtve zalihe (180+ dana)")}</p><p className={`text-2xl font-bold mt-1 ${(data?.deadStockCount || 0) > 0 ? "text-destructive" : ""}`}>{data?.deadStockCount || 0}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase">{t("Overstock Items", "Stavke viška")}</p><p className={`text-2xl font-bold mt-1 ${(data?.overstockCount || 0) > 0 ? "text-orange-600" : ""}`}>{data?.overstockCount || 0}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">{t("Products by Days Since Last Movement", "Proizvodi po danima od poslednjeg kretanja")}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Product", "Proizvod")}</TableHead>
                <TableHead className="text-right">{t("Qty", "Kol.")}</TableHead>
                <TableHead className="text-right">{t("Value", "Vrednost")}</TableHead>
                <TableHead className="text-right">{t("Days Idle", "Dana neaktivno")}</TableHead>
                <TableHead>{t("Status", "Status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.items || []).map((item, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-right">{item.qty}</TableCell>
                  <TableCell className="text-right">{fmtNum(item.value)}</TableCell>
                  <TableCell className="text-right">{item.daysSinceMovement >= 999 ? "∞" : item.daysSinceMovement}</TableCell>
                  <TableCell>
                    {item.isDead && <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 mr-1">{t("Dead", "Mrtvo")}</Badge>}
                    {item.isOverstock && <Badge variant="outline" className="bg-orange-500/10 text-orange-700 border-orange-500/20">{t("Overstock", "Višak")}</Badge>}
                    {!item.isDead && !item.isOverstock && <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/20">{t("Healthy", "Zdravo")}</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {tenantId && data && (
        <AiAnalyticsNarrative
          tenantId={tenantId}
          contextType="inventory_health"
          data={{
            totalValue: data.totalValue,
            productCount: data.productCount,
            deadStockCount: data.deadStockCount,
            overstockCount: data.overstockCount,
            topDeadStock: data.items.filter(i => i.isDead).slice(0, 5).map(i => ({ name: i.name, value: i.value, daysIdle: i.daysSinceMovement })),
          }}
        />
      )}
    </div>
  );
}
