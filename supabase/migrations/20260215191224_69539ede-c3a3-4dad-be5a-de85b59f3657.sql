CREATE OR REPLACE FUNCTION public.force_delete_journal_entries(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Disable triggers that block deletion of posted entries
  ALTER TABLE journal_lines DISABLE TRIGGER trg_block_posted_journal_lines_mutation;
  ALTER TABLE journal_entries DISABLE TRIGGER trg_block_posted_journal_mutation;
  
  -- Delete journal lines first
  DELETE FROM journal_lines WHERE journal_entry_id IN (
    SELECT id FROM journal_entries WHERE tenant_id = p_tenant_id
  );
  
  -- Delete journal entries
  DELETE FROM journal_entries WHERE tenant_id = p_tenant_id;
  
  -- Re-enable triggers
  ALTER TABLE journal_lines ENABLE TRIGGER trg_block_posted_journal_lines_mutation;
  ALTER TABLE journal_entries ENABLE TRIGGER trg_block_posted_journal_mutation;
END;
$$;