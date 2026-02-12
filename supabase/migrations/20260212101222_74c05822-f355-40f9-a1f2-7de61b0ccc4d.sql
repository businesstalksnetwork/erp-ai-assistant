
-- 1. Products table
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_sr TEXT,
  sku TEXT,
  barcode TEXT,
  description TEXT,
  unit_of_measure TEXT NOT NULL DEFAULT 'pcs',
  default_purchase_price NUMERIC NOT NULL DEFAULT 0,
  default_sale_price NUMERIC NOT NULL DEFAULT 0,
  tax_rate_id UUID REFERENCES public.tax_rates(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view products" ON public.products FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant admins/accountants manage products" ON public.products FOR ALL
  USING (tenant_id IN (
    SELECT tenant_members.tenant_id FROM tenant_members
    WHERE tenant_members.user_id = auth.uid()
      AND tenant_members.role IN ('admin', 'accountant')
      AND tenant_members.status = 'active'
  ));

CREATE POLICY "Super admins manage products" ON public.products FOR ALL
  USING (is_super_admin(auth.uid()));

-- 2. Inventory Stock table
CREATE TABLE public.inventory_stock (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  quantity_on_hand NUMERIC NOT NULL DEFAULT 0,
  quantity_reserved NUMERIC NOT NULL DEFAULT 0,
  min_stock_level NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, warehouse_id)
);

ALTER TABLE public.inventory_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view inventory stock" ON public.inventory_stock FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant admins/accountants manage inventory stock" ON public.inventory_stock FOR ALL
  USING (tenant_id IN (
    SELECT tenant_members.tenant_id FROM tenant_members
    WHERE tenant_members.user_id = auth.uid()
      AND tenant_members.role IN ('admin', 'accountant')
      AND tenant_members.status = 'active'
  ));

CREATE POLICY "Super admins manage inventory stock" ON public.inventory_stock FOR ALL
  USING (is_super_admin(auth.uid()));

-- 3. Inventory Movements table
CREATE TABLE public.inventory_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL DEFAULT 'adjustment',
  quantity NUMERIC NOT NULL DEFAULT 0,
  reference TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view inventory movements" ON public.inventory_movements FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant admins/accountants manage inventory movements" ON public.inventory_movements FOR ALL
  USING (tenant_id IN (
    SELECT tenant_members.tenant_id FROM tenant_members
    WHERE tenant_members.user_id = auth.uid()
      AND tenant_members.role IN ('admin', 'accountant')
      AND tenant_members.status = 'active'
  ));

CREATE POLICY "Super admins manage inventory movements" ON public.inventory_movements FOR ALL
  USING (is_super_admin(auth.uid()));

-- 4. Add product_id to invoice_lines
ALTER TABLE public.invoice_lines ADD COLUMN product_id UUID REFERENCES public.products(id) ON DELETE SET NULL;

-- 5. Trigger to update updated_at on products
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Index for fast lookups
CREATE INDEX idx_products_tenant_id ON public.products(tenant_id);
CREATE INDEX idx_inventory_stock_tenant_id ON public.inventory_stock(tenant_id);
CREATE INDEX idx_inventory_movements_tenant_id ON public.inventory_movements(tenant_id);
CREATE INDEX idx_inventory_stock_product_warehouse ON public.inventory_stock(product_id, warehouse_id);
