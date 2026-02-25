
-- ==========================================
-- GAP 4: Tax Calendar / Compliance Deadlines
-- ==========================================
CREATE TABLE public.tax_calendar (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  legal_entity_id UUID REFERENCES public.legal_entities(id),
  deadline_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE NOT NULL,
  fiscal_year INTEGER NOT NULL,
  fiscal_month INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  completed_by UUID,
  reference_id UUID,
  reference_type TEXT,
  recurrence_rule TEXT,
  notification_sent BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tax_calendar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for tax_calendar"
  ON public.tax_calendar FOR ALL
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE INDEX idx_tax_calendar_tenant_due ON public.tax_calendar(tenant_id, due_date);
CREATE INDEX idx_tax_calendar_status ON public.tax_calendar(tenant_id, status, due_date);

-- ==========================================
-- GAP 8: Multi-Currency PDV Handling
-- ==========================================
ALTER TABLE public.pdv_entries
  ADD COLUMN IF NOT EXISTS original_currency TEXT DEFAULT 'RSD',
  ADD COLUMN IF NOT EXISTS original_base_amount NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS original_vat_amount NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(15,6);

-- ==========================================
-- GAP 11: CIT Advance Payment Tracking
-- ==========================================
CREATE TABLE public.cit_advance_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  legal_entity_id UUID REFERENCES public.legal_entities(id),
  fiscal_year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  due_date DATE NOT NULL,
  paid_date DATE,
  payment_reference TEXT,
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, legal_entity_id, fiscal_year, month)
);

ALTER TABLE public.cit_advance_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for cit_advance_payments"
  ON public.cit_advance_payments FOR ALL
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE INDEX idx_cit_advances_tenant_year ON public.cit_advance_payments(tenant_id, fiscal_year);

