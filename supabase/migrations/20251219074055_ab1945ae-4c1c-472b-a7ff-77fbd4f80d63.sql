-- Add QR code fields to payment_reminders
ALTER TABLE public.payment_reminders
ADD COLUMN IF NOT EXISTS recipient_name text,
ADD COLUMN IF NOT EXISTS recipient_account text,
ADD COLUMN IF NOT EXISTS payment_model text DEFAULT '97',
ADD COLUMN IF NOT EXISTS payment_reference text,
ADD COLUMN IF NOT EXISTS payment_code text DEFAULT '289';

-- Fix KPO entry creation to use service_date for year determination
CREATE OR REPLACE FUNCTION public.create_kpo_entry()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  next_ordinal INTEGER;
  client_name TEXT;
  kpo_year INTEGER;
BEGIN
  -- Only create KPO for non-proforma invoices
  IF NEW.is_proforma = false THEN
    -- Use service_date for year, fallback to issue_date if service_date is null
    kpo_year := EXTRACT(YEAR FROM COALESCE(NEW.service_date, NEW.issue_date));
    
    -- Get next ordinal number for the company and year (based on service_date year)
    SELECT COALESCE(MAX(ordinal_number), 0) + 1
    INTO next_ordinal
    FROM public.kpo_entries
    WHERE company_id = NEW.company_id AND year = kpo_year;

    -- Get client name
    client_name := NEW.client_name;

    -- Insert KPO entry with year based on service_date
    INSERT INTO public.kpo_entries (
      company_id,
      invoice_id,
      ordinal_number,
      description,
      products_amount,
      services_amount,
      total_amount,
      year
    ) VALUES (
      NEW.company_id,
      NEW.id,
      next_ordinal,
      'Faktura ' || NEW.invoice_number || ', ' || TO_CHAR(COALESCE(NEW.service_date, NEW.issue_date)::date, 'DD.MM.YYYY') || ', ' || client_name,
      CASE WHEN NEW.item_type = 'products' THEN NEW.total_amount ELSE 0 END,
      CASE WHEN NEW.item_type = 'services' THEN NEW.total_amount ELSE 0 END,
      NEW.total_amount,
      kpo_year
    );
  END IF;
  RETURN NEW;
END;
$function$;