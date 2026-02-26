
-- ============================================================
-- ASSETS DIGITALIZATION MODULE — Phase 0 Foundation
-- 10 tables + RLS + indexes + seed categories + asset code generator
-- ============================================================

-- 1. asset_categories
CREATE TABLE public.asset_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.asset_categories(id),
  code TEXT NOT NULL,
  code_prefix TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  name_sr TEXT,
  asset_type TEXT NOT NULL DEFAULT 'fixed_asset' CHECK (asset_type IN ('fixed_asset','vehicle','material_good','intangible')),
  default_useful_life_months INTEGER,
  default_depreciation_method TEXT DEFAULT 'straight_line' CHECK (default_depreciation_method IN ('straight_line','declining_balance','units_of_production')),
  default_depreciation_account TEXT,
  default_accumulation_account TEXT,
  default_expense_account TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, code)
);
ALTER TABLE public.asset_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.asset_categories FOR ALL USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- 2. asset_locations
CREATE TABLE public.asset_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.asset_locations(id),
  name TEXT NOT NULL,
  location_type TEXT NOT NULL DEFAULT 'room' CHECK (location_type IN ('building','floor','room','warehouse','outdoor','other')),
  address TEXT,
  cost_center_id UUID REFERENCES public.cost_centers(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.asset_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.asset_locations FOR ALL USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- 3. assets (master)
CREATE TABLE public.assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  asset_code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  asset_type TEXT NOT NULL DEFAULT 'fixed_asset' CHECK (asset_type IN ('fixed_asset','vehicle','material_good','intangible')),
  category_id UUID REFERENCES public.asset_categories(id),
  location_id UUID REFERENCES public.asset_locations(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','in_use','maintenance','disposed','written_off')),
  serial_number TEXT,
  inventory_number TEXT,
  barcode TEXT,
  acquisition_date DATE,
  acquisition_cost NUMERIC(15,2) DEFAULT 0,
  current_value NUMERIC(15,2) DEFAULT 0,
  residual_value NUMERIC(15,2) DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'RSD',
  supplier_id UUID REFERENCES public.partners(id),
  responsible_employee_id UUID REFERENCES public.employees(id),
  legal_entity_id UUID REFERENCES public.legal_entities(id),
  cost_center_id UUID REFERENCES public.cost_centers(id),
  warranty_expiry DATE,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, asset_code)
);
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.assets FOR ALL USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE INDEX idx_assets_name ON public.assets USING gin(to_tsvector('simple', name));
CREATE INDEX idx_assets_serial ON public.assets(serial_number) WHERE serial_number IS NOT NULL;
CREATE INDEX idx_assets_code ON public.assets(asset_code);
CREATE INDEX idx_assets_status ON public.assets(tenant_id, status);
CREATE INDEX idx_assets_type ON public.assets(tenant_id, asset_type);

