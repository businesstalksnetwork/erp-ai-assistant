
-- =============================================
-- Fix 4: Payroll Parameters Table (effective-dated)
-- =============================================
CREATE TABLE public.payroll_parameters (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  effective_from date NOT NULL,
  effective_to date,
  nontaxable_amount numeric NOT NULL DEFAULT 34221,
  min_contribution_base numeric NOT NULL DEFAULT 51297,
  max_contribution_base numeric NOT NULL DEFAULT 732820,
  pio_employee_rate numeric NOT NULL DEFAULT 0.14,
  health_employee_rate numeric NOT NULL DEFAULT 0.0515,
  unemployment_employee_rate numeric NOT NULL DEFAULT 0.0075,
  pio_employer_rate numeric NOT NULL DEFAULT 0.115,
  health_employer_rate numeric NOT NULL DEFAULT 0.0515,
  tax_rate numeric NOT NULL DEFAULT 0.10,
  gazette_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT no_overlap CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

ALTER TABLE public.payroll_parameters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view payroll parameters"
  ON public.payroll_parameters FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage payroll parameters"
  ON public.payroll_parameters FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND role IN ('admin','super_admin')));

-- =============================================
-- Fix 5: Add sef_request_id to invoices
-- =============================================
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS sef_request_id uuid;

