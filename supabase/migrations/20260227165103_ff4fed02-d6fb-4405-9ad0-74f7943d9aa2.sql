
-- =============================================
-- Phase 1: Product-Pricing Unification — Data Foundation
-- =============================================

-- 1. product_categories
CREATE TABLE public.product_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_sr TEXT,
  parent_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
  code TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_categories_tenant ON public.product_categories(tenant_id);
CREATE INDEX idx_product_categories_parent ON public.product_categories(parent_id);

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view product_categories" ON public.product_categories FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Members can insert product_categories" ON public.product_categories FOR INSERT
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Members can update product_categories" ON public.product_categories FOR UPDATE
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Members can delete product_categories" ON public.product_categories FOR DELETE
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- 2. Add category_id to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);

-- 3. purchase_prices
CREATE TABLE public.purchase_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'RSD',
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  quantity NUMERIC NOT NULL DEFAULT 0,
  document_ref TEXT,
  document_type TEXT NOT NULL DEFAULT 'manual',
  document_id UUID,
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_purchase_prices_tenant ON public.purchase_prices(tenant_id);
CREATE INDEX idx_purchase_prices_product ON public.purchase_prices(product_id);
CREATE INDEX idx_purchase_prices_partner ON public.purchase_prices(partner_id);
CREATE INDEX idx_purchase_prices_date ON public.purchase_prices(purchase_date DESC);

ALTER TABLE public.purchase_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view purchase_prices" ON public.purchase_prices FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Members can insert purchase_prices" ON public.purchase_prices FOR INSERT
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Members can update purchase_prices" ON public.purchase_prices FOR UPDATE
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Members can delete purchase_prices" ON public.purchase_prices FOR DELETE
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- 4. wholesale_price_lists
CREATE TABLE public.wholesale_price_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'RSD',
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  valid_from DATE,
  valid_until DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wholesale_price_lists_tenant ON public.wholesale_price_lists(tenant_id);

ALTER TABLE public.wholesale_price_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view wholesale_price_lists" ON public.wholesale_price_lists FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Members can insert wholesale_price_lists" ON public.wholesale_price_lists FOR INSERT
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Members can update wholesale_price_lists" ON public.wholesale_price_lists FOR UPDATE
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Members can delete wholesale_price_lists" ON public.wholesale_price_lists FOR DELETE
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- Trigger: only one default wholesale price list per tenant
CREATE OR REPLACE FUNCTION public.ensure_single_default_wholesale_list()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.wholesale_price_lists
    SET is_default = false
    WHERE tenant_id = NEW.tenant_id AND id != NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_single_default_wholesale_list
  BEFORE INSERT OR UPDATE ON public.wholesale_price_lists
  FOR EACH ROW EXECUTE FUNCTION public.ensure_single_default_wholesale_list();

-- 5. wholesale_prices
CREATE TABLE public.wholesale_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  price_list_id UUID NOT NULL REFERENCES public.wholesale_price_lists(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  price NUMERIC NOT NULL DEFAULT 0,
  min_quantity NUMERIC NOT NULL DEFAULT 1,
  discount_percent NUMERIC NOT NULL DEFAULT 0,
  valid_from DATE,
  valid_until DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(price_list_id, product_id, min_quantity)
);

CREATE INDEX idx_wholesale_prices_tenant ON public.wholesale_prices(tenant_id);
CREATE INDEX idx_wholesale_prices_product ON public.wholesale_prices(product_id);
CREATE INDEX idx_wholesale_prices_list ON public.wholesale_prices(price_list_id);

ALTER TABLE public.wholesale_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view wholesale_prices" ON public.wholesale_prices FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Members can insert wholesale_prices" ON public.wholesale_prices FOR INSERT
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Members can update wholesale_prices" ON public.wholesale_prices FOR UPDATE
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Members can delete wholesale_prices" ON public.wholesale_prices FOR DELETE
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- 6. ALTER production_orders — add cost columns
ALTER TABLE public.production_orders
  ADD COLUMN IF NOT EXISTS planned_material_cost NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_material_cost NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_labor_cost NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_overhead_cost NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unit_production_cost NUMERIC DEFAULT 0;

-- 7. ALTER bom_lines — add estimated_unit_cost
ALTER TABLE public.bom_lines
  ADD COLUMN IF NOT EXISTS estimated_unit_cost NUMERIC DEFAULT 0;
