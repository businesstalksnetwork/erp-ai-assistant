
-- Phase 6: Work Calendars + Serbian Holiday Seeding + Enhanced Day Calculation

-- 1. Add name_sr column to holidays for Serbian localization
ALTER TABLE public.holidays ADD COLUMN IF NOT EXISTS name_sr TEXT;

-- 2. Create work_calendars table
CREATE TABLE IF NOT EXISTS public.work_calendars (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  working_days_config JSONB NOT NULL DEFAULT '{"mon":true,"tue":true,"wed":true,"thu":true,"fri":true,"sat":false,"sun":false}',
  total_working_days INTEGER,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, year)
);

ALTER TABLE public.work_calendars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.work_calendars FOR ALL
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE TRIGGER update_work_calendars_updated_at
  BEFORE UPDATE ON public.work_calendars
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Seed Serbian public holidays (national, tenant_id IS NULL)
INSERT INTO public.holidays (name, name_sr, date, is_recurring, tenant_id) VALUES
  ('New Year''s Day', 'Nova godina', '2026-01-01', true, NULL),
  ('New Year''s Day 2', 'Nova godina 2', '2026-01-02', true, NULL),
  ('Orthodox Christmas', 'Božić', '2026-01-07', true, NULL),
  ('Statehood Day', 'Dan državnosti', '2026-02-15', true, NULL),
  ('Statehood Day 2', 'Dan državnosti 2', '2026-02-16', true, NULL),
  ('Labour Day', 'Praznik rada', '2026-05-01', true, NULL),
  ('Labour Day 2', 'Praznik rada 2', '2026-05-02', true, NULL),
  ('Armistice Day', 'Dan primirja', '2026-11-11', true, NULL)
ON CONFLICT DO NOTHING;

-- 4. Function to count working days excluding holidays
CREATE OR REPLACE FUNCTION public.count_working_days(
  p_tenant_id UUID, p_start DATE, p_end DATE
)
RETURNS INTEGER LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count INTEGER;
  v_config JSONB;
  v_dow_exclude INTEGER[];
BEGIN
  SELECT working_days_config INTO v_config
  FROM work_calendars WHERE tenant_id = p_tenant_id AND year = EXTRACT(YEAR FROM p_start)::int;

  v_dow_exclude := ARRAY[0, 6];

  IF v_config IS NOT NULL THEN
    v_dow_exclude := ARRAY[]::INTEGER[];
    IF NOT COALESCE((v_config->>'sun')::boolean, false) THEN v_dow_exclude := v_dow_exclude || 0; END IF;
    IF NOT COALESCE((v_config->>'mon')::boolean, true) THEN v_dow_exclude := v_dow_exclude || 1; END IF;
    IF NOT COALESCE((v_config->>'tue')::boolean, true) THEN v_dow_exclude := v_dow_exclude || 2; END IF;
    IF NOT COALESCE((v_config->>'wed')::boolean, true) THEN v_dow_exclude := v_dow_exclude || 3; END IF;
    IF NOT COALESCE((v_config->>'thu')::boolean, true) THEN v_dow_exclude := v_dow_exclude || 4; END IF;
    IF NOT COALESCE((v_config->>'fri')::boolean, true) THEN v_dow_exclude := v_dow_exclude || 5; END IF;
    IF NOT COALESCE((v_config->>'sat')::boolean, false) THEN v_dow_exclude := v_dow_exclude || 6; END IF;
  END IF;

  SELECT COUNT(*)::int INTO v_count
  FROM generate_series(p_start, p_end, '1 day'::interval) d
  WHERE EXTRACT(DOW FROM d)::int != ALL(v_dow_exclude)
    AND d::date NOT IN (
      SELECT h.date::date FROM holidays h
      WHERE (h.tenant_id IS NULL OR h.tenant_id = p_tenant_id)
        AND h.date BETWEEN p_start AND p_end
    );

  RETURN v_count;
END;
$$;

-- 5. Update validate_leave_request to use count_working_days
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

  v_days := count_working_days(p_tenant_id, p_start_date, p_end_date);

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
