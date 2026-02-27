
-- Phase 6: Overtime Cap & APR AOP Positions

-- Part 1: Overtime Cap
ALTER TABLE public.payroll_parameters 
  ADD COLUMN IF NOT EXISTS overtime_monthly_cap_hours NUMERIC DEFAULT 40,
  ADD COLUMN IF NOT EXISTS overtime_annual_cap_hours NUMERIC DEFAULT 176;

CREATE OR REPLACE FUNCTION public.check_overtime_cap()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_monthly_cap NUMERIC; v_annual_cap NUMERIC;
  v_current_monthly NUMERIC; v_current_annual NUMERIC;
BEGIN
  SELECT COALESCE(overtime_monthly_cap_hours, 40), COALESCE(overtime_annual_cap_hours, 176)
  INTO v_monthly_cap, v_annual_cap
  FROM payroll_parameters WHERE tenant_id = NEW.tenant_id ORDER BY effective_from DESC LIMIT 1;

  SELECT COALESCE(SUM(hours), 0) INTO v_current_monthly FROM overtime_hours
  WHERE tenant_id = NEW.tenant_id AND employee_id = NEW.employee_id AND year = NEW.year AND month = NEW.month AND id IS DISTINCT FROM NEW.id;

  SELECT COALESCE(SUM(hours), 0) INTO v_current_annual FROM overtime_hours
  WHERE tenant_id = NEW.tenant_id AND employee_id = NEW.employee_id AND year = NEW.year AND id IS DISTINCT FROM NEW.id;

  IF (v_current_monthly + NEW.hours) > v_monthly_cap THEN
    RAISE EXCEPTION 'Overtime monthly cap exceeded: % + % > % hours', v_current_monthly, NEW.hours, v_monthly_cap;
  END IF;
  IF (v_current_annual + NEW.hours) > v_annual_cap THEN
    RAISE EXCEPTION 'Overtime annual cap exceeded: % + % > % hours', v_current_annual, NEW.hours, v_annual_cap;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_overtime_cap ON overtime_hours;
CREATE TRIGGER trg_check_overtime_cap BEFORE INSERT OR UPDATE ON overtime_hours FOR EACH ROW EXECUTE FUNCTION check_overtime_cap();

CREATE OR REPLACE VIEW public.overtime_cap_status AS
SELECT oh.tenant_id, oh.employee_id, e.full_name, oh.year,
  SUM(oh.hours) AS total_annual_hours,
  COALESCE(pp.overtime_annual_cap_hours, 176) AS annual_cap,
  ROUND((SUM(oh.hours) / COALESCE(pp.overtime_annual_cap_hours, 176)) * 100, 1) AS usage_pct,
  CASE WHEN SUM(oh.hours) >= COALESCE(pp.overtime_annual_cap_hours, 176) THEN 'exceeded'
       WHEN SUM(oh.hours) >= COALESCE(pp.overtime_annual_cap_hours, 176) * 0.8 THEN 'warning'
       ELSE 'ok' END AS status
FROM overtime_hours oh
JOIN employees e ON e.id = oh.employee_id
LEFT JOIN LATERAL (SELECT overtime_annual_cap_hours FROM payroll_parameters WHERE tenant_id = oh.tenant_id ORDER BY effective_from DESC LIMIT 1) pp ON true
GROUP BY oh.tenant_id, oh.employee_id, e.full_name, oh.year, pp.overtime_annual_cap_hours;

-- Part 2: APR AOP Positions
CREATE TABLE IF NOT EXISTS public.aop_positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  report_type TEXT NOT NULL CHECK (report_type IN ('bilans_stanja', 'bilans_uspeha')),
  aop_number TEXT NOT NULL,
  name_sr TEXT NOT NULL,
  name_en TEXT,
  account_from TEXT,
  account_to TEXT,
  formula TEXT,
  parent_aop TEXT,
  sort_order INTEGER DEFAULT 0,
  is_total_row BOOLEAN DEFAULT false,
  sign_convention TEXT DEFAULT 'normal' CHECK (sign_convention IN ('normal', 'reversed', 'absolute')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, report_type, aop_number)
);

