-- Create a function that service role can call to force-delete journal entries (bypasses trigger)
CREATE OR REPLACE FUNCTION public.force_delete_journal_entries(p_tenant_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Temporarily disable the trigger
  ALTER TABLE journal_entries DISABLE TRIGGER trg_block_posted_journal_mutation;
  
  -- Delete lines first
  DELETE FROM journal_lines WHERE journal_entry_id IN (
    SELECT id FROM journal_entries WHERE tenant_id = p_tenant_id
  );
  
  -- Delete entries
  DELETE FROM journal_entries WHERE tenant_id = p_tenant_id;
  
  -- Re-enable the trigger
  ALTER TABLE journal_entries ENABLE TRIGGER trg_block_posted_journal_mutation;
END;
$$;