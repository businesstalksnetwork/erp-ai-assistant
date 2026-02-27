
-- Phase 5: Seed Class 7, Class 8, and missing Class 4 accounts
-- Also update calculate_payroll_for_run fallback values for 2026

-- Seed Class 7 accounts (Opening/Closing accounts)
INSERT INTO public.chart_of_accounts (tenant_id, code, name, name_sr, account_type, is_system, level, parent_id)
SELECT t.id, a.code, a.name, a.name_sr, a.account_type, false, 
  CASE WHEN length(a.code) = 1 THEN 1 WHEN length(a.code) = 2 THEN 2 WHEN length(a.code) = 3 THEN 3 ELSE 4 END,
  NULL
FROM tenants t
CROSS JOIN (VALUES
  ('7', 'Opening and closing accounts', 'Otvaranje i zaključivanje računa', 'equity'),
  ('70', 'Opening balance sheet account', 'Račun otvaranja glavne knjige', 'equity'),
  ('700', 'Opening balance sheet', 'Račun otvaranja', 'equity'),
  ('7000', 'Opening balance sheet - assets', 'Račun otvaranja - aktiva', 'equity'),
  ('7001', 'Opening balance sheet - liabilities', 'Račun otvaranja - pasiva', 'equity'),
  ('71', 'Income statement account', 'Račun dobitka i gubitka', 'equity'),
  ('710', 'Revenue accounts closing', 'Zaključivanje konta prihoda', 'equity'),
  ('7100', 'Revenue closing', 'Zaključak prihoda', 'equity'),
  ('711', 'Expense accounts closing', 'Zaključivanje konta rashoda', 'equity'),
  ('7110', 'Expense closing', 'Zaključak rashoda', 'equity'),
  ('72', 'Profit/loss for the year', 'Rezultat poslovanja', 'equity'),
  ('720', 'Profit for the year', 'Dobitak poslovne godine', 'equity'),
  ('7200', 'Net profit', 'Neto dobitak', 'equity'),
  ('721', 'Loss for the year', 'Gubitak poslovne godine', 'equity'),
  ('7210', 'Net loss', 'Neto gubitak', 'equity'),
  ('73', 'Retained earnings/losses', 'Neraspoređeni dobitak/gubitak', 'equity'),
  ('7300', 'Retained earnings', 'Neraspoređeni dobitak', 'equity'),
  ('7310', 'Accumulated losses', 'Nepokriveni gubitak', 'equity'),
  -- Class 8: Off-balance sheet
  ('8', 'Off-balance sheet accounts', 'Vanbilansna evidencija', 'asset'),
  ('80', 'Off-balance sheet assets', 'Vanbilansna aktiva', 'asset'),
  ('800', 'Guarantees received', 'Primljene garancije', 'asset'),
  ('8000', 'Bank guarantees received', 'Primljene bankarske garancije', 'asset'),
  ('8001', 'Other guarantees received', 'Ostale primljene garancije', 'asset'),
  ('801', 'Leased assets (operating)', 'Imovina u operativnom lizingu', 'asset'),
  ('8010', 'Leased equipment', 'Oprema u lizingu', 'asset'),
  ('8011', 'Leased vehicles', 'Vozila u lizingu', 'asset'),
  ('802', 'Consignment inventory', 'Roba u konsignaciji', 'asset'),
  ('8020', 'Goods held on consignment', 'Roba primljena u konsignaciju', 'asset'),
  ('803', 'Collateral received', 'Primljeni kolaterali', 'asset'),
  ('8030', 'Securities as collateral', 'Hartije od vrednosti kao kolateral', 'asset'),
  ('89', 'Off-balance sheet liabilities', 'Vanbilansna pasiva', 'liability'),
  ('890', 'Guarantees given', 'Izdate garancije', 'liability'),
  ('8900', 'Bank guarantees given', 'Izdate bankarske garancije', 'liability'),
  ('8901', 'Other guarantees given', 'Ostale izdate garancije', 'liability'),
  ('891', 'Commitments', 'Preuzete obaveze', 'liability'),
  ('8910', 'Purchase commitments', 'Obaveze po ugovorima o kupovini', 'liability'),
  -- Missing Class 4 accounts (4350+)
  ('435', 'VAT obligations - other', 'Obaveze za PDV - ostalo', 'liability'),
  ('4350', 'VAT on advances received', 'PDV na primljene avanse', 'liability'),
  ('4351', 'VAT on imports', 'PDV pri uvozu', 'liability'),
  ('436', 'Other tax obligations', 'Ostale poreske obaveze', 'liability'),
  ('4360', 'Property tax obligation', 'Obaveza za porez na imovinu', 'liability'),
  ('4361', 'Municipal tax', 'Komunalna taksa', 'liability'),
  ('4362', 'Environmental tax', 'Naknada za zaštitu životne sredine', 'liability'),
  ('4363', 'Excise tax', 'Akcize', 'liability'),
  ('437', 'Obligations for other contributions', 'Obaveze za ostale doprinose', 'liability'),
  ('4370', 'Chamber of commerce contribution', 'Doprinos za privrednu komoru', 'liability'),
  ('4371', 'Other mandatory contributions', 'Ostali obavezni doprinosi', 'liability'),
  ('438', 'Obligations for interest and penalties', 'Obaveze za kamate i kazne', 'liability'),
  ('4380', 'Interest on tax debt', 'Kamata na poreski dug', 'liability'),
  ('4381', 'Tax penalties', 'Poreske kazne', 'liability'),
  ('439', 'Other fiscal obligations', 'Ostale fiskalne obaveze', 'liability'),
  ('4390', 'Other fiscal obligations', 'Ostale fiskalne obaveze', 'liability')
) AS a(code, name, name_sr, account_type)
ON CONFLICT DO NOTHING;

