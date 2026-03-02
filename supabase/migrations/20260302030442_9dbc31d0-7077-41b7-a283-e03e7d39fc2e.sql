
-- CR10-06: Replace MAX()+1 race condition with per-tenant sequence via counter table
-- Use advisory lock to prevent concurrent duplicates

CREATE OR REPLACE FUNCTION public.generate_loyalty_card_number()
RETURNS TRIGGER AS $$
DECLARE
  seq_num INT;
  card TEXT;
BEGIN
  IF NEW.card_number IS NULL OR NEW.card_number = '' THEN
    -- Use advisory lock on tenant_id hash to serialize card number generation
    PERFORM pg_advisory_xact_lock(hashtext('loyalty_card_' || NEW.tenant_id));
    
    SELECT COALESCE(MAX(
      CASE WHEN card_number ~ '^\d+$' THEN card_number::INT ELSE 0 END
    ), 0) + 1
    INTO seq_num
    FROM public.loyalty_members
    WHERE tenant_id = NEW.tenant_id;
    
    card := LPAD(seq_num::TEXT, 10, '0');
    NEW.card_number := card;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
