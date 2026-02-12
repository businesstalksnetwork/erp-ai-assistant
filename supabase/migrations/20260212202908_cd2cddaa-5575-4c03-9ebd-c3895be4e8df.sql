
-- =============================================
-- Phase 26: Multi-Store Retail/Wholesale Engine
-- =============================================

-- 1.1 Salespeople registry
CREATE TABLE public.salespeople (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  employee_id uuid REFERENCES public.employees(id),
  first_name text NOT NULL,
  last_name text NOT NULL,
  code text NOT NULL,
  email text,
  phone text,
  commission_rate numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, code)
);
ALTER TABLE public.salespeople ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.salespeople FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));

-- 1.2 Sales targets
CREATE TABLE public.sales_targets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  salesperson_id uuid NOT NULL REFERENCES public.salespeople(id) ON DELETE CASCADE,
  year int NOT NULL,
  month int,
  quarter int,
  target_amount numeric NOT NULL DEFAULT 0,
  target_type text NOT NULL DEFAULT 'revenue',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sales_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.sales_targets FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));

-- 1.3 Fiscal devices
CREATE TABLE public.fiscal_devices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  legal_entity_id uuid REFERENCES public.legal_entities(id),
  location_id uuid REFERENCES public.locations(id),
  device_name text NOT NULL,
  device_type text NOT NULL DEFAULT 'pfr',
  ib_number text NOT NULL DEFAULT '',
  jid text,
  api_url text,
  pac text,
  location_name text NOT NULL DEFAULT '',
  location_address text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fiscal_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.fiscal_devices FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));

-- 1.4 Fiscal receipts
CREATE TABLE public.fiscal_receipts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  fiscal_device_id uuid NOT NULL REFERENCES public.fiscal_devices(id),
  pos_transaction_id uuid REFERENCES public.pos_transactions(id),
  invoice_id uuid REFERENCES public.invoices(id),
  receipt_type text NOT NULL DEFAULT 'normal',
  transaction_type text NOT NULL DEFAULT 'sale',
  receipt_number text NOT NULL DEFAULT '',
  total_amount numeric NOT NULL DEFAULT 0,
  tax_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  payment_method text NOT NULL DEFAULT 'cash',
  buyer_id text,
  pfr_request jsonb,
  pfr_response jsonb,
  qr_code_url text,
  signed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fiscal_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.fiscal_receipts FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));

-- 1.5 POS daily reports (Z-reports)
CREATE TABLE public.pos_daily_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  location_id uuid REFERENCES public.locations(id),
  session_id uuid REFERENCES public.pos_sessions(id),
  fiscal_device_id uuid REFERENCES public.fiscal_devices(id),
  report_date date NOT NULL,
  total_sales numeric NOT NULL DEFAULT 0,
  total_refunds numeric NOT NULL DEFAULT 0,
  net_sales numeric NOT NULL DEFAULT 0,
  cash_total numeric NOT NULL DEFAULT 0,
  card_total numeric NOT NULL DEFAULT 0,
  other_total numeric NOT NULL DEFAULT 0,
  transaction_count int NOT NULL DEFAULT 0,
  refund_count int NOT NULL DEFAULT 0,
  tax_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pos_daily_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.pos_daily_reports FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));

-- 1.6 Retail price lists
CREATE TABLE public.retail_price_lists (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  location_id uuid REFERENCES public.locations(id),
  name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.retail_price_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.retail_price_lists FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));

-- 1.7 Retail prices
CREATE TABLE public.retail_prices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  price_list_id uuid NOT NULL REFERENCES public.retail_price_lists(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  retail_price numeric NOT NULL DEFAULT 0,
  markup_percent numeric,
  valid_from date NOT NULL DEFAULT CURRENT_DATE,
  valid_until date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(price_list_id, product_id, valid_from)
);
ALTER TABLE public.retail_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.retail_prices FOR ALL USING (
  price_list_id IN (SELECT id FROM public.retail_price_lists WHERE tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'))
);

-- 1.8 ALTER pos_sessions
ALTER TABLE public.pos_sessions
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.locations(id),
  ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES public.warehouses(id),
  ADD COLUMN IF NOT EXISTS fiscal_device_id uuid REFERENCES public.fiscal_devices(id),
  ADD COLUMN IF NOT EXISTS salesperson_id uuid REFERENCES public.salespeople(id);

-- 1.9 ALTER pos_transactions
ALTER TABLE public.pos_transactions
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.locations(id),
  ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES public.warehouses(id),
  ADD COLUMN IF NOT EXISTS salesperson_id uuid REFERENCES public.salespeople(id),
  ADD COLUMN IF NOT EXISTS fiscal_receipt_number text,
  ADD COLUMN IF NOT EXISTS fiscal_device_id uuid REFERENCES public.fiscal_devices(id),
  ADD COLUMN IF NOT EXISTS is_fiscal boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS receipt_type text NOT NULL DEFAULT 'sale',
  ADD COLUMN IF NOT EXISTS original_transaction_id uuid REFERENCES public.pos_transactions(id),
  ADD COLUMN IF NOT EXISTS buyer_id text,
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.invoices(id);

-- 1.10 ALTER invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS salesperson_id uuid REFERENCES public.salespeople(id),
  ADD COLUMN IF NOT EXISTS sales_channel_id uuid REFERENCES public.sales_channels(id),
  ADD COLUMN IF NOT EXISTS sale_type text NOT NULL DEFAULT 'wholesale';

-- 1.11 ALTER sales_orders
ALTER TABLE public.sales_orders
  ADD COLUMN IF NOT EXISTS salesperson_id uuid REFERENCES public.salespeople(id),
  ADD COLUMN IF NOT EXISTS sales_channel_id uuid REFERENCES public.sales_channels(id);

-- 1.12 ALTER quotes
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS salesperson_id uuid REFERENCES public.salespeople(id);

-- 1.13 ALTER opportunities
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS salesperson_id uuid REFERENCES public.salespeople(id);

-- 1.14 ALTER products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS default_retail_price numeric NOT NULL DEFAULT 0;

-- 1.15 ALTER locations
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS default_warehouse_id uuid REFERENCES public.warehouses(id),
  ADD COLUMN IF NOT EXISTS default_price_list_id uuid REFERENCES public.retail_price_lists(id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_salespeople_tenant ON public.salespeople(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_devices_location ON public.fiscal_devices(location_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_receipts_transaction ON public.fiscal_receipts(pos_transaction_id);
CREATE INDEX IF NOT EXISTS idx_pos_daily_reports_location_date ON public.pos_daily_reports(location_id, report_date);
CREATE INDEX IF NOT EXISTS idx_retail_prices_list_product ON public.retail_prices(price_list_id, product_id);
CREATE INDEX IF NOT EXISTS idx_pos_sessions_location ON public.pos_sessions(location_id);
CREATE INDEX IF NOT EXISTS idx_pos_transactions_location ON public.pos_transactions(location_id);
CREATE INDEX IF NOT EXISTS idx_invoices_salesperson ON public.invoices(salesperson_id);
