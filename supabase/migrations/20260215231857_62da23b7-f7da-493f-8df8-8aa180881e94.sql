
CREATE OR REPLACE FUNCTION public.force_delete_journal_entries(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Disable all journal protection triggers
  ALTER TABLE journal_lines DISABLE TRIGGER trg_protect_posted_lines_update;
  ALTER TABLE journal_lines DISABLE TRIGGER trg_protect_posted_lines_delete;
  ALTER TABLE journal_entries DISABLE TRIGGER trg_protect_posted_entry;
  ALTER TABLE journal_entries DISABLE TRIGGER trg_check_journal_balance;
  
  DELETE FROM journal_lines WHERE journal_entry_id IN (
    SELECT id FROM journal_entries WHERE tenant_id = p_tenant_id
  );
  DELETE FROM journal_entries WHERE tenant_id = p_tenant_id;
  
  -- Re-enable triggers
  ALTER TABLE journal_lines ENABLE TRIGGER trg_protect_posted_lines_update;
  ALTER TABLE journal_lines ENABLE TRIGGER trg_protect_posted_lines_delete;
  ALTER TABLE journal_entries ENABLE TRIGGER trg_protect_posted_entry;
  ALTER TABLE journal_entries ENABLE TRIGGER trg_check_journal_balance;
END;
$$;
