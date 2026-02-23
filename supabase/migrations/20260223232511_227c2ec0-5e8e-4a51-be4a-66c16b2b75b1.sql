
-- Item 14: Enhanced payroll calculation with meal/transport allowances, 
-- configurable overtime multiplier, partial month proration, and municipal tax
CREATE OR REPLACE FUNCTION public.calculate_payroll_for_run(p_payroll_run_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_run RECORD; v_contract RECORD; v_params RECORD;
  v_gross numeric; v_pio_e numeric; v_health_e numeric; v_unemp_e numeric;
  v_taxbase numeric; v_tax numeric; v_net numeric; v_pio_r numeric; v_health_r numeric; v_tcost numeric;
  v_contrib_base numeric;
  v_wd int := 22; v_ad int; v_ot_amt numeric; v_nt_amt numeric; v_ld_amt numeric;
  v_ot_cnt numeric; v_nt_cnt numeric; v_ld_cnt int;
  v_tg numeric := 0; v_tn numeric := 0; v_tt numeric := 0; v_tc numeric := 0;
  v_period_start date;
  v_work_hours numeric;
  v_min_base numeric; v_max_base numeric;
  v_min_hourly_wage numeric;
  v_monthly_fund_hours numeric;
  v_min_gross numeric;
  -- New: meal/transport/overtime/municipal
  v_meal_allowance numeric := 0;
  v_transport_allowance numeric := 0;
  v_overtime_multiplier numeric := 1.26;
  v_night_multiplier numeric := 0.26;
  v_municipal_tax numeric := 0;
  v_proration_factor numeric := 1.0;
  v_contract_start date;
  v_contract_end date;
  v_period_end date;
BEGIN
  SELECT * INTO v_run FROM payroll_runs WHERE id = p_payroll_run_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payroll run not found'; END IF;

  v_period_start := make_date(v_run.period_year, v_run.period_month, 1);
  v_period_end := (v_period_start + INTERVAL '1 month' - INTERVAL '1 day')::date;

  SELECT * INTO v_params FROM payroll_parameters
    WHERE tenant_id = v_run.tenant_id AND effective_from <= v_period_start
    ORDER BY effective_from DESC LIMIT 1;

  IF NOT FOUND THEN
    v_params.tax_rate := 0.10;
    v_params.nontaxable_amount := 34221;
    v_params.min_contribution_base := 51297;
    v_params.max_contribution_base := 732820;
    v_params.pio_employee_rate := 0.14;
    v_params.pio_employer_rate := 0.11;
    v_params.health_employee_rate := 0.0515;
    v_params.health_employer_rate := 0.0515;
    v_params.unemployment_employee_rate := 0.0075;
    v_params.minimum_hourly_wage := 371;
    v_params.meal_allowance_daily := 0;
    v_params.transport_allowance_monthly := 0;
    v_params.overtime_multiplier := 1.26;
    v_params.night_work_multiplier := 0.26;
  END IF;

  v_min_hourly_wage := COALESCE(v_params.minimum_hourly_wage, 371);
  v_overtime_multiplier := COALESCE(v_params.overtime_multiplier, 1.26);
  v_night_multiplier := COALESCE(v_params.night_work_multiplier, 0.26);

  DELETE FROM payroll_items WHERE payroll_run_id = p_payroll_run_id;

  FOR v_contract IN
    SELECT ec.*, e.id as emp_id, e.first_name, e.last_name, 
           COALESCE(ec.working_hours_per_week, 40) as wk_hours,
           COALESCE(e.municipal_tax_rate, 0) as emp_municipal_tax_rate,
           ec.start_date as contract_start,
           ec.end_date as contract_end
    FROM employee_contracts ec
    JOIN employees e ON e.id = ec.employee_id
    WHERE e.tenant_id = v_run.tenant_id AND e.status = 'active'
      AND ec.start_date <= v_period_start
      AND (ec.end_date IS NULL OR ec.end_date >= v_period_start)
    ORDER BY ec.start_date DESC
  LOOP
    v_gross := COALESCE(v_contract.gross_salary, 0);
    IF v_gross = 0 THEN CONTINUE; END IF;

    v_work_hours := COALESCE(v_contract.wk_hours, 40);
    
    -- Partial month proration: if contract started mid-month or ends mid-month
    v_contract_start := v_contract.contract_start;
    v_contract_end := v_contract.contract_end;
    v_proration_factor := 1.0;
    
    IF v_contract_start > v_period_start THEN
      -- Started mid-month: prorate based on remaining working days
      v_proration_factor := GREATEST((v_wd - EXTRACT(DAY FROM v_contract_start - v_period_start)::int)::numeric / v_wd, 0);
    END IF;
    IF v_contract_end IS NOT NULL AND v_contract_end < v_period_end THEN
      -- Ends mid-month: prorate based on days worked
      v_proration_factor := LEAST(v_proration_factor, EXTRACT(DAY FROM v_contract_end - v_period_start + INTERVAL '1 day')::numeric / v_wd);
    END IF;
    
    -- Apply proration to gross
    v_gross := ROUND(v_gross * v_proration_factor, 2);
    
    -- Minimum wage validation
    v_monthly_fund_hours := (v_work_hours / 5.0) * v_wd;
    v_min_gross := v_min_hourly_wage * v_monthly_fund_hours * v_proration_factor;
    IF v_gross < v_min_gross THEN
      RAISE WARNING 'Employee % % gross salary (%) is below minimum wage equivalent (%). Adjusting to minimum.',
        v_contract.first_name, v_contract.last_name, v_gross, v_min_gross;
    END IF;

    -- Overtime with configurable multiplier
    SELECT COALESCE(SUM(hours),0) INTO v_ot_cnt
      FROM overtime_hours WHERE employee_id=v_contract.emp_id AND month=v_run.period_month AND year=v_run.period_year;
    v_ot_amt := (v_gross/(v_wd*8))*v_ot_cnt*v_overtime_multiplier;

    -- Night work with configurable multiplier
    SELECT COALESCE(SUM(hours),0) INTO v_nt_cnt
      FROM night_work_records WHERE employee_id=v_contract.emp_id AND month=v_run.period_month AND year=v_run.period_year;
    v_nt_amt := (v_gross/(v_wd*8))*v_nt_cnt*v_night_multiplier;

    SELECT COALESCE(COUNT(*),0) INTO v_ld_cnt
      FROM leave_requests WHERE employee_id=v_contract.emp_id AND status='approved' AND leave_type='unpaid'
      AND start_date<=make_date(v_run.period_year,v_run.period_month,28)
      AND end_date>=make_date(v_run.period_year,v_run.period_month,1);
    v_ld_amt := (v_gross/v_wd)*v_ld_cnt;
    v_ad := v_wd - v_ld_cnt;

    v_gross := v_gross + v_ot_amt + v_nt_amt - v_ld_amt;

    -- Meal allowance (topli obrok) — nontaxable, per working day
    v_meal_allowance := COALESCE(v_params.meal_allowance_daily, 0) * v_ad;
    
    -- Transport allowance (prevoz) — nontaxable, monthly flat
    v_transport_allowance := COALESCE(v_params.transport_allowance_monthly, 0) * v_proration_factor;

    v_min_base := COALESCE(v_params.min_contribution_base, 51297) * (v_work_hours / 40.0);
    v_max_base := COALESCE(v_params.max_contribution_base, 732820) * (v_work_hours / 40.0);
    v_contrib_base := GREATEST(v_gross, v_min_base);
    v_contrib_base := LEAST(v_contrib_base, v_max_base);

    v_pio_e    := ROUND(v_contrib_base * COALESCE(v_params.pio_employee_rate, 0.14), 2);
    v_health_e := ROUND(v_contrib_base * COALESCE(v_params.health_employee_rate, 0.0515), 2);
    v_unemp_e  := ROUND(v_contrib_base * COALESCE(v_params.unemployment_employee_rate, 0.0075), 2);

    v_taxbase := GREATEST(v_gross - COALESCE(v_params.nontaxable_amount, 34221), 0);
    v_tax     := ROUND(v_taxbase * COALESCE(v_params.tax_rate, 0.10), 2);

    -- Municipal tax (prirez) on income tax — varies by municipality
    v_municipal_tax := ROUND(v_tax * COALESCE(v_contract.emp_municipal_tax_rate, 0) / 100, 2);

    v_net := v_gross - v_pio_e - v_health_e - v_unemp_e - v_tax - v_municipal_tax;
    
    -- Add nontaxable allowances to net (they don't affect gross/tax calculation)
    v_net := v_net + v_meal_allowance + v_transport_allowance;

    v_pio_r    := ROUND(v_contrib_base * COALESCE(v_params.pio_employer_rate, 0.11), 2);
    v_health_r := ROUND(v_contrib_base * COALESCE(v_params.health_employer_rate, 0.0515), 2);

    v_tcost := v_gross + v_pio_r + v_health_r + v_meal_allowance + v_transport_allowance;

    INSERT INTO payroll_items (payroll_run_id, employee_id, gross_salary, net_salary, income_tax,
      pension_contribution, health_contribution, unemployment_contribution, pension_employer, health_employer,
      taxable_base, total_cost, working_days, actual_working_days,
      overtime_hours_count, night_work_hours_count, overtime_amount, night_work_amount,
      leave_days_deducted, leave_deduction_amount,
      meal_allowance, transport_allowance, overtime_multiplier)
    VALUES (p_payroll_run_id, v_contract.emp_id, v_gross, v_net, v_tax,
      v_pio_e, v_health_e, v_unemp_e, v_pio_r, v_health_r,
      v_taxbase, v_tcost, v_wd, v_ad,
      v_ot_cnt, v_nt_cnt, v_ot_amt, v_nt_amt,
      v_ld_cnt, v_ld_amt,
      v_meal_allowance, v_transport_allowance, v_overtime_multiplier);

    v_tg := v_tg + v_gross; v_tn := v_tn + v_net;
    v_tt := v_tt + v_tax; v_tc := v_tc + v_pio_e + v_health_e + v_unemp_e;
  END LOOP;

  UPDATE payroll_runs SET status='calculated', total_gross=v_tg, total_net=v_tn,
    total_taxes=v_tt, total_contributions=v_tc
  WHERE id = p_payroll_run_id;
END;
$function$;
