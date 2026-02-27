
-- Phase 4: Link attendance with leave requests

-- 1. Add leave_request_id to attendance_records
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS leave_request_id UUID REFERENCES public.leave_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_attendance_leave_request ON public.attendance_records(leave_request_id);

-- 2. Trigger: auto-generate attendance records when leave is approved
CREATE OR REPLACE FUNCTION public.generate_attendance_for_approved_leave()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d DATE;
BEGIN
  -- Only fire when status changes to 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    -- Generate one attendance record per day in the leave range (skip weekends)
    FOR d IN SELECT generate_series(NEW.start_date::date, NEW.end_date::date, '1 day'::interval)::date
    LOOP
      -- Skip Saturday (6) and Sunday (0)
      IF EXTRACT(DOW FROM d) NOT IN (0, 6) THEN
        INSERT INTO public.attendance_records (
          employee_id, tenant_id, date, status, hours_worked, notes, leave_request_id
        ) VALUES (
          NEW.employee_id,
          NEW.tenant_id,
          d,
          CASE NEW.leave_type
            WHEN 'sick' THEN 'sick'::attendance_status
            WHEN 'vacation' THEN 'vacation'::attendance_status
            ELSE 'absent'::attendance_status
          END,
          0,
          'Auto: ' || NEW.leave_type,
          NEW.id
        )
        ON CONFLICT DO NOTHING; -- avoid duplicates if re-triggered
      END IF;
    END LOOP;
  END IF;

  -- If leave is cancelled after approval, remove auto-generated attendance
  IF NEW.status = 'cancelled' AND OLD.status = 'approved' THEN
    DELETE FROM public.attendance_records
    WHERE leave_request_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop if exists to avoid duplicate
DROP TRIGGER IF EXISTS trg_generate_attendance_for_leave ON public.leave_requests;

CREATE TRIGGER trg_generate_attendance_for_leave
  AFTER UPDATE ON public.leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_attendance_for_approved_leave();
