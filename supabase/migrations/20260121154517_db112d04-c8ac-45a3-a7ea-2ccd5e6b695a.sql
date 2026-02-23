-- Fix 1: Make reminder-attachments bucket private and update RLS policy
UPDATE storage.buckets SET public = false WHERE id = 'reminder-attachments';

-- Drop the existing overly permissive VIEW policy
DROP POLICY IF EXISTS "Users can view reminder attachments" ON storage.objects;

-- Create a proper VIEW policy that requires authentication and company ownership
CREATE POLICY "Users can view own company reminder attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'reminder-attachments' 
  AND auth.uid() IS NOT NULL
  AND (
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id::text = split_part(name, '/', 1)
      AND (c.user_id = auth.uid() OR is_bookkeeper_for(c.user_id))
    )
  )
);

-- Fix 2: Add advisory lock to get_next_invoice_number to prevent race conditions
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
  v_lock_key BIGINT;
BEGIN
  -- Create unique lock key from company_id, year, and proforma flag
  v_lock_key := hashtext(p_company_id::text || '_' || p_year::text || '_' || p_is_proforma::text);
  
  -- Acquire advisory lock for this company/year/type combination
  PERFORM pg_advisory_xact_lock(v_lock_key);
  
  v_prefix := CASE WHEN p_is_proforma THEN 'PR-' ELSE '' END;
  
  -- Get the maximum number used (now protected by lock)
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

-- Also fix get_next_invoice_number_by_type with the same advisory lock pattern
CREATE OR REPLACE FUNCTION public.get_next_invoice_number_by_type(
  p_company_id UUID,
  p_year INTEGER,
  p_invoice_type TEXT
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
  v_lock_key BIGINT;
BEGIN
  -- Create unique lock key from company_id, year, and invoice type
  v_lock_key := hashtext(p_company_id::text || '_' || p_year::text || '_' || p_invoice_type);
  
  -- Acquire advisory lock for this company/year/type combination
  PERFORM pg_advisory_xact_lock(v_lock_key);
  
  -- Determine prefix based on type
  v_prefix := CASE 
    WHEN p_invoice_type = 'proforma' THEN 'PR-'
    WHEN p_invoice_type = 'advance' THEN 'AV-'
    ELSE '' 
  END;
  
  -- Find maximum number for this type and year (now protected by lock)
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
$$;