-- =============================================
-- Fix 5: Retail Pricing - Update post_kalkulacija RPC for embedded VAT (account 1340)
-- =============================================
CREATE OR REPLACE FUNCTION public.post_kalkulacija(p_kalkulacija_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kal RECORD;
  v_line RECORD;
  v_je_id uuid;
  v_tenant_id uuid;
  v_legal_entity_id uuid;
  v_total_cost numeric := 0;
  v_total_retail numeric := 0;
  v_total_margin numeric := 0;
  v_total_embedded_vat numeric := 0;
  v_period_id uuid;
BEGIN
  SELECT * INTO v_kal FROM kalkulacije WHERE id = p_kalkulacija_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Kalkulacija not found'; END IF;
  IF v_kal.status = 'posted' THEN RAISE EXCEPTION 'Already posted'; END IF;

  v_tenant_id := v_kal.tenant_id;
  v_legal_entity_id := v_kal.legal_entity_id;

  FOR v_line IN SELECT * FROM kalkulacija_lines WHERE kalkulacija_id = p_kalkulacija_id
  LOOP
    v_total_cost := v_total_cost + (v_line.purchase_price * v_line.quantity);
    v_total_retail := v_total_retail + (v_line.retail_price * v_line.quantity);
    v_total_embedded_vat := v_total_embedded_vat + 
      (v_line.retail_price * v_line.quantity * COALESCE(v_line.tax_rate, 20) / (100 + COALESCE(v_line.tax_rate, 20)));
  END LOOP;

  v_total_margin := v_total_retail - v_total_embedded_vat - v_total_cost;

  SELECT id INTO v_period_id FROM fiscal_periods
    WHERE tenant_id = v_tenant_id AND is_closed = false
    AND start_date <= v_kal.document_date AND end_date >= v_kal.document_date
    LIMIT 1;

  INSERT INTO journal_entries (tenant_id, legal_entity_id, entry_date, description, reference_type, reference_id, fiscal_period_id, status)
  VALUES (v_tenant_id, v_legal_entity_id, v_kal.document_date, 'Kalkulacija ' || v_kal.document_number, 'kalkulacija', p_kalkulacija_id, v_period_id, 'posted')
  RETURNING id INTO v_je_id;

  -- D: 1320 Roba u maloprodaji (total retail incl. VAT)
  INSERT INTO journal_entry_lines (journal_entry_id, tenant_id, account_code, debit, credit, description)
  VALUES (v_je_id, v_tenant_id, '1320', v_total_retail, 0, 'Roba u maloprodaji');

  -- P: 1300 Roba (cost)
  INSERT INTO journal_entry_lines (journal_entry_id, tenant_id, account_code, debit, credit, description)
  VALUES (v_je_id, v_tenant_id, '1300', 0, v_total_cost, 'Nabavna vrednost robe');

  -- P: 1329 Razlika u ceni (margin only, excl VAT)
  INSERT INTO journal_entry_lines (journal_entry_id, tenant_id, account_code, debit, credit, description)
  VALUES (v_je_id, v_tenant_id, '1329', 0, v_total_margin, 'Razlika u ceni robe');

  -- P: 1340 Ukalkulisani PDV u prometu na malo (embedded VAT)
  INSERT INTO journal_entry_lines (journal_entry_id, tenant_id, account_code, debit, credit, description)
  VALUES (v_je_id, v_tenant_id, '1340', 0, v_total_embedded_vat, 'Ukalkulisani PDV u prometu na malo');

  UPDATE kalkulacije SET status = 'posted', journal_entry_id = v_je_id, updated_at = now()
  WHERE id = p_kalkulacija_id;

  RETURN v_je_id;
END;
$$;

-- =============================================
-- Update post_nivelacija with embedded VAT split
-- =============================================
CREATE OR REPLACE FUNCTION public.post_nivelacija(p_nivelacija_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_niv RECORD;
  v_line RECORD;
  v_je_id uuid;
  v_tenant_id uuid;
  v_legal_entity_id uuid;
  v_total_diff numeric := 0;
  v_total_vat_diff numeric := 0;
  v_total_margin_diff numeric := 0;
  v_period_id uuid;
BEGIN
  SELECT * INTO v_niv FROM nivelacije WHERE id = p_nivelacija_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nivelacija not found'; END IF;
  IF v_niv.status = 'posted' THEN RAISE EXCEPTION 'Already posted'; END IF;

  v_tenant_id := v_niv.tenant_id;
  v_legal_entity_id := v_niv.legal_entity_id;

  FOR v_line IN SELECT * FROM nivelacija_lines WHERE nivelacija_id = p_nivelacija_id
  LOOP
    v_total_diff := v_total_diff + (v_line.price_difference * v_line.quantity);
    v_total_vat_diff := v_total_vat_diff + 
      (v_line.price_difference * v_line.quantity * COALESCE(v_line.tax_rate, 20) / (100 + COALESCE(v_line.tax_rate, 20)));
  END LOOP;

  v_total_margin_diff := v_total_diff - v_total_vat_diff;

  SELECT id INTO v_period_id FROM fiscal_periods
    WHERE tenant_id = v_tenant_id AND is_closed = false
    AND start_date <= v_niv.document_date AND end_date >= v_niv.document_date
    LIMIT 1;

  INSERT INTO journal_entries (tenant_id, legal_entity_id, entry_date, description, reference_type, reference_id, fiscal_period_id, status)
  VALUES (v_tenant_id, v_legal_entity_id, v_niv.document_date, 'Nivelacija ' || v_niv.document_number, 'nivelacija', p_nivelacija_id, v_period_id, 'posted')
  RETURNING id INTO v_je_id;

  IF v_total_diff > 0 THEN
    INSERT INTO journal_entry_lines (journal_entry_id, tenant_id, account_code, debit, credit, description)
    VALUES (v_je_id, v_tenant_id, '1320', v_total_diff, 0, 'Povećanje maloprodajne cene');
    INSERT INTO journal_entry_lines (journal_entry_id, tenant_id, account_code, debit, credit, description)
    VALUES (v_je_id, v_tenant_id, '1329', 0, v_total_margin_diff, 'Povećanje razlike u ceni');
    INSERT INTO journal_entry_lines (journal_entry_id, tenant_id, account_code, debit, credit, description)
    VALUES (v_je_id, v_tenant_id, '1340', 0, v_total_vat_diff, 'Povećanje ukalkulisanog PDV');
  ELSIF v_total_diff < 0 THEN
    INSERT INTO journal_entry_lines (journal_entry_id, tenant_id, account_code, debit, credit, description)
    VALUES (v_je_id, v_tenant_id, '1329', ABS(v_total_margin_diff), 0, 'Smanjenje razlike u ceni');
    INSERT INTO journal_entry_lines (journal_entry_id, tenant_id, account_code, debit, credit, description)
    VALUES (v_je_id, v_tenant_id, '1340', ABS(v_total_vat_diff), 0, 'Smanjenje ukalkulisanog PDV');
    INSERT INTO journal_entry_lines (journal_entry_id, tenant_id, account_code, debit, credit, description)
    VALUES (v_je_id, v_tenant_id, '1320', 0, ABS(v_total_diff), 'Smanjenje maloprodajne cene');
  END IF;

  UPDATE nivelacije SET status = 'posted', journal_entry_id = v_je_id, updated_at = now()
  WHERE id = p_nivelacija_id;

  RETURN v_je_id;
END;
$$;
