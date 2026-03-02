import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FormField, FormItem, FormLabel, FormControl } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UseFormReturn } from "react-hook-form";

interface Props {
  form: UseFormReturn<any>;
}

export function AssetPurchasingFields({ form }: Props) {
  const { t } = useLanguage();
  const { tenantId } = useTenant();

  const { data: suppliers = [] } = useQuery({
    queryKey: ["partners-suppliers", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("partners").select("id, name").eq("tenant_id", tenantId!).order("name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-list", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("employees").select("id, full_name").eq("tenant_id", tenantId!).eq("status", "active").order("full_name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses-list", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("warehouses").select("id, name").eq("tenant_id", tenantId!).eq("is_active", true).order("name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-list", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name, sku").eq("tenant_id", tenantId!).eq("is_active", true).order("name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ["po-list", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("purchase_orders").select("id, order_number").eq("tenant_id", tenantId!).order("order_number", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: goodsReceipts = [] } = useQuery({
    queryKey: ["gr-list", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("goods_receipts").select("id, receipt_number").eq("tenant_id", tenantId!).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: supplierInvoices = [] } = useQuery({
    queryKey: ["si-list", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("supplier_invoices").select("id, invoice_number").eq("tenant_id", tenantId!).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const renderSelect = (name: string, label: string, options: { id: string; label: string }[]) => (
    <FormField control={form.control} name={name} render={({ field }) => (
      <FormItem>
        <FormLabel>{label}</FormLabel>
        <Select value={field.value || "__none"} onValueChange={(v) => field.onChange(v === "__none" ? null : v)}>
          <FormControl><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger></FormControl>
          <SelectContent>
            <SelectItem value="__none">—</SelectItem>
            {options.map(o => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </FormItem>
    )} />
  );

  return (
    <>
      <Card>
        <CardHeader><CardTitle>{t("assetsCrossSupplier")}</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {renderSelect("supplier_id", t("supplier"), suppliers.map((s: any) => ({ id: s.id, label: s.name })))}
          {renderSelect("responsible_employee_id", t("assetsCrossEmployee"), employees.map((e: any) => ({ id: e.id, label: e.full_name })))}
          {renderSelect("warehouse_id", t("warehouse"), warehouses.map((w: any) => ({ id: w.id, label: w.name })))}
          {renderSelect("product_id", t("product"), products.map((p: any) => ({ id: p.id, label: `${p.sku ? p.sku + ' — ' : ''}${p.name}` })))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("assetsCrossPurchasing")}</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {renderSelect("purchase_order_id", t("purchaseOrder"), purchaseOrders.map((po: any) => ({ id: po.id, label: po.order_number })))}
          {renderSelect("goods_receipt_id", t("goodsReceipt"), goodsReceipts.map((gr: any) => ({ id: gr.id, label: gr.receipt_number })))}
          {renderSelect("supplier_invoice_id", t("supplierInvoice"), supplierInvoices.map((si: any) => ({ id: si.id, label: si.invoice_number })))}
        </CardContent>
      </Card>
    </>
  );
}
