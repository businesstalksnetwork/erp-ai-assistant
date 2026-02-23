-- Drop the duplicate trigger (one is enough)
DROP TRIGGER IF EXISTS on_invoice_created ON public.invoices;

-- Add unique constraint on invoice_number per company/year/is_proforma
ALTER TABLE public.invoices 
ADD CONSTRAINT invoices_unique_number_per_company_year 
UNIQUE (company_id, year, is_proforma, invoice_number);

-- Add unique constraint on kpo_entries to prevent duplicate entries per invoice
ALTER TABLE public.kpo_entries 
ADD CONSTRAINT kpo_entries_unique_invoice 
UNIQUE (invoice_id);

-- Create a function to get the next invoice number atomically
CREATE OR REPLACE FUNCTION public.get_next_invoice_number(
  p_company_id UUID,
  p_year INTEGER,
  p_is_proforma BOOLEAN
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix TEXT;
  v_max_num INTEGER;
  v_next_num INTEGER;
BEGIN
  v_prefix := CASE WHEN p_is_proforma THEN 'PR-' ELSE '' END;
  
  -- Get the maximum number used
  SELECT COALESCE(MAX(
    CAST(
      REGEXP_REPLACE(
        REPLACE(invoice_number, 'PR-', ''),
        '/.*$', ''
      ) AS INTEGER
    )
  ), 0)
  INTO v_max_num
  FROM public.invoices
  WHERE company_id = p_company_id
    AND year = p_year
    AND is_proforma = p_is_proforma;
  
  v_next_num := v_max_num + 1;
  
  RETURN v_prefix || v_next_num || '/' || p_year;
END;
$$;