
-- Add is_locked column to pdv_periods for tax period locking
ALTER TABLE public.pdv_periods ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;

-- Create a trigger that prevents journal entries from being posted into locked PDV periods
CREATE OR REPLACE FUNCTION public.check_pdv_period_not_locked()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_locked boolean;
BEGIN
  -- Only check when posting (status = 'posted')
  IF NEW.status = 'posted' THEN
    SELECT EXISTS (
      SELECT 1 FROM pdv_periods
      WHERE tenant_id = NEW.tenant_id
        AND is_locked = true
        AND NEW.entry_date >= start_date
        AND NEW.entry_date <= end_date
    ) INTO v_locked;
    
    IF v_locked THEN
      RAISE EXCEPTION 'Cannot post journal entry to a locked PDV period. Date: %', NEW.entry_date;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop if exists to avoid duplicate
DROP TRIGGER IF EXISTS trg_check_pdv_period_locked ON journal_entries;

CREATE TRIGGER trg_check_pdv_period_locked
  BEFORE INSERT OR UPDATE ON journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.check_pdv_period_not_locked();

-- Auto-lock period when status changes to 'submitted' or 'closed'
CREATE OR REPLACE FUNCTION public.auto_lock_pdv_period()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('submitted', 'closed') AND OLD.status NOT IN ('submitted', 'closed') THEN
    NEW.is_locked := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_lock_pdv_period ON pdv_periods;

CREATE TRIGGER trg_auto_lock_pdv_period
  BEFORE UPDATE ON pdv_periods
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_lock_pdv_period();
