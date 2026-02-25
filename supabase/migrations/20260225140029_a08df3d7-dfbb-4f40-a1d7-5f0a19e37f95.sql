
-- =====================================================
-- PHASE A: Core Accounting Gaps
-- =====================================================

-- 1. RECURRING INVOICES
CREATE TABLE public.recurring_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  legal_entity_id UUID REFERENCES public.legal_entities(id),
  partner_id UUID REFERENCES public.partners(id),
  template_name TEXT NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('weekly','monthly','quarterly','semi_annual','annual')),
  next_run_date DATE NOT NULL,
  last_run_date DATE,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  currency TEXT NOT NULL DEFAULT 'RSD',
  exchange_rate NUMERIC(12,4) DEFAULT 1,
  notes TEXT,
  lines JSONB NOT NULL DEFAULT '[]'::jsonb,
  auto_post BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.recurring_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.recurring_invoices FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));

-- 2. RECURRING JOURNALS
CREATE TABLE public.recurring_journals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  legal_entity_id UUID REFERENCES public.legal_entities(id),
  template_name TEXT NOT NULL,
  description TEXT,
  frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('weekly','monthly','quarterly','semi_annual','annual')),
  next_run_date DATE NOT NULL,
  last_run_date DATE,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  lines JSONB NOT NULL DEFAULT '[]'::jsonb,
  auto_post BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.recurring_journals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.recurring_journals FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));

-- 3. MULTI-CURRENCY: Add exchange_rate to invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(12,4) DEFAULT 1,
  ADD COLUMN IF NOT EXISTS base_currency_total NUMERIC(15,2);

-- 4. BANK ACCOUNT ↔ GL LINKING
ALTER TABLE public.bank_accounts
  ADD COLUMN IF NOT EXISTS gl_account_id UUID REFERENCES public.chart_of_accounts(id);

-- 5. BATCH DEPRECIATION RPC
CREATE OR REPLACE FUNCTION public.calculate_depreciation_batch(
  p_tenant_id UUID,
  p_period_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(asset_id UUID, depreciation_amount NUMERIC, journal_entry_id UUID) 
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_asset RECORD;
  v_monthly_dep NUMERIC;
  v_je_id UUID;
  v_entry_number TEXT;
  v_dep_account_id UUID;
  v_expense_account_id UUID;
BEGIN
  -- Find the accumulated depreciation account (0290 or similar)
  SELECT id INTO v_dep_account_id FROM chart_of_accounts 
    WHERE tenant_id = p_tenant_id AND code = '0290' AND is_active = true LIMIT 1;
  -- Find the depreciation expense account (5400 or similar)
  SELECT id INTO v_expense_account_id FROM chart_of_accounts 
    WHERE tenant_id = p_tenant_id AND code = '5400' AND is_active = true LIMIT 1;

  IF v_dep_account_id IS NULL OR v_expense_account_id IS NULL THEN
    RAISE EXCEPTION 'Depreciation accounts 0290 and/or 5400 not found in chart of accounts';
  END IF;

  FOR v_asset IN
    SELECT fa.id, fa.asset_name, fa.acquisition_cost, fa.residual_value, fa.useful_life_months,
           fa.depreciation_start_date, fa.accumulated_depreciation
    FROM fixed_assets fa
    WHERE fa.tenant_id = p_tenant_id
      AND fa.status = 'active'
      AND fa.depreciation_start_date <= p_period_date
      AND NOT EXISTS (
        SELECT 1 FROM journal_entries je 
        WHERE je.tenant_id = p_tenant_id 
          AND je.reference = 'DEP-' || fa.id::text 
          AND date_trunc('month', je.entry_date) = date_trunc('month', p_period_date)
      )
  LOOP
    v_monthly_dep := ROUND((v_asset.acquisition_cost - COALESCE(v_asset.residual_value, 0)) / GREATEST(v_asset.useful_life_months, 1), 2);
    
    -- Skip if fully depreciated
    IF COALESCE(v_asset.accumulated_depreciation, 0) + v_monthly_dep > (v_asset.acquisition_cost - COALESCE(v_asset.residual_value, 0)) THEN
      v_monthly_dep := GREATEST((v_asset.acquisition_cost - COALESCE(v_asset.residual_value, 0)) - COALESCE(v_asset.accumulated_depreciation, 0), 0);
    END IF;
    
    IF v_monthly_dep <= 0 THEN CONTINUE; END IF;

    v_entry_number := 'DEP-' || to_char(p_period_date, 'YYMM') || '-' || substr(v_asset.id::text, 1, 8);

    INSERT INTO journal_entries (tenant_id, entry_number, entry_date, description, reference, status, created_by)
    VALUES (p_tenant_id, v_entry_number, p_period_date, 
            'Amortizacija: ' || v_asset.asset_name, 
            'DEP-' || v_asset.id::text, 'posted', auth.uid())
    RETURNING id INTO v_je_id;

    INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
    VALUES 
      (v_je_id, v_expense_account_id, v_monthly_dep, 0, 'Trošak amortizacije - ' || v_asset.asset_name, 1),
      (v_je_id, v_dep_account_id, 0, v_monthly_dep, 'Ispravka vrednosti - ' || v_asset.asset_name, 2);

    UPDATE fixed_assets SET accumulated_depreciation = COALESCE(accumulated_depreciation, 0) + v_monthly_dep, updated_at = now()
    WHERE id = v_asset.id;

    asset_id := v_asset.id;
    depreciation_amount := v_monthly_dep;
    journal_entry_id := v_je_id;
    RETURN NEXT;
  END LOOP;
END;
$$;
