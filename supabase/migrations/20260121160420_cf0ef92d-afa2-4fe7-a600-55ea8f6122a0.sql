-- Fix 1: Recreate companies_safe view with security_invoker = true
-- This ensures the view respects the RLS policies of the underlying companies table
DROP VIEW IF EXISTS public.companies_safe;

CREATE VIEW public.companies_safe 
WITH (security_invoker = true)
AS
SELECT 
  id,
  user_id,
  name,
  address,
  city,
  country,
  pib,
  maticni_broj,
  bank_account,
  logo_url,
  is_active,
  fiscal_enabled,
  sef_enabled,
  created_at,
  updated_at
FROM public.companies;

-- Grant access to authenticated users (RLS from companies table will apply)
GRANT SELECT ON public.companies_safe TO authenticated;

-- Fix 2: Create a secure function to get sef_api_key
-- Only callable from edge functions using service role
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.get_company_sef_api_key(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_api_key text;
BEGIN
  SELECT sef_api_key INTO v_api_key
  FROM companies
  WHERE id = p_company_id;
  
  RETURN v_api_key;
END;
$$;

-- Revoke execute from public and anon - only service role should use this
REVOKE EXECUTE ON FUNCTION public.get_company_sef_api_key(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_company_sef_api_key(uuid) FROM anon;

-- Add documentation comment
COMMENT ON COLUMN public.companies.sef_api_key IS 'SENSITIVE: API key for SEF integration. Access only via get_company_sef_api_key() function from edge functions.';