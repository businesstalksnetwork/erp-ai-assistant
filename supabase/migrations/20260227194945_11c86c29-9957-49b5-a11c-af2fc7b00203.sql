
-- Phase 2.1: Leave self-service schema changes

-- Add pending_days to annual_leave_balances
ALTER TABLE public.annual_leave_balances
  ADD COLUMN IF NOT EXISTS pending_days NUMERIC NOT NULL DEFAULT 0;

-- Add requested_by and rejection_reason to leave_requests
ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- RLS: Employees can create own leave requests
CREATE POLICY "Employees can create own leave requests"
  ON public.leave_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    employee_id IN (
      SELECT id FROM public.employees
      WHERE user_id = auth.uid() AND tenant_id = leave_requests.tenant_id
    )
  );

-- RLS: Employees can cancel own pending requests
CREATE POLICY "Employees can cancel own pending requests"
  ON public.leave_requests
  FOR UPDATE
  TO authenticated
  USING (
    employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    AND status = 'pending'
  )
  WITH CHECK (status = 'cancelled');

-- 2.2 Validation RPC
CREATE OR REPLACE FUNCTION public.validate_leave_request(
  p_employee_id UUID,
  p_tenant_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_leave_type TEXT,
  p_year INT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days INT;
  v_balance RECORD;
  v_overlap INT;
  v_year INT;
BEGIN
  v_days := (p_end_date - p_start_date) + 1;
  IF v_days < 1 THEN
    RETURN '{"valid":false,"error":"End date must be after start date"}'::jsonb;
  END IF;

  -- Check overlap
  SELECT COUNT(*) INTO v_overlap FROM leave_requests
  WHERE employee_id = p_employee_id AND tenant_id = p_tenant_id
    AND status IN ('pending','approved')
    AND daterange(start_date, end_date, '[]') && daterange(p_start_date, p_end_date, '[]');
  IF v_overlap > 0 THEN
    RETURN '{"valid":false,"error":"Overlapping leave request exists"}'::jsonb;
  END IF;

  -- Check vacation balance
  IF p_leave_type = 'vacation' THEN
    v_year := COALESCE(p_year, EXTRACT(YEAR FROM p_start_date)::INT);
    SELECT * INTO v_balance FROM annual_leave_balances
    WHERE employee_id = p_employee_id AND tenant_id = p_tenant_id AND year = v_year;

    IF v_balance IS NULL THEN
      RETURN json_build_object('valid', false, 'error', 'No leave balance record for year ' || v_year)::jsonb;
    END IF;

    IF (v_balance.entitled_days + v_balance.carried_over_days - v_balance.used_days - v_balance.pending_days) < v_days THEN
      RETURN json_build_object('valid', false, 'error', 'Insufficient leave balance', 'available',
        v_balance.entitled_days + v_balance.carried_over_days - v_balance.used_days - v_balance.pending_days, 'requested', v_days)::jsonb;
    END IF;
  END IF;

  RETURN json_build_object('valid', true, 'days', v_days)::jsonb;
END;
$$;

-- 2.3 Submit RPC
CREATE OR REPLACE FUNCTION public.submit_leave_request(
  p_employee_id UUID,
  p_tenant_id UUID,
  p_leave_type TEXT,
  p_start_date DATE,
  p_end_date DATE,
  p_reason TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_validation JSONB;
  v_days INT;
  v_request_id UUID;
  v_year INT;
BEGIN
  v_validation := validate_leave_request(p_employee_id, p_tenant_id, p_start_date, p_end_date, p_leave_type);
  IF NOT (v_validation->>'valid')::boolean THEN
    RAISE EXCEPTION '%', v_validation->>'error';
  END IF;

  v_days := (v_validation->>'days')::int;
  v_year := EXTRACT(YEAR FROM p_start_date)::INT;

  INSERT INTO leave_requests (
    tenant_id, employee_id, leave_type, start_date, end_date,
    days_count, reason, status, requested_by, vacation_year
  ) VALUES (
    p_tenant_id, p_employee_id, p_leave_type::leave_type, p_start_date, p_end_date,
    v_days, p_reason, 'pending', auth.uid(), v_year
  ) RETURNING id INTO v_request_id;

  IF p_leave_type = 'vacation' THEN
    UPDATE annual_leave_balances
    SET pending_days = pending_days + v_days
    WHERE employee_id = p_employee_id AND tenant_id = p_tenant_id AND year = v_year;
  END IF;

  RETURN v_request_id;
END;
$$;

-- 2.4 Auto-balance trigger on status change
CREATE OR REPLACE FUNCTION public.handle_leave_request_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year INT;
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;
  IF NEW.leave_type != 'vacation' THEN RETURN NEW; END IF;

  v_year := COALESCE(NEW.vacation_year, EXTRACT(YEAR FROM NEW.start_date)::INT);

  -- pending → approved
  IF OLD.status = 'pending' AND NEW.status = 'approved' THEN
    UPDATE annual_leave_balances
    SET pending_days = GREATEST(pending_days - NEW.days_count, 0),
        used_days = used_days + NEW.days_count
    WHERE employee_id = NEW.employee_id AND tenant_id = NEW.tenant_id AND year = v_year;
  END IF;

  -- pending → rejected
  IF OLD.status = 'pending' AND NEW.status = 'rejected' THEN
    UPDATE annual_leave_balances
    SET pending_days = GREATEST(pending_days - NEW.days_count, 0)
    WHERE employee_id = NEW.employee_id AND tenant_id = NEW.tenant_id AND year = v_year;
  END IF;

  -- pending → cancelled
  IF OLD.status = 'pending' AND NEW.status = 'cancelled' THEN
    UPDATE annual_leave_balances
    SET pending_days = GREATEST(pending_days - NEW.days_count, 0)
    WHERE employee_id = NEW.employee_id AND tenant_id = NEW.tenant_id AND year = v_year;
  END IF;

  -- approved → cancelled
  IF OLD.status = 'approved' AND NEW.status = 'cancelled' THEN
    UPDATE annual_leave_balances
    SET used_days = GREATEST(used_days - NEW.days_count, 0)
    WHERE employee_id = NEW.employee_id AND tenant_id = NEW.tenant_id AND year = v_year;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_leave_request_status_change
  BEFORE UPDATE ON public.leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_leave_request_status_change();
