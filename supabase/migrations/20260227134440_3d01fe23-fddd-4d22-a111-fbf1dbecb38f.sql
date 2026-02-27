
-- Use a validation trigger instead of CHECK constraint (existing short codes)
CREATE OR REPLACE FUNCTION public.validate_account_code_length()
RETURNS TRIGGER AS $$
BEGIN
  IF char_length(NEW.code) < 4 THEN
    RAISE EXCEPTION 'Account code must be at least 4 characters (got: %)', NEW.code;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_validate_account_code
  BEFORE INSERT OR UPDATE OF code ON public.chart_of_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_account_code_length();
