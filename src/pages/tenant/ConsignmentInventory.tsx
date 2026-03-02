import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Package, Plus, ArrowRight, RotateCcw } from "lucide-react";
import { fmtNum } from "@/lib/utils";
import { toast } from "sonner";
import { useWarehouses } from "@/hooks/useWarehouses";

export default function ConsignmentInventory() {
  const { locale } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const sr = locale === "sr";
  const t = (en: string, srText: string) => sr ? srText : en;
  const { data: warehouses } = useWarehouses();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ supplier_id: "", product_id: "", warehouse_id: "", quantity: 0, unit_cost: 0 });

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers-consign", tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<any[]> => {
      const { data } = await (supabase as any).from("partners").select("id, name").eq("tenant_id", tenantId!).eq("is_supplier", true).order("name");
      return data || [];
    },
  });

  const { data: products } = useQuery({
    queryKey: ["products-consign", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name").eq("tenant_id", tenantId!).eq("is_active", true).limit(200);
      return data || [];
    },
  });

  const { data: stock, isLoading } = useQuery({
    queryKey: ["consignment-stock", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("consignment_stock")
        .select("*, products(name), partners:supplier_id(name), warehouses(name)")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const addStock = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("consignment_stock").insert({
        ...form,
        tenant_id: tenantId!,
        status: "consigned",
        received_date: new Date().toISOString().split("T")[0],
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["consignment-stock"] });
      setOpen(false);
      setForm({ supplier_id: "", product_id: "", warehouse_id: "", quantity: 0, unit_cost: 0 });
      toast.success(t("Consignment stock added", "Konsignacijska zaliha dodata"));
    },
    onError: () => toast.error(t("Failed to add stock", "Neuspelo dodavanje")),
  });

  const consumeStock = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("consignment_stock")
        .update({ status: "consumed", consumed_date: new Date().toISOString().split("T")[0] })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["consignment-stock"] });
      toast.success(t("Converted to owned stock", "Konvertovano u sopstvenu zalihu"));
    },
  });

  const returnStock = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("consignment_stock")
        .update({ status: "returned" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["consignment-stock"] });
      toast.success(t("Stock marked as returned", "Zaliha označena kao vraćena"));
    },
  });

  const consignedItems = (stock || []).filter((s: any) => s.status === "consigned");
  const totalConsignedValue = consignedItems.reduce((a: number, s: any) => a + (s.quantity || 0) * (s.unit_cost || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Consignment Inventory", "Konsignacijske zalihe")}
        description={t("Track supplier-owned stock in your warehouses", "Pratite zalihe u vlasništvu dobavljača u vašim magacinima")}
      />

      <div className="flex items-center gap-3">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />{t("Receive Consignment", "Prijem konsignacije")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("Add Consignment Stock", "Dodaj konsignacijsku zalihu")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{t("Supplier", "Dobavljač")}</Label>
                <Select value={form.supplier_id} onValueChange={v => setForm(f => ({ ...f, supplier_id: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{(suppliers || []).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("Product", "Proizvod")}</Label>
                <Select value={form.product_id} onValueChange={v => setForm(f => ({ ...f, product_id: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{(products || []).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("Warehouse", "Magacin")}</Label>
                <Select value={form.warehouse_id} onValueChange={v => setForm(f => ({ ...f, warehouse_id: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{(warehouses || []).map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t("Quantity", "Količina")}</Label>
                  <Input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: Number(e.target.value) }))} />
                </div>
                <div>
                  <Label>{t("Unit Cost", "Jed. cena")}</Label>
                  <Input type="number" step="0.01" value={form.unit_cost} onChange={e => setForm(f => ({ ...f, unit_cost: Number(e.target.value) }))} />
                </div>
              </div>
              <Button onClick={() => addStock.mutate()} disabled={!form.supplier_id || !form.product_id} className="w-full">
                {t("Add Consignment", "Dodaj konsignaciju")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("Consigned Items", "Konsignirani artikli")}</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{consignedItems.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("Total Consigned Value", "Ukupna konsig. vrednost")}</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{fmtNum(totalConsignedValue)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("Total Records", "Ukupno zapisa")}</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{(stock || []).length}</div></CardContent>
        </Card>
      </div>

      {isLoading ? <Skeleton className="h-64 w-full" /> : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("Product", "Proizvod")}</TableHead>
              <TableHead>{t("Supplier", "Dobavljač")}</TableHead>
              <TableHead>{t("Warehouse", "Magacin")}</TableHead>
              <TableHead className="text-right">{t("Quantity", "Količina")}</TableHead>
              <TableHead className="text-right">{t("Unit Cost", "Jed. cena")}</TableHead>
              <TableHead className="text-right">{t("Total", "Ukupno")}</TableHead>
              <TableHead>{t("Received", "Primljeno")}</TableHead>
              <TableHead>{t("Status", "Status")}</TableHead>
              <TableHead>{t("Actions", "Akcije")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(stock || []).map((s: any) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.products?.name || "—"}</TableCell>
                <TableCell>{s.partners?.name || "—"}</TableCell>
                <TableCell>{s.warehouses?.name || "—"}</TableCell>
                <TableCell className="text-right">{fmtNum(Number(s.quantity) || 0)}</TableCell>
                <TableCell className="text-right">{fmtNum(Number(s.unit_cost) || 0)}</TableCell>
                <TableCell className="text-right">{fmtNum(Number(s.quantity || 0) * Number(s.unit_cost || 0))}</TableCell>
                <TableCell>{s.received_date}</TableCell>
                <TableCell>
                  <Badge variant={s.status === "consigned" ? "default" : s.status === "consumed" ? "secondary" : "outline"}>
                    {s.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {s.status === "consigned" && (
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" onClick={() => consumeStock.mutate(s.id)} title={t("Convert to owned", "Konvertuj u sopstveno")}>
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => returnStock.mutate(s.id)} title={t("Return", "Vrati")}>
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {(stock || []).length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  {t("No consignment stock", "Nema konsignacijskih zaliha")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
