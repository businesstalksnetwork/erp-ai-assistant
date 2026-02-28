
-- P6-01: Tax Loss Carryforward
CREATE TABLE IF NOT EXISTS public.tax_loss_carryforward (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  loss_year INTEGER NOT NULL,
  loss_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  used_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  remaining_amount NUMERIC(18,2) GENERATED ALWAYS AS (loss_amount - used_amount) STORED,
  expiry_year INTEGER GENERATED ALWAYS AS (loss_year + 5) STORED,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, loss_year)
);
ALTER TABLE public.tax_loss_carryforward ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Tenant members can manage tax_loss_carryforward" ON public.tax_loss_carryforward
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- P6-02: Thin Capitalization
CREATE TABLE IF NOT EXISTS public.thin_capitalization (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  related_party_debt NUMERIC(18,2) NOT NULL DEFAULT 0,
  equity_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  interest_expense NUMERIC(18,2) NOT NULL DEFAULT 0,
  debt_equity_ratio NUMERIC(10,4) GENERATED ALWAYS AS (CASE WHEN equity_amount > 0 THEN related_party_debt / equity_amount ELSE 0 END) STORED,
  allowable_ratio NUMERIC(10,4) NOT NULL DEFAULT 4.0,
  non_deductible_interest NUMERIC(18,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, year)
);
ALTER TABLE public.thin_capitalization ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Tenant members can manage thin_capitalization" ON public.thin_capitalization
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- P6-03: CIT Advance Payments — already exists, just ensure RLS
ALTER TABLE public.cit_advance_payments ENABLE ROW LEVEL SECURITY;

-- P6-04: VAT Pro-Rata Coefficients
CREATE TABLE IF NOT EXISTS public.vat_prorata_coefficients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  taxable_revenue NUMERIC(18,2) NOT NULL DEFAULT 0,
  exempt_revenue NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_revenue NUMERIC(18,2) GENERATED ALWAYS AS (taxable_revenue + exempt_revenue) STORED,
  prorata_coefficient NUMERIC(6,4) NOT NULL DEFAULT 0,
  applied_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, year)
);
ALTER TABLE public.vat_prorata_coefficients ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Tenant members can manage vat_prorata_coefficients" ON public.vat_prorata_coefficients
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- P6-05: Capital Goods VAT Register
CREATE TABLE IF NOT EXISTS public.capital_goods_vat_register (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  acquisition_date DATE NOT NULL,
  initial_vat_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  adjustment_period_years INTEGER NOT NULL DEFAULT 5 CHECK (adjustment_period_years IN (5, 10)),
  year INTEGER NOT NULL,
  original_prorata NUMERIC(6,4) NOT NULL DEFAULT 1.0,
  current_prorata NUMERIC(6,4) NOT NULL DEFAULT 1.0,
  annual_adjustment NUMERIC(18,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.capital_goods_vat_register ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Tenant members can manage capital_goods_vat_register" ON public.capital_goods_vat_register
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- P6-07: Deferred Tax Items
CREATE TABLE IF NOT EXISTS public.deferred_tax_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('asset','liability')),
  description TEXT NOT NULL,
  accounting_base NUMERIC(18,2) NOT NULL DEFAULT 0,
  tax_base NUMERIC(18,2) NOT NULL DEFAULT 0,
  temporary_difference NUMERIC(18,2) GENERATED ALWAYS AS (accounting_base - tax_base) STORED,
  tax_rate NUMERIC(6,4) NOT NULL DEFAULT 0.15,
  deferred_tax_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.deferred_tax_items ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Tenant members can manage deferred_tax_items" ON public.deferred_tax_items
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- P6-15: Intercompany Eliminations
CREATE TABLE IF NOT EXISTS public.intercompany_eliminations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  entity_from_id UUID REFERENCES public.legal_entities(id) ON DELETE SET NULL,
  entity_to_id UUID REFERENCES public.legal_entities(id) ON DELETE SET NULL,
  elimination_type TEXT NOT NULL DEFAULT 'revenue_expense' CHECK (elimination_type IN ('revenue_expense','receivable_payable','investment_equity','profit_inventory')),
  amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','posted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.intercompany_eliminations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Tenant members can manage intercompany_eliminations" ON public.intercompany_eliminations
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Triggers for updated_at (IF NOT EXISTS not supported for triggers, use DO block)
DO $$ BEGIN
  CREATE TRIGGER update_tax_loss_carryforward_updated_at BEFORE UPDATE ON public.tax_loss_carryforward FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TRIGGER update_thin_capitalization_updated_at BEFORE UPDATE ON public.thin_capitalization FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TRIGGER update_vat_prorata_coefficients_updated_at BEFORE UPDATE ON public.vat_prorata_coefficients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TRIGGER update_capital_goods_vat_register_updated_at BEFORE UPDATE ON public.capital_goods_vat_register FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TRIGGER update_deferred_tax_items_updated_at BEFORE UPDATE ON public.deferred_tax_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TRIGGER update_intercompany_eliminations_updated_at BEFORE UPDATE ON public.intercompany_eliminations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
