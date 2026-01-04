-- Create new function for generating invoice numbers by type
CREATE OR REPLACE FUNCTION public.get_next_invoice_number_by_type(
  p_company_id uuid, 
  p_year integer, 
  p_invoice_type text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_prefix TEXT;
  v_max_num INTEGER;
  v_next_num INTEGER;
BEGIN
  -- Determine prefix based on type
  v_prefix := CASE 
    WHEN p_invoice_type = 'proforma' THEN 'PR-'
    WHEN p_invoice_type = 'advance' THEN 'AV-'
    ELSE '' 
  END;
  
  -- Find maximum number for this type and year
  SELECT COALESCE(MAX(
    CAST(
      REGEXP_REPLACE(
        REGEXP_REPLACE(invoice_number, '^(PR-|AV-)', ''),
        '/.*$', ''
      ) AS INTEGER
    )
  ), 0)
  INTO v_max_num
  FROM public.invoices
  WHERE company_id = p_company_id
    AND year = p_year
    AND invoice_type = p_invoice_type;
  
  v_next_num := v_max_num + 1;
  
  RETURN v_prefix || v_next_num || '/' || p_year;
END;
$function$;