ALTER TABLE public.aop_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view AOP positions"
  ON public.aop_positions FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant admins can manage AOP positions"
  ON public.aop_positions FOR ALL
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

ALTER TABLE public.chart_of_accounts
  ADD COLUMN IF NOT EXISTS aop_position_bs TEXT,
  ADD COLUMN IF NOT EXISTS aop_position_is TEXT;

CREATE OR REPLACE FUNCTION public.get_aop_report(
  p_tenant_id UUID, p_report_type TEXT,
  p_from_date DATE DEFAULT NULL, p_to_date DATE DEFAULT NULL,
  p_legal_entity_id UUID DEFAULT NULL
)
RETURNS TABLE(aop_number TEXT, name_sr TEXT, name_en TEXT, current_year NUMERIC, prior_year NUMERIC, is_total_row BOOLEAN, sort_order INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_to DATE; v_from DATE; v_prior_from DATE; v_prior_to DATE;
BEGIN
  v_to := COALESCE(p_to_date, CURRENT_DATE);
  IF p_report_type = 'bilans_stanja' THEN
    v_from := date_trunc('year', v_to)::DATE;
  ELSE
    v_from := COALESCE(p_from_date, date_trunc('year', v_to)::DATE);
  END IF;
  v_prior_from := (v_from - INTERVAL '1 year')::DATE;
  v_prior_to := (v_to - INTERVAL '1 year')::DATE;

  RETURN QUERY
  SELECT ap.aop_number, ap.name_sr, ap.name_en,
    COALESCE(CASE WHEN ap.account_from IS NOT NULL AND ap.account_to IS NOT NULL THEN
      (SELECT CASE WHEN ap.sign_convention = 'reversed' THEN -SUM(jl.debit - jl.credit)
                   WHEN ap.sign_convention = 'absolute' THEN ABS(SUM(jl.debit - jl.credit))
                   ELSE SUM(jl.debit - jl.credit) END
       FROM journal_lines jl JOIN journal_entries je ON je.id = jl.journal_entry_id
       JOIN chart_of_accounts ca ON ca.id = jl.account_id
       WHERE je.tenant_id = p_tenant_id AND je.status = 'posted'
         AND je.entry_date BETWEEN v_from AND v_to
         AND ca.code >= ap.account_from AND ca.code <= ap.account_to
         AND (p_legal_entity_id IS NULL OR je.legal_entity_id = p_legal_entity_id))
    ELSE NULL END, 0)::NUMERIC,
    COALESCE(CASE WHEN ap.account_from IS NOT NULL AND ap.account_to IS NOT NULL THEN
      (SELECT CASE WHEN ap.sign_convention = 'reversed' THEN -SUM(jl.debit - jl.credit)
                   WHEN ap.sign_convention = 'absolute' THEN ABS(SUM(jl.debit - jl.credit))
                   ELSE SUM(jl.debit - jl.credit) END
       FROM journal_lines jl JOIN journal_entries je ON je.id = jl.journal_entry_id
       JOIN chart_of_accounts ca ON ca.id = jl.account_id
       WHERE je.tenant_id = p_tenant_id AND je.status = 'posted'
         AND je.entry_date BETWEEN v_prior_from AND v_prior_to
         AND ca.code >= ap.account_from AND ca.code <= ap.account_to
         AND (p_legal_entity_id IS NULL OR je.legal_entity_id = p_legal_entity_id))
    ELSE NULL END, 0)::NUMERIC,
    ap.is_total_row, ap.sort_order
  FROM aop_positions ap
  WHERE ap.tenant_id = p_tenant_id AND ap.report_type = p_report_type AND ap.is_active
  ORDER BY ap.sort_order;
END;
$$;
