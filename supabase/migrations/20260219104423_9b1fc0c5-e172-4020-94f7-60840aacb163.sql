
-- Fix: Add ownership verification to get_company_sef_api_key SECURITY DEFINER function
-- and explicitly revoke EXECUTE from authenticated role

CREATE OR REPLACE FUNCTION public.get_company_sef_api_key(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_api_key text;
  v_owner_id uuid;
BEGIN
  -- Get company owner
  SELECT user_id INTO v_owner_id
  FROM companies
  WHERE id = p_company_id;

  -- Only allow if called by service_role OR the actual owner of the company
  IF auth.role() != 'service_role' AND (auth.uid() IS NULL OR auth.uid() != v_owner_id) THEN
    RAISE EXCEPTION 'Unauthorized access to SEF API key';
  END IF;

  SELECT sef_api_key INTO v_api_key
  FROM companies
  WHERE id = p_company_id;

  RETURN v_api_key;
END;
$$;

-- Explicitly revoke execute from all non-service roles
REVOKE EXECUTE ON FUNCTION public.get_company_sef_api_key(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_company_sef_api_key(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_company_sef_api_key(uuid) FROM authenticated;

-- Document the function's restricted purpose
COMMENT ON FUNCTION public.get_company_sef_api_key IS 'INTERNAL: Retrieve SEF API key. Only callable by service_role (via edge functions) or the company owner. Never expose directly to client code.';
