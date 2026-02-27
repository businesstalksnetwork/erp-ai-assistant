
-- Phase 5: Leave Policies & Configuration (fixed roles)

CREATE TABLE public.leave_policies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  leave_type TEXT NOT NULL DEFAULT 'vacation',
  annual_entitlement NUMERIC NOT NULL DEFAULT 20,
  max_carryover NUMERIC NOT NULL DEFAULT 5,
  accrual_method TEXT NOT NULL DEFAULT 'annual',
  requires_approval BOOLEAN NOT NULL DEFAULT true,
  min_days_advance INTEGER NOT NULL DEFAULT 3,
  max_consecutive_days INTEGER,
  probation_months INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.leave_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view leave policies"
  ON public.leave_policies FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

CREATE POLICY "Tenant admins can manage leave policies"
  ON public.leave_policies FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND role IN ('super_admin', 'admin', 'hr')));

CREATE TRIGGER update_leave_policies_updated_at
  BEFORE UPDATE ON public.leave_policies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enhanced validate_leave_request with policy checks
CREATE OR REPLACE FUNCTION public.validate_leave_request(
  p_employee_id UUID, p_tenant_id UUID, p_start_date DATE, p_end_date DATE, p_leave_type TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_days INTEGER; v_available NUMERIC; v_overlap INTEGER;
  v_policy RECORD; v_hire_date DATE; v_months_employed INTEGER;
BEGIN
  IF p_end_date < p_start_date THEN
    RETURN jsonb_build_object('valid', false, 'error', 'End date must be >= start date');
  END IF;

  SELECT COUNT(*) INTO v_days FROM generate_series(p_start_date, p_end_date, '1 day'::interval) d
  WHERE EXTRACT(DOW FROM d) NOT IN (0, 6);

  IF v_days = 0 THEN RETURN jsonb_build_object('valid', false, 'error', 'No working days in selected range'); END IF;

  SELECT COUNT(*) INTO v_overlap FROM leave_requests
  WHERE employee_id = p_employee_id AND status IN ('pending', 'approved')
    AND daterange(start_date, end_date, '[]') && daterange(p_start_date, p_end_date, '[]');
  IF v_overlap > 0 THEN RETURN jsonb_build_object('valid', false, 'error', 'Overlapping leave request exists'); END IF;

  SELECT * INTO v_policy FROM leave_policies
  WHERE tenant_id = p_tenant_id AND leave_type = p_leave_type AND is_active = true LIMIT 1;

  IF v_policy IS NOT NULL THEN
    IF v_policy.min_days_advance > 0 AND (p_start_date - CURRENT_DATE) < v_policy.min_days_advance THEN
      RETURN jsonb_build_object('valid', false, 'error', 'Minimum ' || v_policy.min_days_advance || ' days advance notice required');
    END IF;
    IF v_policy.max_consecutive_days IS NOT NULL AND v_days > v_policy.max_consecutive_days THEN
      RETURN jsonb_build_object('valid', false, 'error', 'Maximum ' || v_policy.max_consecutive_days || ' consecutive working days allowed');
    END IF;
    IF v_policy.probation_months > 0 THEN
      SELECT hire_date INTO v_hire_date FROM employees WHERE id = p_employee_id;
      IF v_hire_date IS NOT NULL THEN
        v_months_employed := EXTRACT(YEAR FROM age(CURRENT_DATE, v_hire_date)) * 12 + EXTRACT(MONTH FROM age(CURRENT_DATE, v_hire_date));
        IF v_months_employed < v_policy.probation_months THEN
          RETURN jsonb_build_object('valid', false, 'error', 'Employee must complete ' || v_policy.probation_months || ' months probation');
        END IF;
      END IF;
    END IF;
  END IF;

  IF p_leave_type = 'vacation' THEN
    SELECT (COALESCE(entitled_days,0) + COALESCE(carried_over_days,0) - COALESCE(used_days,0) - COALESCE(pending_days,0))
    INTO v_available FROM annual_leave_balances
    WHERE employee_id = p_employee_id AND tenant_id = p_tenant_id AND year = EXTRACT(YEAR FROM p_start_date)::int;
    IF v_available IS NULL THEN RETURN jsonb_build_object('valid', false, 'error', 'No leave balance found for this year'); END IF;
    IF v_days > v_available THEN RETURN jsonb_build_object('valid', false, 'error', 'Insufficient balance', 'available', v_available, 'requested', v_days); END IF;
    RETURN jsonb_build_object('valid', true, 'days', v_days, 'available', v_available, 'requested', v_days);
  END IF;

  RETURN jsonb_build_object('valid', true, 'days', v_days);
END;
$$;

-- Bulk entitlement generation
CREATE OR REPLACE FUNCTION public.bulk_generate_entitlements(
  p_tenant_id UUID, p_year INTEGER, p_default_days NUMERIC DEFAULT 20
)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count INTEGER := 0; v_emp RECORD; v_policy_days NUMERIC; v_carryover NUMERIC; v_max_carryover NUMERIC;
BEGIN
  FOR v_emp IN SELECT id FROM employees WHERE tenant_id = p_tenant_id AND status = 'active' AND is_ghost = false
  LOOP
    IF NOT EXISTS (SELECT 1 FROM annual_leave_balances WHERE employee_id = v_emp.id AND tenant_id = p_tenant_id AND year = p_year) THEN
      SELECT lp.annual_entitlement, lp.max_carryover INTO v_policy_days, v_max_carryover
      FROM leave_policies lp WHERE lp.tenant_id = p_tenant_id AND lp.leave_type = 'vacation' AND lp.is_active = true LIMIT 1;

      SELECT GREATEST(0, COALESCE(entitled_days,0) + COALESCE(carried_over_days,0) - COALESCE(used_days,0))
      INTO v_carryover FROM annual_leave_balances WHERE employee_id = v_emp.id AND tenant_id = p_tenant_id AND year = p_year - 1;

      IF v_max_carryover IS NOT NULL AND COALESCE(v_carryover,0) > v_max_carryover THEN v_carryover := v_max_carryover; END IF;

      INSERT INTO annual_leave_balances (employee_id, tenant_id, year, entitled_days, carried_over_days, used_days, pending_days)
      VALUES (v_emp.id, p_tenant_id, p_year, COALESCE(v_policy_days, p_default_days), COALESCE(v_carryover, 0), 0, 0);
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$$;
