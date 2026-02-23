
-- Migration: PRD upgrades — ai_action_log table + 2025 payroll parameters + fix calculate_payroll_for_run

-- 1. Create ai_action_log table
CREATE TABLE IF NOT EXISTS public.ai_action_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  module text NOT NULL,
  input_data jsonb DEFAULT '{}',
  ai_output jsonb DEFAULT '{}',
  model_version text,
  confidence_score numeric CHECK (confidence_score >= 0 AND confidence_score <= 1),
  user_decision text CHECK (user_decision IN ('approved', 'rejected', 'modified', 'auto')),
  reasoning text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.ai_action_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_ai_action_log" ON public.ai_action_log
  FOR ALL USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- 2. Seed 2025 payroll parameters (correct column name: unemployment_employee_rate)
INSERT INTO public.payroll_parameters (
  tenant_id, effective_from,
  tax_rate, nontaxable_amount,
  pio_employee_rate, pio_employer_rate,
  health_employee_rate, health_employer_rate,
  unemployment_employee_rate,
  min_contribution_base, max_contribution_base
)
SELECT 
  t.id, '2025-01-01'::date,
  0.10, 28423,
  0.14, 0.11,
  0.0515, 0.0515,
  0.0075,
  45950, 656425
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.payroll_parameters pp 
  WHERE pp.tenant_id = t.id AND pp.effective_from = '2025-01-01'
)
ON CONFLICT DO NOTHING;

-- 3. Fix calculate_payroll_for_run: correct column references + 2025 defaults
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
BEGIN
  SELECT * INTO v_run FROM payroll_runs WHERE id = p_payroll_run_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payroll run not found'; END IF;

  v_period_start := make_date(v_run.period_year, v_run.period_month, 1);

  SELECT * INTO v_params FROM payroll_parameters
    WHERE tenant_id = v_run.tenant_id AND effective_from <= v_period_start
    ORDER BY effective_from DESC LIMIT 1;

  IF NOT FOUND THEN
    v_params.tax_rate := 0.10;
    v_params.nontaxable_amount := 28423;
    v_params.min_contribution_base := 45950;
    v_params.max_contribution_base := 656425;
    v_params.pio_employee_rate := 0.14;
    v_params.pio_employer_rate := 0.11;
    v_params.health_employee_rate := 0.0515;
    v_params.health_employer_rate := 0.0515;
    v_params.unemployment_employee_rate := 0.0075;
  END IF;

  DELETE FROM payroll_items WHERE payroll_run_id = p_payroll_run_id;

  FOR v_contract IN
    SELECT ec.*, e.id as emp_id, COALESCE(ec.working_hours_per_week, 40) as wk_hours
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

    SELECT COALESCE(SUM(hours),0) INTO v_ot_cnt
      FROM overtime_hours WHERE employee_id=v_contract.emp_id AND month=v_run.period_month AND year=v_run.period_year;
    v_ot_amt := (v_gross/(v_wd*8))*v_ot_cnt*1.26;

    SELECT COALESCE(SUM(hours),0) INTO v_nt_cnt
      FROM night_work_records WHERE employee_id=v_contract.emp_id AND month=v_run.period_month AND year=v_run.period_year;
    v_nt_amt := (v_gross/(v_wd*8))*v_nt_cnt*0.26;

    SELECT COALESCE(COUNT(*),0) INTO v_ld_cnt
      FROM leave_requests WHERE employee_id=v_contract.emp_id AND status='approved' AND leave_type='unpaid'
      AND start_date<=make_date(v_run.period_year,v_run.period_month,28)
      AND end_date>=make_date(v_run.period_year,v_run.period_month,1);
    v_ld_amt := (v_gross/v_wd)*v_ld_cnt;
    v_ad := v_wd - v_ld_cnt;

    v_gross := v_gross + v_ot_amt + v_nt_amt - v_ld_amt;

    v_min_base := COALESCE(v_params.min_contribution_base, 45950) * (v_work_hours / 40.0);
    v_max_base := COALESCE(v_params.max_contribution_base, 656425) * (v_work_hours / 40.0);
    v_contrib_base := GREATEST(v_gross, v_min_base);
    v_contrib_base := LEAST(v_contrib_base, v_max_base);

    v_pio_e    := ROUND(v_contrib_base * COALESCE(v_params.pio_employee_rate, 0.14), 2);
    v_health_e := ROUND(v_contrib_base * COALESCE(v_params.health_employee_rate, 0.0515), 2);
    v_unemp_e  := ROUND(v_contrib_base * COALESCE(v_params.unemployment_employee_rate, 0.0075), 2);

    v_taxbase := GREATEST(v_gross - COALESCE(v_params.nontaxable_amount, 28423), 0);
    v_tax     := ROUND(v_taxbase * COALESCE(v_params.tax_rate, 0.10), 2);

    v_net := v_gross - v_pio_e - v_health_e - v_unemp_e - v_tax;

    v_pio_r    := ROUND(v_contrib_base * COALESCE(v_params.pio_employer_rate, 0.11), 2);
    v_health_r := ROUND(v_contrib_base * COALESCE(v_params.health_employer_rate, 0.0515), 2);

    v_tcost := v_gross + v_pio_r + v_health_r;

    INSERT INTO payroll_items (payroll_run_id, employee_id, gross_salary, net_salary, income_tax,
      pension_contribution, health_contribution, unemployment_contribution, pension_employer, health_employer,
      taxable_base, total_cost, working_days, actual_working_days,
      overtime_hours_count, night_work_hours_count, overtime_amount, night_work_amount,
      leave_days_deducted, leave_deduction_amount)
    VALUES (p_payroll_run_id, v_contract.emp_id, v_gross, v_net, v_tax,
      v_pio_e, v_health_e, v_unemp_e, v_pio_r, v_health_r,
      v_taxbase, v_tcost, v_wd, v_ad,
      v_ot_cnt, v_nt_cnt, v_ot_amt, v_nt_amt,
      v_ld_cnt, v_ld_amt);

    v_tg := v_tg + v_gross; v_tn := v_tn + v_net;
    v_tt := v_tt + v_tax; v_tc := v_tc + v_pio_e + v_health_e + v_unemp_e;
  END LOOP;

  UPDATE payroll_runs SET status='calculated', total_gross=v_tg, total_net=v_tn,
    total_taxes=v_tt, total_contributions=v_tc
  WHERE id = p_payroll_run_id;
END;
$function$;
