
CREATE OR REPLACE FUNCTION public.force_delete_journal_entries(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Use session_replication_role to bypass all triggers
  SET LOCAL session_replication_role = 'replica';
  
  -- Delete FK children referencing journal_entries
  DELETE FROM bank_statement_lines WHERE journal_entry_id IN (
    SELECT id FROM journal_entries WHERE tenant_id = p_tenant_id
  );
  DELETE FROM bad_debt_provisions WHERE journal_entry_id IN (
    SELECT id FROM journal_entries WHERE tenant_id = p_tenant_id
  );
  DELETE FROM deferral_schedules WHERE journal_entry_id IN (
    SELECT id FROM journal_entries WHERE tenant_id = p_tenant_id
  );
  
  DELETE FROM journal_lines WHERE journal_entry_id IN (
    SELECT id FROM journal_entries WHERE tenant_id = p_tenant_id
  );
  DELETE FROM journal_entries WHERE tenant_id = p_tenant_id;
  
  -- Restore normal trigger behavior
  SET LOCAL session_replication_role = 'origin';
END;
$$;
