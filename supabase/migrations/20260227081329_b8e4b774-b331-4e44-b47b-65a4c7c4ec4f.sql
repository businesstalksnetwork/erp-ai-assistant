
-- =============================================
-- Phase 1A: Accounting Module Foundation Schema
-- =============================================

-- 1. chart_of_accounts: add analytics & tracking columns
ALTER TABLE public.chart_of_accounts
  ADD COLUMN IF NOT EXISTS analytics_type TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_foreign_currency BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tracks_cost_center BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tracks_cost_bearer BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_closing_account BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.chart_of_accounts.analytics_type IS 'PARTNER, EMPLOYEE, OBJECT, or NULL (no analytics)';

-- 2. invoice_lines: add item_type, popdv, efaktura, warehouse
ALTER TABLE public.invoice_lines
  ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'service',
  ADD COLUMN IF NOT EXISTS popdv_field TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS efaktura_category TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS warehouse_id UUID DEFAULT NULL REFERENCES public.warehouses(id) ON DELETE SET NULL;

-- 3. invoices: add posted_at
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ DEFAULT NULL;

-- 4. journal_lines: add analytics & foreign currency columns
ALTER TABLE public.journal_lines
  ADD COLUMN IF NOT EXISTS analytics_type TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS analytics_reference_id UUID DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS analytics_label TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS foreign_currency TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS foreign_amount NUMERIC(18,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(18,6) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS popdv_field TEXT DEFAULT NULL;

-- 5. voucher_types table
CREATE TABLE IF NOT EXISTS public.voucher_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  name_sr TEXT,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_system BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, code)
);

ALTER TABLE public.voucher_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for voucher_types"
  ON public.voucher_types FOR ALL
  USING (tenant_id IN (SELECT id FROM public.tenants WHERE id = tenant_id));

CREATE POLICY "Authenticated users can manage voucher_types"
  ON public.voucher_types FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 6. supplier_invoice_lines table
