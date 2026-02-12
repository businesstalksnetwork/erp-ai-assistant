
-- =============================================
-- PURCHASING MODULE: 5 tables
-- =============================================

-- 1. Purchase Orders
CREATE TABLE public.purchase_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  supplier_id uuid REFERENCES public.partners(id),
  supplier_name text NOT NULL DEFAULT '',
  order_number text NOT NULL,
  order_date date NOT NULL DEFAULT CURRENT_DATE,
  expected_date date,
  status text NOT NULL DEFAULT 'draft',
  currency text NOT NULL DEFAULT 'RSD',
  subtotal numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.purchase_orders FOR ALL
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- 2. Purchase Order Lines
CREATE TABLE public.purchase_order_lines (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id),
  description text NOT NULL DEFAULT '',
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_order_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation via purchase_orders" ON public.purchase_order_lines FOR ALL
  USING (purchase_order_id IN (
    SELECT id FROM public.purchase_orders WHERE tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  ));

-- 3. Goods Receipts
CREATE TABLE public.goods_receipts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  purchase_order_id uuid REFERENCES public.purchase_orders(id),
  warehouse_id uuid REFERENCES public.warehouses(id),
  receipt_number text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  received_by uuid,
  status text NOT NULL DEFAULT 'draft',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.goods_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.goods_receipts FOR ALL
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- 4. Goods Receipt Lines
CREATE TABLE public.goods_receipt_lines (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  goods_receipt_id uuid NOT NULL REFERENCES public.goods_receipts(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  quantity_ordered numeric NOT NULL DEFAULT 0,
  quantity_received numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.goods_receipt_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation via goods_receipts" ON public.goods_receipt_lines FOR ALL
  USING (goods_receipt_id IN (
    SELECT id FROM public.goods_receipts WHERE tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  ));

-- 5. Supplier Invoices
CREATE TABLE public.supplier_invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  purchase_order_id uuid REFERENCES public.purchase_orders(id),
  supplier_id uuid REFERENCES public.partners(id),
  supplier_name text NOT NULL DEFAULT '',
  invoice_number text NOT NULL,
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  amount numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'RSD',
  status text NOT NULL DEFAULT 'draft',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.supplier_invoices FOR ALL
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- updated_at triggers
CREATE TRIGGER set_updated_at_purchase_orders BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_updated_at_goods_receipts BEFORE UPDATE ON public.goods_receipts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_updated_at_supplier_invoices BEFORE UPDATE ON public.supplier_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Audit triggers on key tables
CREATE TRIGGER audit_purchase_orders AFTER INSERT OR UPDATE OR DELETE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

CREATE TRIGGER audit_supplier_invoices AFTER INSERT OR UPDATE OR DELETE ON public.supplier_invoices
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Event bus: emit events on status changes
CREATE OR REPLACE FUNCTION public.purchasing_event_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'purchase_orders' AND NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status <> 'confirmed') THEN
    PERFORM public.emit_module_event(NEW.tenant_id, 'purchase_order.confirmed', 'purchasing', 'purchase_order', NEW.id, 
      jsonb_build_object('order_number', NEW.order_number, 'supplier_name', NEW.supplier_name, 'total', NEW.total));
  END IF;
  IF TG_TABLE_NAME = 'goods_receipts' AND NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed') THEN
    PERFORM public.emit_module_event(NEW.tenant_id, 'goods_receipt.completed', 'purchasing', 'goods_receipt', NEW.id,
      jsonb_build_object('receipt_number', NEW.receipt_number, 'warehouse_id', NEW.warehouse_id, 'purchase_order_id', NEW.purchase_order_id));
  END IF;
  IF TG_TABLE_NAME = 'supplier_invoices' AND NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status <> 'approved') THEN
    PERFORM public.emit_module_event(NEW.tenant_id, 'supplier_invoice.approved', 'purchasing', 'supplier_invoice', NEW.id,
      jsonb_build_object('invoice_number', NEW.invoice_number, 'total', NEW.total));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER purchasing_events_po AFTER INSERT OR UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.purchasing_event_trigger();

CREATE TRIGGER purchasing_events_grn AFTER INSERT OR UPDATE ON public.goods_receipts
  FOR EACH ROW EXECUTE FUNCTION public.purchasing_event_trigger();

CREATE TRIGGER purchasing_events_si AFTER INSERT OR UPDATE ON public.supplier_invoices
  FOR EACH ROW EXECUTE FUNCTION public.purchasing_event_trigger();

-- Seed event bus subscriptions for purchasing
INSERT INTO public.module_event_subscriptions (event_type, handler_module, handler_function, is_active)
VALUES 
  ('goods_receipt.completed', 'inventory', 'process-module-event', true),
  ('purchase_order.confirmed', 'purchasing', 'process-module-event', true),
  ('supplier_invoice.approved', 'accounting', 'process-module-event', true);
