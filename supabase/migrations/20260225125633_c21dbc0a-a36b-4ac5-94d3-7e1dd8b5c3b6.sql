
-- ============================================================
-- 1. Payroll Income Categories (OVP/OLA/BEN catalog with per-category rates)
-- ============================================================
CREATE TABLE public.payroll_income_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  ovp_code TEXT NOT NULL DEFAULT '101',
  ola_code TEXT NOT NULL DEFAULT '00',
  ben_code TEXT NOT NULL DEFAULT '0',
  tax_rate NUMERIC NOT NULL DEFAULT 0.10,
  pio_employee_rate NUMERIC NOT NULL DEFAULT 0.14,
  pio_employer_rate NUMERIC NOT NULL DEFAULT 0.10,
  health_employee_rate NUMERIC NOT NULL DEFAULT 0.0515,
  health_employer_rate NUMERIC NOT NULL DEFAULT 0.0515,
  unemployment_employee_rate NUMERIC NOT NULL DEFAULT 0.0075,
  employer_tax_exempt BOOLEAN NOT NULL DEFAULT FALSE,
  employer_pio_exempt BOOLEAN NOT NULL DEFAULT FALSE,
  employer_health_exempt BOOLEAN NOT NULL DEFAULT FALSE,
  subsidy_tax_pct NUMERIC NOT NULL DEFAULT 0,
  subsidy_pio_employee_pct NUMERIC NOT NULL DEFAULT 0,
  subsidy_pio_employer_pct NUMERIC NOT NULL DEFAULT 0,
  subsidy_health_employee_pct NUMERIC NOT NULL DEFAULT 0,
  subsidy_health_employer_pct NUMERIC NOT NULL DEFAULT 0,
  ben_coefficient NUMERIC NOT NULL DEFAULT 1.0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, code)
);

ALTER TABLE public.payroll_income_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.payroll_income_categories
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

-- ============================================================
-- 2. Payroll Payment Types (Vrste plaćanja)
-- ============================================================
CREATE TABLE public.payroll_payment_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'zarada',
  is_hourly BOOLEAN NOT NULL DEFAULT TRUE,
  affects_benefits BOOLEAN NOT NULL DEFAULT TRUE,
  rate_multiplier NUMERIC NOT NULL DEFAULT 1.0,
  is_nontaxable BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, code)
);

ALTER TABLE public.payroll_payment_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.payroll_payment_types
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

-- ============================================================
-- 3. Add payroll fields to employees
-- ============================================================
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS payroll_category_id UUID REFERENCES public.payroll_income_categories(id),
  ADD COLUMN IF NOT EXISTS recipient_code TEXT DEFAULT '01',
  ADD COLUMN IF NOT EXISTS bank_account_iban TEXT,
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS pib TEXT;

-- ============================================================
-- 4. Add category link to payroll_items for audit
-- ============================================================
ALTER TABLE public.payroll_items
  ADD COLUMN IF NOT EXISTS payroll_category_id UUID REFERENCES public.payroll_income_categories(id),
  ADD COLUMN IF NOT EXISTS ovp_code TEXT,
  ADD COLUMN IF NOT EXISTS ola_code TEXT,
  ADD COLUMN IF NOT EXISTS ben_code TEXT,
  ADD COLUMN IF NOT EXISTS subsidy_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS employer_pio NUMERIC,
  ADD COLUMN IF NOT EXISTS employer_health NUMERIC,
  ADD COLUMN IF NOT EXISTS municipal_tax NUMERIC NOT NULL DEFAULT 0;

