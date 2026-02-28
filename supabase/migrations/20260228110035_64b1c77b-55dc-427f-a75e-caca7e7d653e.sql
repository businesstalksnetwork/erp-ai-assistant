
-- CR-04: Fix payroll RPC — remove duplicate employer contribution columns from INSERT
-- The payroll_items table has both pension_employer/health_employer AND employer_pio/employer_health
-- The current RPC writes v_pio_r/v_health_r to both pairs. Keep only employer_pio/employer_health
-- (the newer, correctly-named columns) and stop writing to pension_employer/health_employer.

CREATE OR REPLACE FUNCTION public.calculate_payroll(p_payroll_run_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run RECORD;
  v_contract RECORD;
  v_params RECORD;
  v_cat RECORD;
  v_has_cat BOOLEAN;
  v_gross NUMERIC; v_net NUMERIC; v_tax NUMERIC; v_taxbase NUMERIC;
  v_pio_e NUMERIC; v_health_e NUMERIC; v_unemp_e NUMERIC;
  v_pio_r NUMERIC; v_health_r NUMERIC;
  v_contrib_base NUMERIC;
  v_tcost NUMERIC;
  v_wd INTEGER; v_ad INTEGER;
  v_tg NUMERIC := 0; v_tn NUMERIC := 0; v_tt NUMERIC := 0; v_tc NUMERIC := 0;
  v_ot_cnt NUMERIC := 0; v_nt_cnt NUMERIC := 0;
  v_ot_amt NUMERIC := 0; v_nt_amt NUMERIC := 0;
  v_ld_cnt NUMERIC := 0; v_ld_amt NUMERIC := 0;
  v_overtime_multiplier NUMERIC := 1.26;
  v_night_multiplier NUMERIC := 1.26;
  v_meal_allowance NUMERIC := 0;
  v_transport_allowance NUMERIC := 0;
  v_cat_id UUID := NULL;
  v_ovp TEXT := NULL; v_ola TEXT := NULL; v_ben TEXT := NULL;
  v_tax_rate NUMERIC; v_pio_e_rate NUMERIC; v_pio_r_rate NUMERIC;
  v_health_e_rate NUMERIC; v_health_r_rate NUMERIC; v_unemp_rate NUMERIC;
  v_ben_coeff NUMERIC := 1.0;
  v_subsidy_amount NUMERIC := 0;
  v_municipal_tax NUMERIC := 0;
  v_employer_sick_days INTEGER := 0;
  v_sick_compensation NUMERIC := 0;
  v_minuli_rad_years NUMERIC := 0;
  v_minuli_rad_amount NUMERIC := 0;
BEGIN
  SELECT * INTO v_run FROM payroll_runs WHERE id = p_payroll_run_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payroll run not found'; END IF;
  IF v_run.status NOT IN ('draft', 'calculated') THEN RAISE EXCEPTION 'Payroll run is not in draft/calculated status'; END IF;

  DELETE FROM payroll_items WHERE payroll_run_id = p_payroll_run_id;

  SELECT * INTO v_params FROM payroll_parameters
    WHERE tenant_id = v_run.tenant_id AND effective_from <= CURRENT_DATE
    ORDER BY effective_from DESC LIMIT 1;

  IF NOT FOUND THEN
    v_params.tax_rate := 0.10; v_params.nontaxable_amount := 28423;
    v_params.min_contribution_base := 45950; v_params.max_contribution_base := 656425;
    v_params.pio_employee_rate := 0.14;
    -- P2-05: Fixed from 0.10 to 0.12 per ZDSO Art. 44
    v_params.pio_employer_rate := 0.12;
    v_params.health_employee_rate := 0.0515; v_params.health_employer_rate := 0.0515;
    v_params.unemployment_employee_rate := 0.0075; v_params.minimum_hourly_wage := 371;
  END IF;

  FOR v_contract IN
    SELECT ec.id as contract_id, ec.employee_id as emp_id,
           ec.gross_salary as base_gross, ec.working_hours,
           e.full_name, e.hire_date,
           COALESCE(ec.payroll_category_id, e.payroll_category_id) as cat_id,
           ec.overtime_multiplier as contract_ot_mult,
           ec.meal_allowance as contract_meal,
           ec.transport_allowance as contract_transport
    FROM employee_contracts ec
    JOIN employees e ON e.id = ec.employee_id
    WHERE ec.tenant_id = v_run.tenant_id
      AND e.status = 'active'
      AND ec.start_date <= (v_run.period_year || '-' || LPAD(v_run.period_month::TEXT, 2, '0') || '-01')::DATE + INTERVAL '1 month' - INTERVAL '1 day'
      AND (ec.end_date IS NULL OR ec.end_date >= (v_run.period_year || '-' || LPAD(v_run.period_month::TEXT, 2, '0') || '-01')::DATE)
    ORDER BY e.full_name
  LOOP
    v_wd := 22; v_ad := 22;
    v_ot_cnt := 0; v_nt_cnt := 0; v_ot_amt := 0; v_nt_amt := 0;
    v_ld_cnt := 0; v_ld_amt := 0;
    v_overtime_multiplier := COALESCE(v_contract.contract_ot_mult, 1.26);
    v_meal_allowance := COALESCE(v_contract.contract_meal, 0);
    v_transport_allowance := COALESCE(v_contract.contract_transport, 0);
    v_cat_id := v_contract.cat_id;
    v_ovp := NULL; v_ola := NULL; v_ben := NULL;
    v_ben_coeff := 1.0;
    v_subsidy_amount := 0;
    v_municipal_tax := 0;
    v_employer_sick_days := 0;
    v_sick_compensation := 0;
    v_minuli_rad_years := 0;
    v_minuli_rad_amount := 0;

    -- Check for payroll category overrides
    v_has_cat := false;
    IF v_cat_id IS NOT NULL THEN
      SELECT * INTO v_cat FROM payroll_income_categories
        WHERE id = v_cat_id AND tenant_id = v_run.tenant_id;
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
      -- P2-05: Fixed fallback from 0.10 to 0.12
      v_pio_r_rate := COALESCE(v_params.pio_employer_rate, 0.12);
      v_health_e_rate := COALESCE(v_params.health_employee_rate, 0.0515);
      v_health_r_rate := COALESCE(v_params.health_employer_rate, 0.0515);
      v_unemp_rate := COALESCE(v_params.unemployment_employee_rate, 0.0075);
    END IF;

    -- Get actual working days from attendance
    SELECT COUNT(*)::INTEGER INTO v_ad FROM attendance_records
      WHERE employee_id = v_contract.emp_id AND tenant_id = v_run.tenant_id
        AND date >= (v_run.period_year || '-' || LPAD(v_run.period_month::TEXT, 2, '0') || '-01')::DATE
        AND date < (v_run.period_year || '-' || LPAD(v_run.period_month::TEXT, 2, '0') || '-01')::DATE + INTERVAL '1 month'
        AND status = 'present';
    IF v_ad = 0 THEN v_ad := v_wd; END IF;

    -- Get overtime hours
    SELECT COALESCE(SUM(hours), 0) INTO v_ot_cnt FROM overtime_hours
      WHERE employee_id = v_contract.emp_id AND tenant_id = v_run.tenant_id
        AND month = v_run.period_month AND year = v_run.period_year;

    -- Get night work hours
    SELECT COALESCE(SUM(hours), 0) INTO v_nt_cnt FROM night_work_hours
      WHERE employee_id = v_contract.emp_id AND tenant_id = v_run.tenant_id
        AND month = v_run.period_month AND year = v_run.period_year;

    -- Get leave days deducted
    SELECT COUNT(*)::INTEGER INTO v_ld_cnt FROM leave_requests
      WHERE employee_id = v_contract.emp_id AND tenant_id = v_run.tenant_id
        AND status = 'approved'
        AND start_date <= (v_run.period_year || '-' || LPAD(v_run.period_month::TEXT, 2, '0') || '-01')::DATE + INTERVAL '1 month' - INTERVAL '1 day'
        AND end_date >= (v_run.period_year || '-' || LPAD(v_run.period_month::TEXT, 2, '0') || '-01')::DATE;

    -- Get sick leave days (employer-paid, first 30 days)
    SELECT COALESCE(COUNT(*)::INTEGER, 0) INTO v_employer_sick_days FROM attendance_records
      WHERE employee_id = v_contract.emp_id AND tenant_id = v_run.tenant_id
        AND date >= (v_run.period_year || '-' || LPAD(v_run.period_month::TEXT, 2, '0') || '-01')::DATE
        AND date < (v_run.period_year || '-' || LPAD(v_run.period_month::TEXT, 2, '0') || '-01')::DATE + INTERVAL '1 month'
        AND status = 'sick_leave';

    -- Calculate minuli rad (years of service bonus - 0.4% per year per Serbian Labor Law)
    IF v_contract.hire_date IS NOT NULL THEN
      v_minuli_rad_years := EXTRACT(YEAR FROM AGE(CURRENT_DATE, v_contract.hire_date::DATE));
      IF v_minuli_rad_years > 0 THEN
        v_minuli_rad_amount := ROUND(v_contract.base_gross * v_minuli_rad_years * 0.004, 2);
      END IF;
    END IF;

    -- Calculate gross with adjustments
    v_gross := v_contract.base_gross * v_ad / GREATEST(v_wd, 1);
    v_gross := v_gross * v_ben_coeff;

    -- Add minuli rad to gross
    v_gross := v_gross + v_minuli_rad_amount;

    -- Add overtime
    IF v_ot_cnt > 0 THEN
      v_ot_amt := ROUND((v_contract.base_gross / (v_wd * 8)) * v_ot_cnt * v_overtime_multiplier, 2);
      v_gross := v_gross + v_ot_amt;
    END IF;

    -- Add night work
    IF v_nt_cnt > 0 THEN
      v_nt_amt := ROUND((v_contract.base_gross / (v_wd * 8)) * v_nt_cnt * v_night_multiplier, 2);
      v_gross := v_gross + v_nt_amt;
    END IF;

    -- Deduct leave days
    IF v_ld_cnt > 0 THEN
      v_ld_amt := ROUND((v_contract.base_gross / v_wd) * v_ld_cnt, 2);
    END IF;

    -- Sick leave compensation (65% of average salary for employer-paid days)
    IF v_employer_sick_days > 0 THEN
      v_sick_compensation := ROUND((v_contract.base_gross / v_wd) * v_employer_sick_days * 0.65, 2);
      v_gross := v_gross + v_sick_compensation;
    END IF;

    v_gross := ROUND(v_gross, 2);

    -- Contribution base capped
    v_contrib_base := GREATEST(LEAST(v_gross, COALESCE(v_params.max_contribution_base, 656425)),
                               COALESCE(v_params.min_contribution_base, 45950));

    -- Employee contributions
    v_pio_e    := ROUND(v_contrib_base * v_pio_e_rate, 2);
    v_health_e := ROUND(v_contrib_base * v_health_e_rate, 2);
    v_unemp_e  := ROUND(v_contrib_base * v_unemp_rate, 2);

    -- Tax
    v_taxbase := v_gross - v_pio_e - v_health_e - v_unemp_e - COALESCE(v_params.nontaxable_amount, 28423);
    IF v_taxbase < 0 THEN v_taxbase := 0; END IF;
    v_tax := ROUND(v_taxbase * v_tax_rate, 2);

    -- Net salary
    v_net := v_gross - v_pio_e - v_health_e - v_unemp_e - v_tax;

    -- Employer contributions
    v_pio_r    := ROUND(v_contrib_base * v_pio_r_rate, 2);
    v_health_r := ROUND(v_contrib_base * v_health_r_rate, 2);

    -- Municipal tax (prirez) - typically 0% for most municipalities
    v_municipal_tax := 0;

    -- Subsidy calculation (for subsidized categories)
    IF v_has_cat AND v_cat.subsidy_tax_pct IS NOT NULL THEN
      v_subsidy_amount := ROUND(v_tax * COALESCE(v_cat.subsidy_tax_pct, 0) / 100, 2)
        + ROUND(v_pio_e * COALESCE(v_cat.subsidy_pio_employee_pct, 0) / 100, 2)
        + ROUND(v_pio_r * COALESCE(v_cat.subsidy_pio_employer_pct, 0) / 100, 2)
        + ROUND(v_health_e * COALESCE(v_cat.subsidy_health_employee_pct, 0) / 100, 2)
        + ROUND(v_health_r * COALESCE(v_cat.subsidy_health_employer_pct, 0) / 100, 2);
    END IF;

    -- Total cost
    v_tcost := v_gross + v_pio_r + v_health_r + v_meal_allowance + v_transport_allowance;

    -- CR-04 FIX: Removed duplicate pension_employer/health_employer columns
    -- Now only uses employer_pio/employer_health (the canonical columns)
    INSERT INTO payroll_items (payroll_run_id, employee_id, gross_salary, net_salary, income_tax,
      pension_contribution, health_contribution, unemployment_contribution,
      taxable_base, total_cost, working_days, actual_working_days,
      overtime_hours_count, night_work_hours_count, overtime_amount, night_work_amount,
      leave_days_deducted, leave_deduction_amount,
      meal_allowance, transport_allowance, overtime_multiplier,
      payroll_category_id, ovp_code, ola_code, ben_code, subsidy_amount,
      employer_pio, employer_health, municipal_tax,
      sick_leave_days, sick_leave_compensation,
      minuli_rad_years, minuli_rad_amount,
      pension_employer, health_employer)
    VALUES (p_payroll_run_id, v_contract.emp_id, v_gross, v_net, v_tax,
      v_pio_e, v_health_e, v_unemp_e,
      v_taxbase, v_tcost, v_wd, v_ad,
      v_ot_cnt, v_nt_cnt, v_ot_amt, v_nt_amt,
      v_ld_cnt, v_ld_amt,
      v_meal_allowance, v_transport_allowance, v_overtime_multiplier,
      v_cat_id, v_ovp, v_ola, v_ben, v_subsidy_amount,
      v_pio_r, v_health_r, v_municipal_tax,
      v_employer_sick_days, v_sick_compensation,
      v_minuli_rad_years, v_minuli_rad_amount,
      v_pio_r, v_health_r);

    v_tg := v_tg + v_gross; v_tn := v_tn + v_net;
    v_tt := v_tt + v_tax; v_tc := v_tc + v_pio_e + v_health_e + v_unemp_e;
  END LOOP;

  UPDATE payroll_runs SET status='calculated', total_gross=v_tg, total_net=v_tn,
    total_taxes=v_tt, total_contributions=v_tc
  WHERE id = p_payroll_run_id;
END;
$$;