CREATE TABLE IF NOT EXISTS public.supplier_invoice_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_invoice_id UUID NOT NULL REFERENCES public.supplier_invoices(id) ON DELETE CASCADE,
  description TEXT,
  quantity NUMERIC(18,4) NOT NULL DEFAULT 1,
  unit_price NUMERIC(18,4) NOT NULL DEFAULT 0,
  tax_rate_id UUID REFERENCES public.tax_rates(id) ON DELETE SET NULL,
  tax_rate_value NUMERIC(5,2) DEFAULT 0,
  line_total NUMERIC(18,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_with_tax NUMERIC(18,2) NOT NULL DEFAULT 0,
  item_type TEXT DEFAULT 'service',
  popdv_field TEXT,
  efaktura_category TEXT,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_invoice_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Supplier invoice lines access via parent"
  ON public.supplier_invoice_lines FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 7. popdv_records table (Serbian VAT form — 11 sections)
CREATE TABLE IF NOT EXISTS public.popdv_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  legal_entity_id UUID REFERENCES public.legal_entities(id) ON DELETE SET NULL,
  period_year INT NOT NULL,
  period_month INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  -- Section 1: Promet dobara i usluga za koji je propisano poresko oslobodjenje sa pravom na odbitak
  section_1_1 NUMERIC(18,2) DEFAULT 0,
  section_1_2 NUMERIC(18,2) DEFAULT 0,
  section_1_3 NUMERIC(18,2) DEFAULT 0,
  section_1_4 NUMERIC(18,2) DEFAULT 0,
  -- Section 2: Promet dobara i usluga za koji je propisano poresko oslobodjenje bez prava na odbitak
  section_2_1 NUMERIC(18,2) DEFAULT 0,
  section_2_2 NUMERIC(18,2) DEFAULT 0,
  section_2_3 NUMERIC(18,2) DEFAULT 0,
  -- Section 3: Oporezivi promet po opštoj stopi (20%)
  section_3_1_base NUMERIC(18,2) DEFAULT 0,
  section_3_1_tax NUMERIC(18,2) DEFAULT 0,
  section_3_2_base NUMERIC(18,2) DEFAULT 0,
  section_3_2_tax NUMERIC(18,2) DEFAULT 0,
  section_3_3_base NUMERIC(18,2) DEFAULT 0,
  section_3_3_tax NUMERIC(18,2) DEFAULT 0,
  section_3_4_base NUMERIC(18,2) DEFAULT 0,
  section_3_4_tax NUMERIC(18,2) DEFAULT 0,
  -- Section 4: Oporezivi promet po posebnoj stopi (10%)
  section_4_1_base NUMERIC(18,2) DEFAULT 0,
  section_4_1_tax NUMERIC(18,2) DEFAULT 0,
  section_4_2_base NUMERIC(18,2) DEFAULT 0,
  section_4_2_tax NUMERIC(18,2) DEFAULT 0,
  section_4_3_base NUMERIC(18,2) DEFAULT 0,
  section_4_3_tax NUMERIC(18,2) DEFAULT 0,
  section_4_4_base NUMERIC(18,2) DEFAULT 0,
  section_4_4_tax NUMERIC(18,2) DEFAULT 0,
  -- Section 5: Nabavke od poljopriv. (PPS obrazac)
  section_5_1_base NUMERIC(18,2) DEFAULT 0,
  section_5_1_tax NUMERIC(18,2) DEFAULT 0,
  -- Section 6: Promet za koji obvezu obračunavanja PDV ima primalac
  section_6_1_base NUMERIC(18,2) DEFAULT 0,
  section_6_1_tax NUMERIC(18,2) DEFAULT 0,
  section_6_2_base NUMERIC(18,2) DEFAULT 0,
  section_6_2_tax NUMERIC(18,2) DEFAULT 0,
  -- Section 7: Uvoz dobara
  section_7_1_base NUMERIC(18,2) DEFAULT 0,
  section_7_1_tax NUMERIC(18,2) DEFAULT 0,
  -- Section 8: Prethodni porez
  section_8_1 NUMERIC(18,2) DEFAULT 0,
  section_8_2 NUMERIC(18,2) DEFAULT 0,
  section_8_3 NUMERIC(18,2) DEFAULT 0,
  section_8_4 NUMERIC(18,2) DEFAULT 0,
  section_8_5 NUMERIC(18,2) DEFAULT 0,
  -- Section 9: Ispravka odbitka prethodnog poreza
  section_9_1 NUMERIC(18,2) DEFAULT 0,
  section_9_2 NUMERIC(18,2) DEFAULT 0,
  -- Section 10: Posebni postupci oporezivanja
  section_10_1 NUMERIC(18,2) DEFAULT 0,
  section_10_2 NUMERIC(18,2) DEFAULT 0,
  -- Section 11: Ukupan PDV za uplatu / povraćaj
  section_11_total_output_tax NUMERIC(18,2) DEFAULT 0,
  section_11_total_input_tax NUMERIC(18,2) DEFAULT 0,
  section_11_net_tax NUMERIC(18,2) DEFAULT 0,
  -- Metadata
  notes TEXT,
  submitted_at TIMESTAMPTZ,
  submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, legal_entity_id, period_year, period_month)
);

ALTER TABLE public.popdv_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for popdv_records"
  ON public.popdv_records FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 8. Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_analytics_type ON public.chart_of_accounts(tenant_id, analytics_type) WHERE analytics_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_journal_lines_analytics ON public.journal_lines(analytics_type, analytics_reference_id) WHERE analytics_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_supplier_invoice_lines_invoice ON public.supplier_invoice_lines(supplier_invoice_id);
CREATE INDEX IF NOT EXISTS idx_popdv_records_period ON public.popdv_records(tenant_id, period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_item_type ON public.invoice_lines(item_type) WHERE item_type IS NOT NULL;
