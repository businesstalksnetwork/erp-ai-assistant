
-- CR8-10: Fix incident number race condition with a Postgres sequence + trigger
-- This replaces client-side INC-YYYY/NNNN generation with an atomic server-side approach.

CREATE SEQUENCE IF NOT EXISTS public.incident_number_seq START WITH 1 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION public.generate_incident_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.incident_number IS NULL OR NEW.incident_number = '' THEN
    NEW.incident_number := 'INC-' || EXTRACT(YEAR FROM NOW())::text || '/' || LPAD(nextval('public.incident_number_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_generate_incident_number ON public.incidents;

CREATE TRIGGER trg_generate_incident_number
  BEFORE INSERT ON public.incidents
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_incident_number();
