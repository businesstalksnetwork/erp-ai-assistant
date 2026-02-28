-- Phase 4 Tier 2 Batch 2: Add tenant_id to remaining 9 child tables
-- 1. kalkulacija_items
ALTER TABLE public.kalkulacija_items ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.kalkulacija_items c SET tenant_id = p.tenant_id FROM public.kalkulacije p WHERE c.kalkulacija_id = p.id AND c.tenant_id IS NULL;
ALTER TABLE public.kalkulacija_items ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_kalkulacija_items_tenant ON public.kalkulacija_items(tenant_id);

-- 2. kompenzacija_items
ALTER TABLE public.kompenzacija_items ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.kompenzacija_items c SET tenant_id = p.tenant_id FROM public.kompenzacija p WHERE c.kompenzacija_id = p.id AND c.tenant_id IS NULL;
ALTER TABLE public.kompenzacija_items ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_kompenzacija_items_tenant ON public.kompenzacija_items(tenant_id);

-- 3. nivelacija_items
ALTER TABLE public.nivelacija_items ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.nivelacija_items c SET tenant_id = p.tenant_id FROM public.nivelacije p WHERE c.nivelacija_id = p.id AND c.tenant_id IS NULL;
ALTER TABLE public.nivelacija_items ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nivelacija_items_tenant ON public.nivelacija_items(tenant_id);

-- 4. quality_check_items
ALTER TABLE public.quality_check_items ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.quality_check_items c SET tenant_id = p.tenant_id FROM public.quality_checks p WHERE c.quality_check_id = p.id AND c.tenant_id IS NULL;
ALTER TABLE public.quality_check_items ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quality_check_items_tenant ON public.quality_check_items(tenant_id);

-- 5. retail_prices
ALTER TABLE public.retail_prices ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.retail_prices c SET tenant_id = p.tenant_id FROM public.retail_price_lists p WHERE c.price_list_id = p.id AND c.tenant_id IS NULL;
ALTER TABLE public.retail_prices ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_retail_prices_tenant ON public.retail_prices(tenant_id);

-- 6. return_lines
ALTER TABLE public.return_lines ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.return_lines c SET tenant_id = p.tenant_id FROM public.return_cases p WHERE c.return_case_id = p.id AND c.tenant_id IS NULL;
ALTER TABLE public.return_lines ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_return_lines_tenant ON public.return_lines(tenant_id);

-- 7. service_order_lines
ALTER TABLE public.service_order_lines ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.service_order_lines c SET tenant_id = p.tenant_id FROM public.service_orders p WHERE c.service_order_id = p.id AND c.tenant_id IS NULL;
ALTER TABLE public.service_order_lines ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_service_order_lines_tenant ON public.service_order_lines(tenant_id);

-- 8. service_order_status_log
ALTER TABLE public.service_order_status_log ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.service_order_status_log c SET tenant_id = p.tenant_id FROM public.service_orders p WHERE c.service_order_id = p.id AND c.tenant_id IS NULL;
ALTER TABLE public.service_order_status_log ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_service_order_status_log_tenant ON public.service_order_status_log(tenant_id);

-- 9. wms_return_lines
ALTER TABLE public.wms_return_lines ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.wms_return_lines c SET tenant_id = p.tenant_id FROM public.wms_returns p WHERE c.return_id = p.id AND c.tenant_id IS NULL;
ALTER TABLE public.wms_return_lines ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wms_return_lines_tenant ON public.wms_return_lines(tenant_id);

-- Update RLS policies for all 9 tables
DO $$ 
DECLARE
  tbl TEXT;
  r RECORD;
  tables TEXT[] := ARRAY[
    'kalkulacija_items','kompenzacija_items','nivelacija_items',
    'quality_check_items','retail_prices','return_lines',
    'service_order_lines','service_order_status_log','wms_return_lines'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = tbl) LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, tbl);
    END LOOP;
    EXECUTE format('CREATE POLICY "Tenant isolation" ON public.%I FOR ALL USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())))', tbl);
  END LOOP;
END $$;