-- Now fix parent_id references for newly inserted accounts
UPDATE public.chart_of_accounts child
SET parent_id = parent.id
FROM public.chart_of_accounts parent
WHERE child.tenant_id = parent.tenant_id
  AND child.parent_id IS NULL
  AND length(child.code) > 1
  AND parent.code = left(child.code, length(child.code) - 1)
  AND child.code IN ('70','700','7000','7001','71','710','7100','711','7110','72','720','7200','721','7210','73','7300','7310',
    '80','800','8000','8001','801','8010','8011','802','8020','803','8030','89','890','8900','8901','891','8910',
    '435','4350','4351','436','4360','4361','4362','4363','437','4370','4371','438','4380','4381','439','4390');

-- Update calculate_payroll_for_run fallback values for 2026
CREATE OR REPLACE FUNCTION calculate_payroll_for_run(p_payroll_run_id UUID)
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
  v_pt_rec RECORD;
  v_pt_additional numeric := 0;
  v_hourly_rate numeric;
BEGIN
  SELECT * INTO v_run FROM payroll_runs WHERE id = p_payroll_run_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payroll run not found'; END IF;

  v_period_start := make_date(v_run.period_year, v_run.period_month, 1);
  v_period_end := (v_period_start + INTERVAL '1 month' - INTERVAL '1 day')::date;

  SELECT * INTO v_params FROM payroll_parameters
    WHERE tenant_id = v_run.tenant_id AND effective_from <= v_period_start
    ORDER BY effective_from DESC LIMIT 1;

  IF NOT FOUND THEN
    -- 2026 fallback values (Sl. glasnik RS 109/2025, 123/2025)
    v_params.tax_rate := 0.10; v_params.nontaxable_amount := 34221;
    v_params.min_contribution_base := 51297; v_params.max_contribution_base := 732820;
    v_params.pio_employee_rate := 0.14; v_params.pio_employer_rate := 0.12;
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
        v_ovp := COALESCE(v_cat.ovp_code, '101');
        v_ola := COALESCE(v_cat.ola_code, '00');
        v_ben := COALESCE(v_cat.ben_code, '0');
      END IF;
    END IF;

    IF NOT v_has_cat THEN
      v_tax_rate := v_params.tax_rate; v_pio_e_rate := v_params.pio_employee_rate;
      v_pio_r_rate := v_params.pio_employer_rate; v_health_e_rate := v_params.health_employee_rate;
      v_health_r_rate := v_params.health_employer_rate; v_unemp_rate := v_params.unemployment_employee_rate;
    END IF;

    -- Proration for partial months
    v_contract_start := v_contract.contract_start;
    v_contract_end := v_contract.contract_end;
    v_proration_factor := 1.0;

    IF v_contract_start > v_period_start THEN
      v_ad := extract(day from v_period_end)::int - extract(day from v_contract_start)::int + 1;
      v_proration_factor := v_ad::numeric / extract(day from v_period_end)::numeric;
    END IF;
    IF v_contract_end IS NOT NULL AND v_contract_end < v_period_end THEN
      v_ad := extract(day from v_contract_end)::int;
      v_proration_factor := LEAST(v_proration_factor, v_ad::numeric / extract(day from v_period_end)::numeric);
    END IF;

    v_gross := ROUND(v_gross * v_proration_factor, 2);

    -- Work hours and payment types from work_logs
    v_work_hours := COALESCE(v_contract.wk_hours, 40);
    v_monthly_fund_hours := v_wd * (v_work_hours / 5.0);
    v_hourly_rate := CASE WHEN v_monthly_fund_hours > 0 THEN v_gross / v_monthly_fund_hours ELSE 0 END;

    -- Overtime, night, leave from work_logs
    v_ot_cnt := 0; v_nt_cnt := 0; v_ld_cnt := 0; v_pt_additional := 0;

    FOR v_pt_rec IN
      SELECT payment_type, COALESCE(SUM(hours), 0) as total_hours
      FROM work_logs
      WHERE employee_id = v_contract.emp_id
        AND work_date BETWEEN v_period_start AND v_period_end
      GROUP BY payment_type
    LOOP
      CASE v_pt_rec.payment_type
        WHEN 'overtime' THEN v_ot_cnt := v_pt_rec.total_hours;
        WHEN 'night' THEN v_nt_cnt := v_pt_rec.total_hours;
        WHEN 'holiday' THEN v_ld_cnt := v_pt_rec.total_hours;
        ELSE NULL;
      END CASE;
    END LOOP;

    v_ot_amt := ROUND(v_hourly_rate * v_ot_cnt * (v_overtime_multiplier - 1), 2);
    v_nt_amt := ROUND(v_hourly_rate * v_nt_cnt * v_night_multiplier, 2);
    v_ld_amt := ROUND(v_hourly_rate * v_ld_cnt * 0.10, 2);
    v_pt_additional := v_ot_amt + v_nt_amt + v_ld_amt;

    v_gross := v_gross + v_pt_additional;

    -- Minimum wage check
    v_min_gross := v_min_hourly_wage * v_monthly_fund_hours * 1.3; -- approximate gross from net minimum
    IF v_gross < v_min_gross AND v_proration_factor >= 0.9 THEN
      v_gross := v_min_gross;
    END IF;

    -- Meal & transport allowances
    v_meal_allowance := COALESCE(v_params.meal_allowance_daily, 0) * v_wd * v_proration_factor;
    v_transport_allowance := COALESCE(v_params.transport_allowance_monthly, 0) * v_proration_factor;

    -- Subsidies
    v_subsidy_amount := 0;
    BEGIN
      SELECT COALESCE(SUM(monthly_amount), 0) INTO v_subsidy_amount
      FROM payroll_subsidies
      WHERE employee_id = v_contract.emp_id
        AND tenant_id = v_run.tenant_id
        AND is_active = true
        AND start_date <= v_period_end
        AND (end_date IS NULL OR end_date >= v_period_start);
    EXCEPTION WHEN undefined_table THEN v_subsidy_amount := 0;
    END;

    -- Contribution base with beneficiary coefficient
    v_contrib_base := ROUND(v_gross * v_ben_coeff, 2);
    v_min_base := COALESCE(v_params.min_contribution_base, 51297);
    v_max_base := COALESCE(v_params.max_contribution_base, 732820);
    IF v_contrib_base < v_min_base THEN v_contrib_base := v_min_base; END IF;
    IF v_contrib_base > v_max_base THEN v_contrib_base := v_max_base; END IF;

    -- Employee contributions
    v_pio_e := ROUND(v_contrib_base * v_pio_e_rate, 2);
    v_health_e := ROUND(v_contrib_base * v_health_e_rate, 2);
    v_unemp_e := ROUND(v_contrib_base * v_unemp_rate, 2);

    -- Income tax
    v_taxbase := v_gross - COALESCE(v_params.nontaxable_amount, 34221);
    IF v_taxbase < 0 THEN v_taxbase := 0; END IF;
    v_tax := ROUND(v_taxbase * v_tax_rate, 2);

    -- Municipal tax
    v_municipal_tax := ROUND(v_taxbase * v_contract.emp_municipal_tax_rate, 2);

    -- Net salary
    v_net := v_gross - v_pio_e - v_health_e - v_unemp_e - v_tax - v_municipal_tax + v_meal_allowance + v_transport_allowance;
    IF v_net < 0 THEN v_net := 0; END IF;

    -- Employer contributions
    v_pio_r := ROUND(v_contrib_base * v_pio_r_rate, 2);
    v_health_r := ROUND(v_contrib_base * v_health_r_rate, 2);

    -- Total employer cost
    v_tcost := v_gross + v_pio_r + v_health_r - v_subsidy_amount;
    IF v_tcost < 0 THEN v_tcost := 0; END IF;

    INSERT INTO payroll_items (
      payroll_run_id, employee_id, tenant_id,
      gross_salary, net_salary, income_tax,
      pension_contribution, health_contribution, unemployment_contribution,
      taxable_base, employer_pension, employer_health, total_cost,
      subsidy_amount, meal_allowance, transport_allowance,
      overtime_hours, overtime_amount, night_hours, night_amount,
      municipal_tax
    ) VALUES (
      p_payroll_run_id, v_contract.emp_id, v_run.tenant_id,
      v_gross, v_net, v_tax,
      v_pio_e, v_health_e, v_unemp_e,
      v_taxbase, v_pio_r, v_health_r, v_tcost,
      v_subsidy_amount, v_meal_allowance, v_transport_allowance,
      v_ot_cnt, v_ot_amt, v_nt_cnt, v_nt_amt,
      v_municipal_tax
    );

    v_tg := v_tg + v_gross; v_tn := v_tn + v_net;
    v_tt := v_tt + v_tax; v_tc := v_tc + (v_pio_e + v_health_e + v_unemp_e);
  END LOOP;

  UPDATE payroll_runs SET
    total_gross = v_tg, total_net = v_tn,
    total_taxes = v_tt, total_contributions = v_tc,
    status = 'calculated'
  WHERE id = p_payroll_run_id;
END;
$$;
