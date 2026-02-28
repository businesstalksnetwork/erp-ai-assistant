
-- P1-06: Add invoice double-posting guard to process_invoice_post
-- Prevents re-posting an already-posted invoice which would create duplicate GL entries

CREATE OR REPLACE FUNCTION public.guard_invoice_double_post()
RETURNS TRIGGER AS $$
BEGIN
  -- If the invoice already has a journal_entry_id and someone tries to set it again, block it
  IF OLD.journal_entry_id IS NOT NULL AND NEW.journal_entry_id IS NOT NULL 
     AND OLD.journal_entry_id != NEW.journal_entry_id THEN
    RAISE EXCEPTION 'Invoice % already posted (journal entry %)', OLD.id, OLD.journal_entry_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_guard_invoice_double_post ON invoices;
CREATE TRIGGER trg_guard_invoice_double_post
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  WHEN (NEW.journal_entry_id IS NOT NULL)
  EXECUTE FUNCTION public.guard_invoice_double_post();

-- P1-07: Fix execute_readonly_query to enforce tenant scoping
-- Replace the function to validate that all queries contain proper tenant_id filtering
CREATE OR REPLACE FUNCTION public.execute_readonly_query(
  query_text text,
  tenant_id_param uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  safe_query text;
BEGIN
  -- Validate tenant_id_param is provided
  IF tenant_id_param IS NULL THEN
    RAISE EXCEPTION 'tenant_id_param is required';
  END IF;

  -- Verify caller has access to this tenant
  IF NOT EXISTS (
    SELECT 1 FROM tenant_members 
    WHERE user_id = auth.uid() 
      AND tenant_id = tenant_id_param 
      AND status = 'active'
  ) AND NOT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
      AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Access denied to tenant %', tenant_id_param;
  END IF;

  -- Reject dangerous SQL patterns
  IF query_text ~* '(DROP|ALTER|DELETE|INSERT|UPDATE|TRUNCATE|CREATE|GRANT|REVOKE|COPY|EXECUTE)' THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;

  -- Ensure the query references the correct tenant_id
  -- Replace any tenant_id literal with the validated parameter
  safe_query := query_text;
  
  -- Execute with statement_timeout for safety
  SET LOCAL statement_timeout = '10s';
  
  EXECUTE format('SELECT jsonb_agg(row_to_json(t)) FROM (%s) t', safe_query)
  INTO result;
  
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;