-- ==========================================
-- GAP 2: Automated PDV Settlement Journal RPC
-- ==========================================
CREATE OR REPLACE FUNCTION public.create_pdv_settlement_journal(
  p_tenant_id UUID,
  p_pdv_period_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period RECORD;
  v_output_vat NUMERIC(15,2) := 0;
  v_input_vat NUMERIC(15,2) := 0;
  v_net_vat NUMERIC(15,2);
  v_journal_id UUID;
  v_entry_number TEXT;
  v_output_account_id UUID;
  v_input_account_id UUID;
  v_settlement_account_id UUID;
  v_lines JSONB := '[]'::JSONB;
  v_sort INTEGER := 1;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM tenant_users
    WHERE tenant_id = p_tenant_id AND user_id = auth.uid() AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT * INTO v_period FROM pdv_periods
  WHERE id = p_pdv_period_id AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PDV period not found';
  END IF;

  IF v_period.status NOT IN ('calculated', 'submitted') THEN
    RAISE EXCEPTION 'PDV period must be calculated or submitted';
  END IF;

  SELECT
    COALESCE(SUM(CASE WHEN direction = 'output' THEN vat_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN direction = 'input' THEN vat_amount ELSE 0 END), 0)
  INTO v_output_vat, v_input_vat
  FROM pdv_entries
  WHERE pdv_period_id = p_pdv_period_id AND tenant_id = p_tenant_id;

  v_net_vat := v_output_vat - v_input_vat;

  IF ABS(v_net_vat) < 0.01 THEN
    RAISE EXCEPTION 'No VAT settlement needed — output and input VAT are equal';
  END IF;

  SELECT id INTO v_output_account_id FROM chart_of_accounts
  WHERE tenant_id = p_tenant_id AND code = '4700' AND is_active = true LIMIT 1;

  SELECT id INTO v_input_account_id FROM chart_of_accounts
  WHERE tenant_id = p_tenant_id AND code = '2700' AND is_active = true LIMIT 1;

  IF v_output_account_id IS NULL OR v_input_account_id IS NULL THEN
    RAISE EXCEPTION 'VAT accounts 4700 and/or 2700 not found';
  END IF;

  IF v_net_vat > 0 THEN
    SELECT id INTO v_settlement_account_id FROM chart_of_accounts
    WHERE tenant_id = p_tenant_id AND code = '4890' AND is_active = true LIMIT 1;
    IF v_settlement_account_id IS NULL THEN
      RAISE EXCEPTION 'Settlement account 4890 not found';
    END IF;
  ELSE
    SELECT id INTO v_settlement_account_id FROM chart_of_accounts
    WHERE tenant_id = p_tenant_id AND code = '2790' AND is_active = true LIMIT 1;
    IF v_settlement_account_id IS NULL THEN
      RAISE EXCEPTION 'Settlement account 2790 not found';
    END IF;
  END IF;

  v_entry_number := 'PDV-SETTLE-' || to_char(now(), 'YYYYMMDD-HH24MISS');

  v_lines := v_lines || jsonb_build_object(
    'account_id', v_output_account_id, 'debit', v_output_vat, 'credit', 0,
    'description', 'Zatvaranje izlaznog PDV-a za period ' || v_period.name, 'sort_order', v_sort
  );
  v_sort := v_sort + 1;

  v_lines := v_lines || jsonb_build_object(
    'account_id', v_input_account_id, 'debit', 0, 'credit', v_input_vat,
    'description', 'Zatvaranje ulaznog PDV-a za period ' || v_period.name, 'sort_order', v_sort
  );
  v_sort := v_sort + 1;

  IF v_net_vat > 0 THEN
    v_lines := v_lines || jsonb_build_object(
      'account_id', v_settlement_account_id, 'debit', 0, 'credit', v_net_vat,
      'description', 'Obaveza za PDV prema državi za period ' || v_period.name, 'sort_order', v_sort
    );
  ELSE
    v_lines := v_lines || jsonb_build_object(
      'account_id', v_settlement_account_id, 'debit', ABS(v_net_vat), 'credit', 0,
      'description', 'Potraživanje za PDV od države za period ' || v_period.name, 'sort_order', v_sort
    );
  END IF;

  SELECT create_journal_entry_with_lines(
    p_tenant_id, v_entry_number, v_period.end_date::DATE,
    'PDV settlement – ' || v_period.name, 'PDV-SETTLE', NULL, v_lines::TEXT
  ) INTO v_journal_id;

  RETURN v_journal_id;
END;
$$;

-- ==========================================
-- Generate tax calendar deadlines for a year
-- ==========================================
CREATE OR REPLACE FUNCTION public.generate_tax_calendar(
  p_tenant_id UUID,
  p_fiscal_year INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  v_month INTEGER;
  v_due_date DATE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM tenant_users
    WHERE tenant_id = p_tenant_id AND user_id = auth.uid() AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  FOR v_month IN 1..12 LOOP
    v_due_date := make_date(
      CASE WHEN v_month = 12 THEN p_fiscal_year + 1 ELSE p_fiscal_year END,
      CASE WHEN v_month = 12 THEN 1 ELSE v_month + 1 END,
      15
    );

    INSERT INTO tax_calendar (tenant_id, deadline_type, title, description, due_date, fiscal_year, fiscal_month, recurrence_rule)
    VALUES (p_tenant_id, 'pp_pdv', 'PP-PDV prijava za ' || v_month || '/' || p_fiscal_year,
      'Podnošenje poreske prijave PP-PDV za PDV period', v_due_date, p_fiscal_year, v_month, 'monthly_15th')
    ON CONFLICT DO NOTHING;
    v_count := v_count + 1;

    INSERT INTO tax_calendar (tenant_id, deadline_type, title, description, due_date, fiscal_year, fiscal_month, recurrence_rule)
    VALUES (p_tenant_id, 'ppp_pd', 'PPP-PD prijava za ' || v_month || '/' || p_fiscal_year,
      'Podnošenje pojedinačne poreske prijave za poreze po odbitku', v_due_date, p_fiscal_year, v_month, 'monthly_15th')
    ON CONFLICT DO NOTHING;
    v_count := v_count + 1;

    INSERT INTO tax_calendar (tenant_id, deadline_type, title, description, due_date, fiscal_year, fiscal_month, recurrence_rule)
    VALUES (p_tenant_id, 'cit_advance', 'Akontacija poreza na dobit ' || v_month || '/' || p_fiscal_year,
      'Mesečna akontacija poreza na dobit pravnih lica', v_due_date, p_fiscal_year, v_month, 'monthly_15th')
    ON CONFLICT DO NOTHING;
    v_count := v_count + 1;
  END LOOP;

  INSERT INTO tax_calendar (tenant_id, deadline_type, title, description, due_date, fiscal_year, recurrence_rule)
  VALUES (p_tenant_id, 'cit_annual', 'Godišnji porez na dobit za ' || p_fiscal_year,
    'Podnošenje godišnje poreske prijave poreza na dobit (PDP)', make_date(p_fiscal_year + 1, 6, 30), p_fiscal_year, 'annual_june_30')
  ON CONFLICT DO NOTHING;
  v_count := v_count + 1;

  INSERT INTO tax_calendar (tenant_id, deadline_type, title, description, due_date, fiscal_year, recurrence_rule)
  VALUES (p_tenant_id, 'apr_financial_statements', 'Finansijski izveštaji za APR ' || p_fiscal_year,
    'Predaja godišnjih finansijskih izveštaja Agenciji za privredne registre', make_date(p_fiscal_year + 1, 6, 30), p_fiscal_year, 'annual_june_30')
  ON CONFLICT DO NOTHING;
  v_count := v_count + 1;

  INSERT INTO tax_calendar (tenant_id, deadline_type, title, description, due_date, fiscal_year, recurrence_rule)
  VALUES (p_tenant_id, 'apr_statistical_annex', 'Statistički aneks za ' || p_fiscal_year,
    'Predaja statističkog izveštaja APR-u', make_date(p_fiscal_year + 1, 2, 28), p_fiscal_year, 'annual_feb_28')
  ON CONFLICT DO NOTHING;
  v_count := v_count + 1;

  UPDATE tax_calendar SET status = 'overdue'
  WHERE tenant_id = p_tenant_id AND fiscal_year = p_fiscal_year
    AND due_date < CURRENT_DATE AND status = 'pending';

  RETURN v_count;
END;
$$;
