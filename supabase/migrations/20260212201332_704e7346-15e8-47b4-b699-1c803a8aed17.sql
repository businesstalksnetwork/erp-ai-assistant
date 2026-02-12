
CREATE OR REPLACE FUNCTION public.calculate_payroll_for_run(p_payroll_run_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run RECORD;
  v_emp RECORD;
  v_contract RECORD;
  v_salary RECORD;
  v_gross NUMERIC;
  v_nontaxable NUMERIC := 25000;
  v_taxable NUMERIC;
  v_income_tax NUMERIC;
  v_pension NUMERIC;
  v_health NUMERIC;
  v_unemployment NUMERIC;
  v_net NUMERIC;
  v_total_cost NUMERIC;
  v_sum_gross NUMERIC := 0;
  v_sum_net NUMERIC := 0;
  v_sum_taxes NUMERIC := 0;
  v_sum_contributions NUMERIC := 0;
  v_period_start DATE;
  v_period_end DATE;
  v_standard_working_days NUMERIC := 22;
  v_actual_working_days NUMERIC;
  v_overtime NUMERIC;
  v_night_work NUMERIC;
  v_leave_days NUMERIC;
  v_leave_deduction NUMERIC;
  v_daily_rate NUMERIC;
  v_sick_days NUMERIC;
  v_unpaid_days NUMERIC;
  v_sick_compensation NUMERIC;
  v_deduction_total NUMERIC;
  v_allowance_total NUMERIC;
  v_adjusted_gross NUMERIC;
BEGIN
  SELECT * INTO v_run FROM payroll_runs WHERE id = p_payroll_run_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payroll run not found'; END IF;

  v_period_start := make_date(v_run.period_year, v_run.period_month, 1);
  v_period_end := (v_period_start + interval '1 month' - interval '1 day')::date;

  -- Clear existing items
  DELETE FROM payroll_items WHERE payroll_run_id = p_payroll_run_id;

  FOR v_emp IN
    SELECT e.* FROM employees e
    WHERE e.tenant_id = v_run.tenant_id
      AND e.status = 'active'
      AND (e.is_archived IS NULL OR e.is_archived = false)
  LOOP
    -- Get salary: prefer employee_salaries history, fallback to employee_contracts
    SELECT * INTO v_salary FROM employee_salaries
      WHERE employee_id = v_emp.id AND tenant_id = v_run.tenant_id
        AND start_date <= v_period_end
      ORDER BY start_date DESC LIMIT 1;

    IF v_salary IS NOT NULL THEN
      v_gross := v_salary.amount;
      -- If net salary, estimate gross (rough: net / 0.701)
      IF v_salary.amount_type = 'net' THEN
        v_gross := ROUND(v_salary.amount / 0.701, 2);
      END IF;
    ELSE
      SELECT * INTO v_contract FROM employee_contracts
        WHERE employee_id = v_emp.id AND is_active = true
        ORDER BY start_date DESC LIMIT 1;
      IF v_contract IS NULL THEN CONTINUE; END IF;
      v_gross := v_contract.gross_salary;
    END IF;

    v_daily_rate := ROUND(v_gross / v_standard_working_days, 2);

    -- Count actual working days from work_logs
    SELECT COALESCE(COUNT(*), 0) INTO v_actual_working_days
    FROM work_logs
    WHERE employee_id = v_emp.id
      AND tenant_id = v_run.tenant_id
      AND date BETWEEN v_period_start AND v_period_end
      AND type = 'workday';

    -- If no work_logs entered, assume standard
    IF v_actual_working_days = 0 THEN
      v_actual_working_days := v_standard_working_days;
    END IF;

    -- Count sick leave days (employer-paid, first 30 days)
    SELECT COALESCE(COUNT(*), 0) INTO v_sick_days
    FROM work_logs
    WHERE employee_id = v_emp.id
      AND tenant_id = v_run.tenant_id
      AND date BETWEEN v_period_start AND v_period_end
      AND type = 'sick_leave';

    -- Count unpaid leave days
    SELECT COALESCE(COUNT(*), 0) INTO v_unpaid_days
    FROM work_logs
    WHERE employee_id = v_emp.id
      AND tenant_id = v_run.tenant_id
      AND date BETWEEN v_period_start AND v_period_end
      AND type = 'unpaid_leave';

    -- Total leave days affecting pay
    v_leave_days := v_sick_days + v_unpaid_days;

    -- Sick leave compensation: 65% of daily rate
    v_sick_compensation := ROUND(v_daily_rate * 0.65 * v_sick_days, 2);

    -- Unpaid leave deduction: full daily rate
    v_leave_deduction := ROUND(v_daily_rate * v_unpaid_days, 2);

    -- Get overtime hours for the period
    SELECT COALESCE(hours, 0) INTO v_overtime
    FROM overtime_hours
    WHERE employee_id = v_emp.id
      AND tenant_id = v_run.tenant_id
      AND year = v_run.period_year
      AND month = v_run.period_month;
    IF v_overtime IS NULL THEN v_overtime := 0; END IF;

    -- Get night work hours
    SELECT COALESCE(hours, 0) INTO v_night_work
    FROM night_work_hours
    WHERE employee_id = v_emp.id
      AND tenant_id = v_run.tenant_id
      AND year = v_run.period_year
      AND month = v_run.period_month;
    IF v_night_work IS NULL THEN v_night_work := 0; END IF;

    -- Get active deductions monthly installment
    SELECT COALESCE(SUM(
      CASE WHEN d.end_date IS NOT NULL AND d.start_date IS NOT NULL
        THEN (d.total_amount - d.paid_amount) /
             GREATEST(EXTRACT(MONTH FROM AGE(d.end_date, CURRENT_DATE)) + 1, 1)
        ELSE ROUND((d.total_amount - d.paid_amount) / 12, 2)
      END
    ), 0) INTO v_deduction_total
    FROM deductions d
    WHERE d.employee_id = v_emp.id
      AND d.tenant_id = v_run.tenant_id
      AND d.is_active = true
      AND d.paid_amount < d.total_amount;

    -- Get allowances for the period
    SELECT COALESCE(SUM(a.amount), 0) INTO v_allowance_total
    FROM allowances a
    WHERE a.employee_id = v_emp.id
      AND a.tenant_id = v_run.tenant_id
      AND a.year = v_run.period_year
      AND a.month = v_run.period_month;

    -- Adjusted gross: base + overtime premium (26% markup) + sick comp - unpaid deduction
    v_adjusted_gross := ROUND(
      v_daily_rate * v_actual_working_days
      + (v_daily_rate / 8) * v_overtime * 1.26
      + v_sick_compensation
      - v_leave_deduction
    , 2);

    -- Ensure non-negative
    v_adjusted_gross := GREATEST(v_adjusted_gross, 0);

    -- Employee contributions (from adjusted gross)
    v_pension := ROUND(v_adjusted_gross * 0.14, 2);
    v_health := ROUND(v_adjusted_gross * 0.0515, 2);
    v_unemployment := ROUND(v_adjusted_gross * 0.0075, 2);

    -- Taxable base
    v_taxable := GREATEST(v_adjusted_gross - v_pension - v_health - v_unemployment - v_nontaxable, 0);
    v_income_tax := ROUND(v_taxable * 0.10, 2);

    -- Net = adjusted_gross - contributions - tax - deductions + allowances
    v_net := v_adjusted_gross - v_pension - v_health - v_unemployment - v_income_tax
             - v_deduction_total + v_allowance_total;
    v_net := GREATEST(v_net, 0);

    -- Employer cost
    v_total_cost := v_adjusted_gross + ROUND(v_adjusted_gross * 0.115, 2) + ROUND(v_adjusted_gross * 0.0515, 2);

    INSERT INTO payroll_items (
      payroll_run_id, employee_id, gross_salary, taxable_base, income_tax,
      pension_contribution, health_contribution, unemployment_contribution,
      net_salary, total_cost,
      working_days, actual_working_days, leave_days_deducted, leave_deduction_amount,
      overtime_hours_count, night_work_hours_count
    ) VALUES (
      p_payroll_run_id, v_emp.id, v_adjusted_gross, v_taxable, v_income_tax,
      v_pension, v_health, v_unemployment,
      v_net, v_total_cost,
      v_standard_working_days, v_actual_working_days, v_leave_days, v_leave_deduction,
      v_overtime, v_night_work
    );

    v_sum_gross := v_sum_gross + v_adjusted_gross;
    v_sum_net := v_sum_net + v_net;
    v_sum_taxes := v_sum_taxes + v_income_tax;
    v_sum_contributions := v_sum_contributions + v_pension + v_health + v_unemployment;
  END LOOP;

  UPDATE payroll_runs SET
    status = 'calculated',
    total_gross = v_sum_gross,
    total_net = v_sum_net,
    total_taxes = v_sum_taxes,
    total_contributions = v_sum_contributions,
    updated_at = now()
  WHERE id = p_payroll_run_id;
END;
$$;
