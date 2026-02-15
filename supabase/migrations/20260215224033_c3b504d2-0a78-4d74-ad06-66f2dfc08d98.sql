
-- 1. Trigger: Prevent posting unbalanced journal entries
CREATE OR REPLACE FUNCTION public.check_journal_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_debit NUMERIC;
  total_credit NUMERIC;
BEGIN
  -- Only check when status is being changed to 'posted'
  IF NEW.status = 'posted' AND (OLD.status IS NULL OR OLD.status != 'posted') THEN
    SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0)
    INTO total_debit, total_credit
    FROM journal_lines
    WHERE journal_entry_id = NEW.id;

    -- Must have at least one line
    IF total_debit = 0 AND total_credit = 0 THEN
      RAISE EXCEPTION 'Cannot post a journal entry with no lines';
    END IF;

    -- Debit must equal credit (tolerance 0.01 for rounding)
    IF ABS(total_debit - total_credit) > 0.01 THEN
      RAISE EXCEPTION 'Cannot post unbalanced journal entry: debit=% credit=%', total_debit, total_credit;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_journal_balance
  BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.check_journal_balance();

-- 2. Trigger: Prevent modification of lines on posted journal entries
CREATE OR REPLACE FUNCTION public.protect_posted_journal_lines()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  entry_status TEXT;
BEGIN
  -- For DELETE, use OLD; for UPDATE, use OLD
  SELECT status INTO entry_status
  FROM journal_entries
  WHERE id = COALESCE(OLD.journal_entry_id, NEW.journal_entry_id);

  IF entry_status = 'posted' THEN
    RAISE EXCEPTION 'Cannot modify lines of a posted journal entry. Use storno (reversal) instead.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_posted_lines_update
  BEFORE UPDATE ON public.journal_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_posted_journal_lines();

CREATE TRIGGER trg_protect_posted_lines_delete
  BEFORE DELETE ON public.journal_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_posted_journal_lines();

-- 3. Trigger: Prevent modification of posted journal entry fields (except status changes for storno)
CREATE OR REPLACE FUNCTION public.protect_posted_journal_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'posted' THEN
    -- Allow only status change to 'reversed' (storno workflow)
    IF NEW.status = 'reversed' THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Cannot modify a posted journal entry. Use storno (reversal) instead.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_posted_entry
  BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_posted_journal_entry();
