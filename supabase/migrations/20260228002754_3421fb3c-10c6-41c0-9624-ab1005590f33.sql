-- Phase 4 Tier 2 Batch 1: Add tenant_id to first 10 child tables
-- 1. bank_reconciliation_lines
ALTER TABLE public.bank_reconciliation_lines ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.bank_reconciliation_lines c SET tenant_id = p.tenant_id FROM public.bank_reconciliations p WHERE c.reconciliation_id = p.id AND c.tenant_id IS NULL;
ALTER TABLE public.bank_reconciliation_lines ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bank_reconciliation_lines_tenant ON public.bank_reconciliation_lines(tenant_id);

-- 2. department_positions
ALTER TABLE public.department_positions ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.department_positions c SET tenant_id = p.tenant_id FROM public.departments p WHERE c.department_id = p.id AND c.tenant_id IS NULL;
ALTER TABLE public.department_positions ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_department_positions_tenant ON public.department_positions(tenant_id);

-- 3. dispatch_note_lines
ALTER TABLE public.dispatch_note_lines ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.dispatch_note_lines c SET tenant_id = p.tenant_id FROM public.dispatch_notes p WHERE c.dispatch_note_id = p.id AND c.tenant_id IS NULL;
ALTER TABLE public.dispatch_note_lines ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dispatch_note_lines_tenant ON public.dispatch_note_lines(tenant_id);

-- 4. eotpremnica_lines
ALTER TABLE public.eotpremnica_lines ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.eotpremnica_lines c SET tenant_id = p.tenant_id FROM public.eotpremnica p WHERE c.eotpremnica_id = p.id AND c.tenant_id IS NULL;
ALTER TABLE public.eotpremnica_lines ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_eotpremnica_lines_tenant ON public.eotpremnica_lines(tenant_id);

-- 5. fx_revaluation_lines
ALTER TABLE public.fx_revaluation_lines ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.fx_revaluation_lines c SET tenant_id = p.tenant_id FROM public.fx_revaluations p WHERE c.revaluation_id = p.id AND c.tenant_id IS NULL;
ALTER TABLE public.fx_revaluation_lines ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fx_revaluation_lines_tenant ON public.fx_revaluation_lines(tenant_id);

-- 6. internal_goods_receipt_items
ALTER TABLE public.internal_goods_receipt_items ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.internal_goods_receipt_items c SET tenant_id = p.tenant_id FROM public.internal_goods_receipts p WHERE c.receipt_id = p.id AND c.tenant_id IS NULL;
ALTER TABLE public.internal_goods_receipt_items ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_internal_goods_receipt_items_tenant ON public.internal_goods_receipt_items(tenant_id);

-- 7. internal_order_items
ALTER TABLE public.internal_order_items ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.internal_order_items c SET tenant_id = p.tenant_id FROM public.internal_orders p WHERE c.internal_order_id = p.id AND c.tenant_id IS NULL;
ALTER TABLE public.internal_order_items ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_internal_order_items_tenant ON public.internal_order_items(tenant_id);

-- 8. internal_transfer_items
ALTER TABLE public.internal_transfer_items ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.internal_transfer_items c SET tenant_id = p.tenant_id FROM public.internal_transfers p WHERE c.transfer_id = p.id AND c.tenant_id IS NULL;
ALTER TABLE public.internal_transfer_items ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_internal_transfer_items_tenant ON public.internal_transfer_items(tenant_id);

-- 9. inventory_stock_take_items
ALTER TABLE public.inventory_stock_take_items ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.inventory_stock_take_items c SET tenant_id = p.tenant_id FROM public.inventory_stock_takes p WHERE c.stock_take_id = p.id AND c.tenant_id IS NULL;
ALTER TABLE public.inventory_stock_take_items ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_stock_take_items_tenant ON public.inventory_stock_take_items(tenant_id);

-- 10. inventory_write_off_items
ALTER TABLE public.inventory_write_off_items ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.inventory_write_off_items c SET tenant_id = p.tenant_id FROM public.inventory_write_offs p WHERE c.write_off_id = p.id AND c.tenant_id IS NULL;
ALTER TABLE public.inventory_write_off_items ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_write_off_items_tenant ON public.inventory_write_off_items(tenant_id);

-- Update RLS policies to use direct tenant_id
DO $$ 
DECLARE
  tbl TEXT;
  r RECORD;
  tables TEXT[] := ARRAY[
    'bank_reconciliation_lines','department_positions','dispatch_note_lines',
    'eotpremnica_lines','fx_revaluation_lines','internal_goods_receipt_items',
    'internal_order_items','internal_transfer_items','inventory_stock_take_items',
    'inventory_write_off_items'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = tbl) LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, tbl);
    END LOOP;
    EXECUTE format('CREATE POLICY "Tenant isolation" ON public.%I FOR ALL USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())))', tbl);
  END LOOP;
END $$;