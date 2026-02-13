
-- 1. Create web_connections table
CREATE TABLE IF NOT EXISTS public.web_connections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  platform text NOT NULL DEFAULT 'shopify',
  store_url text NOT NULL,
  api_key text,
  api_secret text,
  access_token text,
  webhook_secret text,
  is_active boolean NOT NULL DEFAULT false,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.web_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view web_connections"
  ON public.web_connections FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant admins can insert web_connections"
  ON public.web_connections FOR INSERT
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant admins can update web_connections"
  ON public.web_connections FOR UPDATE
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant admins can delete web_connections"
  ON public.web_connections FOR DELETE
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- 2. Create web_price_lists table
CREATE TABLE IF NOT EXISTS public.web_price_lists (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  web_connection_id uuid REFERENCES public.web_connections(id) ON DELETE SET NULL,
  name text NOT NULL,
  currency text NOT NULL DEFAULT 'RSD',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.web_price_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view web_price_lists"
  ON public.web_price_lists FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant admins can insert web_price_lists"
  ON public.web_price_lists FOR INSERT
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant admins can update web_price_lists"
  ON public.web_price_lists FOR UPDATE
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant admins can delete web_price_lists"
  ON public.web_price_lists FOR DELETE
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- 3. Create web_prices table
CREATE TABLE IF NOT EXISTS public.web_prices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  web_price_list_id uuid NOT NULL REFERENCES public.web_price_lists(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  price numeric NOT NULL DEFAULT 0,
  compare_at_price numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(web_price_list_id, product_id)
);

ALTER TABLE public.web_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view web_prices"
  ON public.web_prices FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant admins can insert web_prices"
  ON public.web_prices FOR INSERT
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant admins can update web_prices"
  ON public.web_prices FOR UPDATE
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant admins can delete web_prices"
  ON public.web_prices FOR DELETE
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- 4. Add FK constraints on existing tables (safe: IF NOT EXISTS pattern via DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_web_sync_logs_connection'
  ) THEN
    ALTER TABLE public.web_sync_logs
      ADD CONSTRAINT fk_web_sync_logs_connection
      FOREIGN KEY (web_connection_id) REFERENCES public.web_connections(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_sales_orders_web_connection'
  ) THEN
    ALTER TABLE public.sales_orders
      ADD CONSTRAINT fk_sales_orders_web_connection
      FOREIGN KEY (web_connection_id) REFERENCES public.web_connections(id);
  END IF;
END $$;