-- ============================================================
-- 5. Seed functions for default categories
-- ============================================================
CREATE OR REPLACE FUNCTION public.seed_payroll_income_categories(p_tenant_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO payroll_income_categories (tenant_id, code, name, ovp_code, ola_code, ben_code,
    tax_rate, pio_employee_rate, pio_employer_rate, health_employee_rate, health_employer_rate, unemployment_employee_rate,
    employer_tax_exempt, employer_pio_exempt, employer_health_exempt,
    subsidy_tax_pct, subsidy_pio_employee_pct, subsidy_pio_employer_pct, subsidy_health_employee_pct, subsidy_health_employer_pct,
    ben_coefficient)
  VALUES
    (p_tenant_id, 'K01', 'Opšta kategorija', '101', '00', '0', 0.10, 0.14, 0.10, 0.0515, 0.0515, 0.0075, false, false, false, 0,0,0,0,0, 1.0),
    (p_tenant_id, 'K02', 'Novozaposleni ≥50 god.', '101', '04', '0', 0.10, 0.14, 0, 0.0515, 0, 0.0075, false, true, true, 0,0,0,0,0, 1.0),
    (p_tenant_id, 'K03', 'Novozaposleni ≥45 god.', '101', '04', '0', 0.10, 0.14, 0.024, 0.0515, 0.0103, 0.0075, false, false, false, 0,0,0,0,0, 1.0),
    (p_tenant_id, 'K04', 'Pripravnici <30 god.', '101', '01', '0', 0.10, 0.14, 0, 0.0515, 0, 0.0075, false, true, true, 0,0,0,0,0, 1.0),
    (p_tenant_id, 'K05', 'Lica 30-45 god. (Uredba čl.2)', '101', '00', '0', 0.10, 0.14, 0.10, 0.0515, 0.0515, 0.0075, false, false, false, 30,100,100,0,0, 1.0),
    (p_tenant_id, 'K06', 'Lica <30 ili >45 god. (Uredba)', '101', '00', '0', 0.10, 0.14, 0.10, 0.0515, 0.0515, 0.0075, false, false, false, 100,100,100,0,0, 1.0),
    (p_tenant_id, 'K07', 'Penzioner - radni odnos', '101', '00', '0', 0.10, 0.14, 0.10, 0.0515, 0.0515, 0, false, false, false, 0,0,0,0,0, 1.0),
    (p_tenant_id, 'K08', 'Lična zarada preduzetnika', '102', '00', '0', 0.10, 0.24, 0, 0.103, 0, 0.0075, false, true, true, 0,0,0,0,0, 1.0),
    (p_tenant_id, 'K09', 'Beneficirani staž 12/14', '101', '00', '1', 0.10, 0.14, 0.10, 0.0515, 0.0515, 0.0075, false, false, false, 0,0,0,0,0, 1.167),
    (p_tenant_id, 'K10', 'Beneficirani staž 12/15', '101', '00', '2', 0.10, 0.14, 0.10, 0.0515, 0.0515, 0.0075, false, false, false, 0,0,0,0,0, 1.250),
    (p_tenant_id, 'K11', 'Beneficirani staž 12/16', '101', '00', '3', 0.10, 0.14, 0.10, 0.0515, 0.0515, 0.0075, false, false, false, 0,0,0,0,0, 1.333),
    (p_tenant_id, 'K12', 'Beneficirani staž 12/18', '101', '00', '4', 0.10, 0.14, 0.10, 0.0515, 0.0515, 0.0075, false, false, false, 0,0,0,0,0, 1.500)
  ON CONFLICT (tenant_id, code) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.seed_payroll_payment_types(p_tenant_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO payroll_payment_types (tenant_id, code, name, type, is_hourly, affects_benefits, rate_multiplier, is_nontaxable)
  VALUES
    (p_tenant_id, '100', 'Redovan rad', 'zarada', true, true, 1.0, false),
    (p_tenant_id, '101', 'Bolovanje (do 30 dana)', 'bolovanje', false, true, 0.65, false),
    (p_tenant_id, '102', 'Godišnji odmor', 'naknada', false, true, 1.0, false),
    (p_tenant_id, '103', 'Državni/Verski praznik', 'naknada', false, true, 1.0, false),
    (p_tenant_id, '104', 'Noćni rad', 'zarada', true, true, 1.26, false),
    (p_tenant_id, '109', 'Prekovremeni rad', 'zarada', true, true, 1.26, false),
    (p_tenant_id, '180', 'Topli obrok', 'naknada', false, false, 1.0, true),
    (p_tenant_id, '181', 'Regres za GO', 'naknada', false, false, 1.0, true)
  ON CONFLICT (tenant_id, code) DO NOTHING;
END;
$$;

-- ============================================================
-- 6. Upgrade calculate_payroll_for_run with per-category rates + beneficiary coeff
-- ============================================================
CREATE OR REPLACE FUNCTION public.calculate_payroll_for_run(p_payroll_run_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_run RECORD; v_contract RECORD; v_params RECORD; v_cat RECORD;
  v_gross numeric; v_pio_e numeric; v_health_e numeric; v_unemp_e numeric;
  v_taxbase numeric; v_tax numeric; v_net numeric; v_pio_r numeric; v_health_r numeric; v_tcost numeric;
  v_contrib_base numeric;
  v_wd int := 22; v_ad int; v_ot_amt numeric; v_nt_amt numeric; v_ld_amt numeric;
  v_ot_cnt numeric; v_nt_cnt numeric; v_ld_cnt int;
  v_tg numeric := 0; v_tn numeric := 0; v_tt numeric := 0; v_tc numeric := 0;
  v_period_start date; v_period_end date;
  v_work_hours numeric;
  v_min_base numeric; v_max_base numeric;
  v_min_hourly_wage numeric; v_monthly_fund_hours numeric; v_min_gross numeric;
  v_meal_allowance numeric := 0; v_transport_allowance numeric := 0;
  v_overtime_multiplier numeric := 1.26; v_night_multiplier numeric := 0.26;
  v_municipal_tax numeric := 0; v_proration_factor numeric := 1.0;
  v_contract_start date; v_contract_end date;
  v_subsidy_amount numeric := 0;
  v_tax_rate numeric; v_pio_e_rate numeric; v_pio_r_rate numeric;
  v_health_e_rate numeric; v_health_r_rate numeric; v_unemp_rate numeric;
  v_ben_coeff numeric; v_cat_id UUID; v_ovp TEXT; v_ola TEXT; v_ben TEXT;
  v_has_cat boolean;
BEGIN
  SELECT * INTO v_run FROM payroll_runs WHERE id = p_payroll_run_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payroll run not found'; END IF;

  v_period_start := make_date(v_run.period_year, v_run.period_month, 1);
  v_period_end := (v_period_start + INTERVAL '1 month' - INTERVAL '1 day')::date;

  SELECT * INTO v_params FROM payroll_parameters
    WHERE tenant_id = v_run.tenant_id AND effective_from <= v_period_start
    ORDER BY effective_from DESC LIMIT 1;

  IF NOT FOUND THEN
    v_params.tax_rate := 0.10; v_params.nontaxable_amount := 28423;
    v_params.min_contribution_base := 45950; v_params.max_contribution_base := 656425;
    v_params.pio_employee_rate := 0.14; v_params.pio_employer_rate := 0.10;
    v_params.health_employee_rate := 0.0515; v_params.health_employer_rate := 0.0515;
    v_params.unemployment_employee_rate := 0.0075; v_params.minimum_hourly_wage := 371;
    v_params.meal_allowance_daily := 0; v_params.transport_allowance_monthly := 0;
    v_params.overtime_multiplier := 1.26; v_params.night_work_multiplier := 0.26;
  END IF;

  v_min_hourly_wage := COALESCE(v_params.minimum_hourly_wage, 371);
  v_overtime_multiplier := COALESCE(v_params.overtime_multiplier, 1.26);
  v_night_multiplier := COALESCE(v_params.night_work_multiplier, 0.26);

  DELETE FROM payroll_items WHERE payroll_run_id = p_payroll_run_id;

  FOR v_contract IN
    SELECT ec.*, e.id as emp_id, e.first_name, e.last_name,
           COALESCE(ec.working_hours_per_week, 40) as wk_hours,
           COALESCE(e.municipal_tax_rate, 0) as emp_municipal_tax_rate,
           ec.start_date as contract_start, ec.end_date as contract_end,
           e.payroll_category_id as emp_cat_id
    FROM employee_contracts ec
    JOIN employees e ON e.id = ec.employee_id
    WHERE e.tenant_id = v_run.tenant_id AND e.status = 'active'
      AND ec.start_date <= v_period_start
      AND (ec.end_date IS NULL OR ec.end_date >= v_period_start)
    ORDER BY ec.start_date DESC
  LOOP
    v_gross := COALESCE(v_contract.gross_salary, 0);
    IF v_gross = 0 THEN CONTINUE; END IF;

    v_cat_id := v_contract.emp_cat_id;
    v_ovp := '101'; v_ola := '00'; v_ben := '0'; v_ben_coeff := 1.0;
    v_has_cat := false;

    IF v_cat_id IS NOT NULL THEN
      SELECT * INTO v_cat FROM payroll_income_categories WHERE id = v_cat_id AND is_active = true;
      IF FOUND THEN
        v_has_cat := true;
        v_tax_rate := v_cat.tax_rate; v_pio_e_rate := v_cat.pio_employee_rate;
        v_pio_r_rate := v_cat.pio_employer_rate; v_health_e_rate := v_cat.health_employee_rate;
        v_health_r_rate := v_cat.health_employer_rate; v_unemp_rate := v_cat.unemployment_employee_rate;
        v_ben_coeff := COALESCE(v_cat.ben_coefficient, 1.0);
        v_ovp := v_cat.ovp_code; v_ola := v_cat.ola_code; v_ben := v_cat.ben_code;
      END IF;
    END IF;

    IF NOT v_has_cat THEN
      v_tax_rate := COALESCE(v_params.tax_rate, 0.10);
      v_pio_e_rate := COALESCE(v_params.pio_employee_rate, 0.14);
      v_pio_r_rate := COALESCE(v_params.pio_employer_rate, 0.10);
      v_health_e_rate := COALESCE(v_params.health_employee_rate, 0.0515);
      v_health_r_rate := COALESCE(v_params.health_employer_rate, 0.0515);
      v_unemp_rate := COALESCE(v_params.unemployment_employee_rate, 0.0075);
      v_cat_id := NULL;
    END IF;

    v_work_hours := COALESCE(v_contract.wk_hours, 40);
    v_contract_start := v_contract.contract_start;
    v_contract_end := v_contract.contract_end;
    v_proration_factor := 1.0;
    IF v_contract_start > v_period_start THEN
      v_proration_factor := GREATEST((v_wd - EXTRACT(DAY FROM v_contract_start - v_period_start)::int)::numeric / v_wd, 0);
    END IF;
    IF v_contract_end IS NOT NULL AND v_contract_end < v_period_end THEN
      v_proration_factor := LEAST(v_proration_factor, EXTRACT(DAY FROM v_contract_end - v_period_start + INTERVAL '1 day')::numeric / v_wd);
    END IF;
    v_gross := ROUND(v_gross * v_proration_factor, 2);

    v_monthly_fund_hours := (v_work_hours / 5.0) * v_wd;
    v_min_gross := v_min_hourly_wage * v_monthly_fund_hours * v_proration_factor;
    IF v_gross < v_min_gross THEN
      RAISE WARNING 'Employee % % gross (%) below minimum (%)', v_contract.first_name, v_contract.last_name, v_gross, v_min_gross;
    END IF;

    SELECT COALESCE(SUM(hours),0) INTO v_ot_cnt FROM overtime_hours WHERE employee_id=v_contract.emp_id AND month=v_run.period_month AND year=v_run.period_year;
    v_ot_amt := (v_gross/(v_wd*8))*v_ot_cnt*v_overtime_multiplier;

    SELECT COALESCE(SUM(hours),0) INTO v_nt_cnt FROM night_work_records WHERE employee_id=v_contract.emp_id AND month=v_run.period_month AND year=v_run.period_year;
    v_nt_amt := (v_gross/(v_wd*8))*v_nt_cnt*v_night_multiplier;

    SELECT COALESCE(COUNT(*),0) INTO v_ld_cnt FROM leave_requests WHERE employee_id=v_contract.emp_id AND status='approved' AND leave_type='unpaid'
      AND start_date<=make_date(v_run.period_year,v_run.period_month,28) AND end_date>=make_date(v_run.period_year,v_run.period_month,1);
    v_ld_amt := (v_gross/v_wd)*v_ld_cnt;
    v_ad := v_wd - v_ld_cnt;
    v_gross := v_gross + v_ot_amt + v_nt_amt - v_ld_amt;

    v_meal_allowance := COALESCE(v_params.meal_allowance_daily, 0) * v_ad;
    v_transport_allowance := COALESCE(v_params.transport_allowance_monthly, 0) * v_proration_factor;

    v_min_base := COALESCE(v_params.min_contribution_base, 45950) * (v_work_hours / 40.0);
    v_max_base := COALESCE(v_params.max_contribution_base, 656425) * (v_work_hours / 40.0);
    v_contrib_base := GREATEST(v_gross, v_min_base);
    v_contrib_base := LEAST(v_contrib_base, v_max_base);

    -- Apply beneficiary coefficient to PIO base
    v_pio_e    := ROUND(v_contrib_base * v_ben_coeff * v_pio_e_rate, 2);
    v_health_e := ROUND(v_contrib_base * v_health_e_rate, 2);
    v_unemp_e  := ROUND(v_contrib_base * v_unemp_rate, 2);

    v_taxbase := GREATEST(v_gross - COALESCE(v_params.nontaxable_amount, 28423), 0);
    v_tax     := ROUND(v_taxbase * v_tax_rate, 2);
    v_municipal_tax := ROUND(v_tax * COALESCE(v_contract.emp_municipal_tax_rate, 0) / 100, 2);

    v_net := v_gross - v_pio_e - v_health_e - v_unemp_e - v_tax - v_municipal_tax;
    v_net := v_net + v_meal_allowance + v_transport_allowance;

    v_pio_r    := ROUND(v_contrib_base * v_ben_coeff * v_pio_r_rate, 2);
    v_health_r := ROUND(v_contrib_base * v_health_r_rate, 2);
    v_tcost := v_gross + v_pio_r + v_health_r + v_meal_allowance + v_transport_allowance;

    -- Subsidies
    v_subsidy_amount := 0;
    IF v_has_cat THEN
      v_subsidy_amount := ROUND(v_tax * COALESCE(v_cat.subsidy_tax_pct, 0) / 100, 2)
        + ROUND(v_pio_e * COALESCE(v_cat.subsidy_pio_employee_pct, 0) / 100, 2)
        + ROUND(v_pio_r * COALESCE(v_cat.subsidy_pio_employer_pct, 0) / 100, 2)
        + ROUND(v_health_e * COALESCE(v_cat.subsidy_health_employee_pct, 0) / 100, 2)
        + ROUND(v_health_r * COALESCE(v_cat.subsidy_health_employer_pct, 0) / 100, 2);
    END IF;

    INSERT INTO payroll_items (payroll_run_id, employee_id, gross_salary, net_salary, income_tax,
      pension_contribution, health_contribution, unemployment_contribution, pension_employer, health_employer,
      taxable_base, total_cost, working_days, actual_working_days,
      overtime_hours_count, night_work_hours_count, overtime_amount, night_work_amount,
      leave_days_deducted, leave_deduction_amount,
      meal_allowance, transport_allowance, overtime_multiplier,
      payroll_category_id, ovp_code, ola_code, ben_code, subsidy_amount,
      employer_pio, employer_health, municipal_tax)
    VALUES (p_payroll_run_id, v_contract.emp_id, v_gross, v_net, v_tax,
      v_pio_e, v_health_e, v_unemp_e, v_pio_r, v_health_r,
      v_taxbase, v_tcost, v_wd, v_ad,
      v_ot_cnt, v_nt_cnt, v_ot_amt, v_nt_amt,
      v_ld_cnt, v_ld_amt,
      v_meal_allowance, v_transport_allowance, v_overtime_multiplier,
      v_cat_id, v_ovp, v_ola, v_ben, v_subsidy_amount,
      v_pio_r, v_health_r, v_municipal_tax);

    v_tg := v_tg + v_gross; v_tn := v_tn + v_net;
    v_tt := v_tt + v_tax; v_tc := v_tc + v_pio_e + v_health_e + v_unemp_e;
  END LOOP;

  UPDATE payroll_runs SET status='calculated', total_gross=v_tg, total_net=v_tn,
    total_taxes=v_tt, total_contributions=v_tc
  WHERE id = p_payroll_run_id;
END;
$$;
