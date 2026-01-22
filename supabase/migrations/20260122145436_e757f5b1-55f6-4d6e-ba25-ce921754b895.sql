-- Trigger funkcija koja automatski dodeljuje knjigovođu novoj kompaniji
-- ako je vlasnik kompanije registrovan preko referral linka
CREATE OR REPLACE FUNCTION public.auto_assign_bookkeeper()
RETURNS TRIGGER AS $$
DECLARE
  v_invited_by UUID;
  v_bookkeeper_email TEXT;
BEGIN
  -- Dohvati invited_by_user_id iz profiles tabele za vlasnika kompanije
  SELECT invited_by_user_id INTO v_invited_by
  FROM public.profiles
  WHERE id = NEW.user_id;
  
  -- Ako postoji referrer (knjigovođa koji je pozvao korisnika)
  IF v_invited_by IS NOT NULL THEN
    -- Dohvati email knjigovođe
    SELECT email INTO v_bookkeeper_email
    FROM public.profiles
    WHERE id = v_invited_by;
    
    -- Automatski postavi knjigovođu na kompaniju
    IF v_bookkeeper_email IS NOT NULL THEN
      NEW.bookkeeper_id := v_invited_by;
      NEW.bookkeeper_email := v_bookkeeper_email;
      NEW.bookkeeper_status := 'accepted';
      NEW.bookkeeper_invited_at := NOW();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger koji se aktivira pre umetanja nove kompanije
CREATE TRIGGER on_company_created_assign_bookkeeper
  BEFORE INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_bookkeeper();