-- 4. asset_documents
CREATE TABLE public.asset_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL DEFAULT 'invoice' CHECK (document_type IN ('invoice','warranty','certificate','photo','manual','contract','other')),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  notes TEXT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.asset_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.asset_documents FOR ALL USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- 5. fixed_asset_details (1:1 with assets for fixed_asset/intangible)
CREATE TABLE public.fixed_asset_details (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE UNIQUE,
  depreciation_method TEXT NOT NULL DEFAULT 'straight_line' CHECK (depreciation_method IN ('straight_line','declining_balance','units_of_production')),
  useful_life_months INTEGER NOT NULL DEFAULT 60,
  depreciation_rate NUMERIC(8,4),
  depreciation_start_date DATE,
  tax_depreciation_method TEXT DEFAULT 'straight_line',
  tax_useful_life_months INTEGER,
  tax_depreciation_rate NUMERIC(8,4),
  tax_group TEXT,
  accumulated_depreciation NUMERIC(15,2) NOT NULL DEFAULT 0,
  accumulated_tax_depreciation NUMERIC(15,2) NOT NULL DEFAULT 0,
  net_book_value NUMERIC(15,2) NOT NULL DEFAULT 0,
  depreciation_account_id UUID REFERENCES public.chart_of_accounts(id),
  accumulation_account_id UUID REFERENCES public.chart_of_accounts(id),
  expense_account_id UUID REFERENCES public.chart_of_accounts(id),
  asset_account_id UUID REFERENCES public.chart_of_accounts(id),
  is_fully_depreciated BOOLEAN NOT NULL DEFAULT false,
  last_depreciation_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fixed_asset_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.fixed_asset_details FOR ALL USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- 6. fixed_asset_depreciation_schedules
CREATE TABLE public.fixed_asset_depreciation_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  depreciation_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_depreciation_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  accumulated_depreciation NUMERIC(15,2) NOT NULL DEFAULT 0,
  net_book_value NUMERIC(15,2) NOT NULL DEFAULT 0,
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','posted','reversed')),
  posted_at TIMESTAMPTZ,
  posted_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fixed_asset_depreciation_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.fixed_asset_depreciation_schedules FOR ALL USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE INDEX idx_depr_sched_asset ON public.fixed_asset_depreciation_schedules(asset_id, period_start);

-- 7. fixed_asset_revaluations
CREATE TABLE public.fixed_asset_revaluations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  revaluation_date DATE NOT NULL,
  old_value NUMERIC(15,2) NOT NULL,
  new_value NUMERIC(15,2) NOT NULL,
  revaluation_surplus NUMERIC(15,2) NOT NULL DEFAULT 0,
  reason TEXT,
  appraiser TEXT,
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fixed_asset_revaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.fixed_asset_revaluations FOR ALL USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- 8. fixed_asset_impairments
CREATE TABLE public.fixed_asset_impairments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  impairment_date DATE NOT NULL,
  carrying_amount NUMERIC(15,2) NOT NULL,
  recoverable_amount NUMERIC(15,2) NOT NULL,
  impairment_loss NUMERIC(15,2) NOT NULL,
  reason TEXT,
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fixed_asset_impairments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.fixed_asset_impairments FOR ALL USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- 9. fixed_asset_disposals
CREATE TABLE public.fixed_asset_disposals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  disposal_date DATE NOT NULL,
  disposal_type TEXT NOT NULL DEFAULT 'sale' CHECK (disposal_type IN ('sale','write_off','donation','destruction','transfer')),
  disposal_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  net_book_value_at_disposal NUMERIC(15,2) NOT NULL DEFAULT 0,
  gain_loss NUMERIC(15,2) NOT NULL DEFAULT 0,
  buyer_partner_id UUID REFERENCES public.partners(id),
  invoice_id UUID REFERENCES public.invoices(id),
  reason TEXT,
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  approved_by UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fixed_asset_disposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.fixed_asset_disposals FOR ALL USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- 10. asset_assignments
CREATE TABLE public.asset_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employees(id),
  location_id UUID REFERENCES public.asset_locations(id),
  assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
  returned_date DATE,
  assignment_type TEXT NOT NULL DEFAULT 'personal' CHECK (assignment_type IN ('personal','department','location','temporary')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','returned','transferred','lost')),
  notes TEXT,
  assigned_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.asset_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.asset_assignments FOR ALL USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- Asset code generator function
CREATE OR REPLACE FUNCTION public.generate_asset_code(p_tenant_id UUID, p_prefix TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year TEXT;
  v_seq INTEGER;
  v_code TEXT;
BEGIN
  v_year := to_char(CURRENT_DATE, 'YYYY');
  SELECT COALESCE(MAX(
    NULLIF(regexp_replace(asset_code, '^.*-(\d+)$', '\1'), asset_code)::INTEGER
  ), 0) + 1
  INTO v_seq
  FROM public.assets
  WHERE tenant_id = p_tenant_id
    AND asset_code LIKE p_prefix || '-' || v_year || '-%';
  
  v_code := p_prefix || '-' || v_year || '-' || lpad(v_seq::TEXT, 5, '0');
  RETURN v_code;
END;
$$;

-- Updated_at triggers
CREATE TRIGGER update_asset_categories_updated_at BEFORE UPDATE ON public.asset_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_asset_locations_updated_at BEFORE UPDATE ON public.asset_locations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_fixed_asset_details_updated_at BEFORE UPDATE ON public.fixed_asset_details FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_asset_assignments_updated_at BEFORE UPDATE ON public.asset_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
