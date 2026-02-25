
-- Non-employment income records (autorski ugovori, ugovori o delu, dividende, zakup)
CREATE TABLE public.non_employment_income (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  legal_entity_id UUID REFERENCES public.legal_entities(id),
  -- Recipient info
  recipient_name TEXT NOT NULL,
  recipient_jmbg TEXT,
  recipient_pib TEXT,
  recipient_type_code TEXT DEFAULT '01',
  -- Income details
  ovp_code TEXT NOT NULL DEFAULT '301',
  description TEXT,
  gross_amount NUMERIC NOT NULL DEFAULT 0,
  normalized_expense_pct NUMERIC NOT NULL DEFAULT 0,   -- normirani troškovi %
  tax_base NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  pio_amount NUMERIC NOT NULL DEFAULT 0,
  health_amount NUMERIC NOT NULL DEFAULT 0,
  net_amount NUMERIC NOT NULL DEFAULT 0,
  -- Dates
  income_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_date DATE,
  period_year INT NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  period_month INT NOT NULL DEFAULT EXTRACT(MONTH FROM CURRENT_DATE),
  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','calculated','paid','cancelled')),
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.non_employment_income ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.non_employment_income
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE INDEX idx_nei_tenant ON public.non_employment_income(tenant_id);
CREATE INDEX idx_nei_period ON public.non_employment_income(tenant_id, period_year, period_month);

-- Function to calculate non-employment income taxes
CREATE OR REPLACE FUNCTION public.calculate_non_employment_income(p_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec RECORD;
  v_ovp RECORD;
  v_tax_base NUMERIC;
  v_tax NUMERIC;
  v_pio NUMERIC;
  v_health NUMERIC;
  v_net NUMERIC;
  v_norm_pct NUMERIC;
BEGIN
  SELECT * INTO v_rec FROM non_employment_income WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Record not found'; END IF;

  -- Look up OVP catalog for rates
  SELECT * INTO v_ovp FROM ovp_catalog WHERE ovp = v_rec.ovp_code AND is_active = true LIMIT 1;

  -- Determine normalized expense percentage from OVP
  v_norm_pct := v_rec.normalized_expense_pct;

  -- Calculate tax base (gross minus normalized expenses)
  v_tax_base := ROUND(v_rec.gross_amount * (1 - v_norm_pct / 100), 2);

  -- Standard rates for non-employment income:
  -- Tax: 20%, PIO: 25% (for self-employed/uninsured), Health: 10.3% (for uninsured)
  -- These vary by OVP code; for now use standard rates
  CASE 
    WHEN v_rec.ovp_code IN ('301','303','305') THEN
      -- Insured by other basis: only tax, no PIO/health
      v_tax := ROUND(v_tax_base * 0.20, 2);
      v_pio := 0;
      v_health := 0;
    WHEN v_rec.ovp_code IN ('302','304','306') THEN
      -- Not insured: tax + PIO + health
      v_tax := ROUND(v_tax_base * 0.20, 2);
      v_pio := ROUND(v_tax_base * 0.25, 2);
      v_health := ROUND(v_tax_base * 0.103, 2);
    WHEN v_rec.ovp_code IN ('401','402','403','404') THEN
      -- Capital income: tax only (15% for dividends, 20% for others)
      IF v_rec.ovp_code = '402' THEN
        v_tax := ROUND(v_tax_base * 0.15, 2);
      ELSE
        v_tax := ROUND(v_tax_base * 0.20, 2);
      END IF;
      v_pio := 0;
      v_health := 0;
    WHEN v_rec.ovp_code LIKE '5%' THEN
      -- Ugovor o delu (contract work)
      v_tax := ROUND(v_tax_base * 0.20, 2);
      v_pio := ROUND(v_tax_base * 0.25, 2);
      v_health := ROUND(v_tax_base * 0.103, 2);
    ELSE
      v_tax := ROUND(v_tax_base * 0.20, 2);
      v_pio := 0;
      v_health := 0;
  END CASE;

  v_net := v_rec.gross_amount - v_tax - v_pio - v_health;

  UPDATE non_employment_income SET
    tax_base = v_tax_base,
    tax_amount = v_tax,
    pio_amount = v_pio,
    health_amount = v_health,
    net_amount = v_net,
    status = 'calculated',
    updated_at = now()
  WHERE id = p_id;
END;
$$;
