import { useMemo } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatsBar } from "@/components/shared/StatsBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Cog, AlertTriangle, CheckCircle, Package, ShoppingCart } from "lucide-react";
import { fmtNum } from "@/lib/utils";

export default function MrpEngine() {
  const { t, locale } = useLanguage();
  const { tenantId } = useTenant();

  // Fetch active production orders (planned + in_progress)
  const { data: activeOrders = [] } = useQuery({
    queryKey: ["mrp-orders", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("production_orders")
        .select("id, order_number, product_id, bom_template_id, quantity, completed_quantity, status, products(name)")
        .eq("tenant_id", tenantId!).in("status", ["planned", "in_progress"]);
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Fetch all BOM lines for active orders
  const { data: bomLines = [] } = useQuery({
    queryKey: ["mrp-bom-lines", activeOrders.map((o: any) => o.bom_template_id).join(",")],
    queryFn: async () => {
      const bomIds = [...new Set(activeOrders.map((o: any) => o.bom_template_id).filter(Boolean))];
      if (bomIds.length === 0) return [];
      const { data } = await supabase.from("bom_lines")
        .select("bom_template_id, material_product_id, quantity, unit, products(name)")
        .in("bom_template_id", bomIds);
      return data || [];
    },
    enabled: activeOrders.length > 0,
  });

  // Fetch current inventory stock
  const { data: stock = [] } = useQuery({
    queryKey: ["mrp-stock", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("inventory_stock")
        .select("product_id, quantity_on_hand, quantity_reserved")
        .eq("tenant_id", tenantId!);
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Fetch pending purchase orders
  const { data: pendingPOs = [] } = useQuery({
    queryKey: ["mrp-pending-po", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("purchase_order_lines")
        .select("product_id, quantity, purchase_orders!inner(tenant_id, status)")
        .eq("purchase_orders.tenant_id", tenantId!)
        .in("purchase_orders.status", ["draft", "sent", "confirmed"]);
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Compute MRP requirements
  const mrpData = useMemo(() => {
    const requirements: Record<string, { name: string; required: number; onHand: number; reserved: number; onOrder: number; net: number; unit: string }> = {};

    activeOrders.forEach((order: any) => {
      const remaining = (order.quantity || 0) - (order.completed_quantity || 0);
      if (remaining <= 0) return;
      const orderBomLines = bomLines.filter((l: any) => l.bom_template_id === order.bom_template_id);
      orderBomLines.forEach((line: any) => {
        const pid = line.material_product_id;
        if (!requirements[pid]) {
          requirements[pid] = { name: line.products?.name || "?", required: 0, onHand: 0, reserved: 0, onOrder: 0, net: 0, unit: line.unit || "pcs" };
        }
        requirements[pid].required += line.quantity * remaining;
      });
    });

    // Add stock info
    stock.forEach((s: any) => {
      if (requirements[s.product_id]) {
        requirements[s.product_id].onHand += s.quantity_on_hand || 0;
        requirements[s.product_id].reserved += s.quantity_reserved || 0;
      }
    });

    // Add pending PO info
    pendingPOs.forEach((po: any) => {
      if (requirements[po.product_id]) {
        requirements[po.product_id].onOrder += po.quantity || 0;
      }
    });

    // Calculate net requirement
    return Object.entries(requirements).map(([pid, data]) => {
      const available = data.onHand - data.reserved + data.onOrder;
      const net = Math.max(0, data.required - available);
      return { productId: pid, ...data, available, net };
    }).sort((a, b) => b.net - a.net);
  }, [activeOrders, bomLines, stock, pendingPOs]);

  const shortages = mrpData.filter(m => m.net > 0);
  const totalRequired = mrpData.reduce((s, m) => s + m.required, 0);
  const totalShortage = shortages.reduce((s, m) => s + m.net, 0);

  const stats = [
    { label: locale === "sr" ? "Aktivnih naloga" : "Active Orders", value: activeOrders.length, icon: Cog, color: "text-primary" },
    { label: locale === "sr" ? "Materijala" : "Materials", value: mrpData.length, icon: Package, color: "text-primary" },
    { label: locale === "sr" ? "Nedostaje" : "Shortages", value: shortages.length, icon: AlertTriangle, color: shortages.length > 0 ? "text-destructive" : "text-green-500" },
    { label: locale === "sr" ? "Ukupan manjak" : "Total Shortage", value: fmtNum(totalShortage), icon: ShoppingCart, color: "text-destructive" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={locale === "sr" ? "MRP Motor" : "MRP Engine"}
        description={locale === "sr" ? "Planiranje materijalnih potreba na osnovu aktivnih proizvodnih naloga" : "Material Requirements Planning based on active production orders"}
        icon={Cog}
      />

      <StatsBar stats={stats} />

      {shortages.length > 0 && (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {locale === "sr" ? "Materijali sa nedostatkom" : "Materials with Shortages"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {shortages.map(s => (
                <Badge key={s.productId} variant="destructive">{s.name}: -{fmtNum(s.net)} {s.unit}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>{locale === "sr" ? "Plan materijalnih potreba" : "Material Requirements Plan"}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{locale === "sr" ? "Materijal" : "Material"}</TableHead>
                <TableHead>{locale === "sr" ? "Potrebno" : "Required"}</TableHead>
                <TableHead>{locale === "sr" ? "Na stanju" : "On Hand"}</TableHead>
                <TableHead>{locale === "sr" ? "Rezervisano" : "Reserved"}</TableHead>
                <TableHead>{locale === "sr" ? "Na porudžbini" : "On Order"}</TableHead>
                <TableHead>{locale === "sr" ? "Raspoloživo" : "Available"}</TableHead>
                <TableHead>{locale === "sr" ? "Neto potreba" : "Net Requirement"}</TableHead>
                <TableHead>{t("status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mrpData.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">{locale === "sr" ? "Nema aktivnih naloga" : "No active orders"}</TableCell></TableRow>
              ) : mrpData.map(m => (
                <TableRow key={m.productId}>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell>{fmtNum(m.required)} {m.unit}</TableCell>
                  <TableCell>{fmtNum(m.onHand)}</TableCell>
                  <TableCell>{fmtNum(m.reserved)}</TableCell>
                  <TableCell>{fmtNum(m.onOrder)}</TableCell>
                  <TableCell>{fmtNum(m.available)}</TableCell>
                  <TableCell className={m.net > 0 ? "text-destructive font-bold" : "text-green-600"}>
                    {m.net > 0 ? fmtNum(m.net) : "✓"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={m.net > 0 ? "destructive" : "default"}>
                      {m.net > 0 ? (locale === "sr" ? "Nedostaje" : "Shortage") : (locale === "sr" ? "OK" : "OK")}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
