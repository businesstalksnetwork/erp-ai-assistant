-- Fix 1: Company logos storage policies - verify company ownership

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Users can upload own company logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own company logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own company logos" ON storage.objects;

-- Create secure upload policy that verifies company ownership
CREATE POLICY "Users can upload own company logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'company-logos' 
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id::text = split_part(name, '/', 1)
    AND (c.user_id = auth.uid() OR public.is_bookkeeper_for(c.user_id))
  )
);

-- Create secure update policy that verifies company ownership
CREATE POLICY "Users can update own company logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'company-logos' 
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id::text = split_part(name, '/', 1)
    AND (c.user_id = auth.uid() OR public.is_bookkeeper_for(c.user_id))
  )
);

-- Create secure delete policy that verifies company ownership
CREATE POLICY "Users can delete own company logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'company-logos' 
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id::text = split_part(name, '/', 1)
    AND (c.user_id = auth.uid() OR public.is_bookkeeper_for(c.user_id))
  )
);

-- Fix 2: Create safe view for companies without sef_api_key
-- This prevents accidental exposure of sensitive API keys to client code

CREATE OR REPLACE VIEW public.companies_safe AS
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
  -- Explicitly exclude sef_api_key
FROM public.companies;

-- Grant access to authenticated users
GRANT SELECT ON public.companies_safe TO authenticated;

-- Allow RLS to work on the view
ALTER VIEW public.companies_safe SET (security_invoker = on);