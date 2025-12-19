-- Fix the create_kpo_entry trigger function - missing year value
CREATE OR REPLACE FUNCTION public.create_kpo_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_ordinal INTEGER;
  client_name TEXT;
BEGIN
  -- Only create KPO for non-proforma invoices
  IF NEW.is_proforma = false THEN
    -- Get next ordinal number for the company and year
    SELECT COALESCE(MAX(ordinal_number), 0) + 1
    INTO next_ordinal
    FROM public.kpo_entries
    WHERE company_id = NEW.company_id AND year = NEW.year;

    -- Get client name
    client_name := NEW.client_name;

    -- Insert KPO entry
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
      NEW.year
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Ensure the trigger is attached to the invoices table
DROP TRIGGER IF EXISTS create_kpo_entry_trigger ON public.invoices;
CREATE TRIGGER create_kpo_entry_trigger
  AFTER INSERT ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.create_kpo_entry();