-- Add a boolean column to track if SEF API key is configured
-- This allows clients to check if key exists without exposing the key itself
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS has_sef_api_key boolean GENERATED ALWAYS AS (sef_api_key IS NOT NULL AND sef_api_key <> '') STORED;

-- Update the companies_safe view to include this new computed column
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
  has_sef_api_key,
  created_at,
  updated_at
FROM public.companies;

-- Grant access to authenticated users (RLS from companies table will apply)
GRANT SELECT ON public.companies_safe TO authenticated;