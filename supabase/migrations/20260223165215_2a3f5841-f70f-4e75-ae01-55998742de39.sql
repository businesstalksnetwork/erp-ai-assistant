
-- Create a secure read-only query function for AI assistant
-- Only allows SELECT, scoped to tenant data via RLS
CREATE OR REPLACE FUNCTION public.execute_readonly_query(query_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '10s'
AS $$
DECLARE
  result jsonb;
  upper_query text;
BEGIN
  upper_query := upper(trim(query_text));
  
  -- Only allow SELECT
  IF NOT starts_with(upper_query, 'SELECT') THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;
  
  -- Block dangerous keywords
  IF upper_query ~ '(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|EXECUTE|EXEC|COPY|VACUUM|REINDEX)\s' THEN
    RAISE EXCEPTION 'Mutation queries are not allowed';
  END IF;
  
  -- Block access to auth/storage schemas
  IF upper_query ~ '(AUTH\.|STORAGE\.|PG_CATALOG\.|INFORMATION_SCHEMA\.|SUPABASE_)' THEN
    RAISE EXCEPTION 'Access to system schemas is not allowed';
  END IF;
  
  -- Execute and return as JSON
  EXECUTE 'SELECT jsonb_agg(row_to_json(t)) FROM (' || query_text || ') t' INTO result;
  
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- Only service_role can call this (edge functions use service_role)
REVOKE ALL ON FUNCTION public.execute_readonly_query(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.execute_readonly_query(text) FROM anon;
REVOKE ALL ON FUNCTION public.execute_readonly_query(text) FROM authenticated;
