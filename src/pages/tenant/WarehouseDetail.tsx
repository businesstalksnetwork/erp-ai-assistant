import { useParams } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, ArrowLeftRight, Truck } from "lucide-react";

export default function WarehouseDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const { tenantId } = useTenant();

  const { data: warehouse } = useQuery({
    queryKey: ["warehouse", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("warehouses").select("*, locations(name)").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: stock = [] } = useQuery({
    queryKey: ["warehouse-stock", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_stock")
        .select("*, products(name, sku, unit_of_measure)")
        .eq("warehouse_id", id!)
        .eq("tenant_id", tenantId!)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!tenantId,
  });

  const { data: movements = [] } = useQuery({
    queryKey: ["warehouse-movements", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_movements")
        .select("*, products(name, sku)")
        .eq("warehouse_id", id!)
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!tenantId,
  });

  const { data: outTransfers = [] } = useQuery({
    queryKey: ["warehouse-out-transfers", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("internal_transfers")
        .select("*, to_wh:to_warehouse_id(name)")
        .eq("from_warehouse_id", id!)
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!tenantId,
  });

  const { data: inTransfers = [] } = useQuery({
    queryKey: ["warehouse-in-transfers", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("internal_transfers")
        .select("*, from_wh:from_warehouse_id(name)")
        .eq("to_warehouse_id", id!)
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!tenantId,
  });

  const { data: pendingOrders = [] } = useQuery({
    queryKey: ["warehouse-pending-orders", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("internal_orders")
        .select("*, locations:requesting_location_id(name)")
        .eq("source_warehouse_id", id!)
        .eq("tenant_id", tenantId!)
        .in("status", ["draft", "submitted", "approved"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!tenantId,
  });

  const fmtNum = (n: number) => n.toLocaleString("sr-RS", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  if (!warehouse) return <div className="p-6">{t("loading")}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{warehouse.name}</h1>
        <p className="text-muted-foreground">
          {warehouse.code ? `${warehouse.code} · ` : ""}{(warehouse as any).locations?.name || ""}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Package className="h-4 w-4" />{t("products")}</div>
          <div className="text-2xl font-bold mt-1">{stock.length}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeftRight className="h-4 w-4" />{t("movementHistory")}</div>
          <div className="text-2xl font-bold mt-1">{movements.length}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Truck className="h-4 w-4" />{t("pendingOrders")}</div>
          <div className="text-2xl font-bold mt-1">{pendingOrders.length}</div>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">{t("products")}</TabsTrigger>
          <TabsTrigger value="movements">{t("movementHistory")}</TabsTrigger>
          <TabsTrigger value="outgoing">{t("outgoingTransfers")}</TabsTrigger>
          <TabsTrigger value="incoming">{t("incomingTransfers")}</TabsTrigger>
          <TabsTrigger value="orders">{t("pendingOrders")}</TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>{t("product")}</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">{t("onHand")}</TableHead>
                <TableHead className="text-right">{t("reserved")}</TableHead>
                <TableHead className="text-right">{t("available")}</TableHead>
                <TableHead className="text-right">{t("minLevel")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {stock.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{(s.products as any)?.name}</TableCell>
                    <TableCell>{(s.products as any)?.sku || "—"}</TableCell>
                    <TableCell className="text-right font-mono">{fmtNum(Number(s.quantity_on_hand))}</TableCell>
                    <TableCell className="text-right font-mono">{fmtNum(Number(s.quantity_reserved))}</TableCell>
                    <TableCell className="text-right font-mono">{fmtNum(Number(s.quantity_on_hand) - Number(s.quantity_reserved))}</TableCell>
                    <TableCell className="text-right">{fmtNum(Number(s.min_stock_level))}</TableCell>
                  </TableRow>
                ))}
                {stock.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="movements">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{t("product")}</TableHead>
                <TableHead>{t("type")}</TableHead>
                <TableHead className="text-right">{t("quantity")}</TableHead>
                <TableHead>{t("reference")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {movements.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell>{new Date(m.created_at).toLocaleDateString("sr-RS")}</TableCell>
                    <TableCell className="font-medium">{(m.products as any)?.name}</TableCell>
                    <TableCell><Badge variant={m.movement_type === "in" ? "default" : "secondary"}>{m.movement_type}</Badge></TableCell>
                    <TableCell className="text-right font-mono">{fmtNum(Number(m.quantity))}</TableCell>
                    <TableCell>{m.reference || "—"}</TableCell>
                  </TableRow>
                ))}
                {movements.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="outgoing">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>{t("transferNumber")}</TableHead>
                <TableHead>{t("toWarehouse")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("date")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {outTransfers.map((tr: any) => (
                  <TableRow key={tr.id}>
                    <TableCell className="font-medium">{tr.transfer_number}</TableCell>
                    <TableCell>{(tr.to_wh as any)?.name}</TableCell>
                    <TableCell><Badge variant="secondary">{tr.status}</Badge></TableCell>
                    <TableCell>{new Date(tr.created_at).toLocaleDateString("sr-RS")}</TableCell>
                  </TableRow>
                ))}
                {outTransfers.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="incoming">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>{t("transferNumber")}</TableHead>
                <TableHead>{t("fromWarehouse")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("date")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {inTransfers.map((tr: any) => (
                  <TableRow key={tr.id}>
                    <TableCell className="font-medium">{tr.transfer_number}</TableCell>
                    <TableCell>{(tr.from_wh as any)?.name}</TableCell>
                    <TableCell><Badge variant="secondary">{tr.status}</Badge></TableCell>
                    <TableCell>{new Date(tr.created_at).toLocaleDateString("sr-RS")}</TableCell>
                  </TableRow>
                ))}
                {inTransfers.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="orders">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>{t("orderNumber")}</TableHead>
                <TableHead>{t("requestingLocation")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("date")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {pendingOrders.map((o: any) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.order_number}</TableCell>
                    <TableCell>{(o.locations as any)?.name || "—"}</TableCell>
                    <TableCell><Badge variant="secondary">{o.status}</Badge></TableCell>
                    <TableCell>{new Date(o.created_at).toLocaleDateString("sr-RS")}</TableCell>
                  </TableRow>
                ))}
                {pendingOrders.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
