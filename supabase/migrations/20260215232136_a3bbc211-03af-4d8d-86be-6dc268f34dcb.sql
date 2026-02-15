
-- Temporarily disable all journal triggers
ALTER TABLE journal_lines DISABLE TRIGGER trg_protect_posted_lines_update;
ALTER TABLE journal_lines DISABLE TRIGGER trg_protect_posted_lines_delete;
ALTER TABLE journal_lines DISABLE TRIGGER trg_block_posted_journal_lines_mutation;
ALTER TABLE journal_entries DISABLE TRIGGER trg_protect_posted_entry;
ALTER TABLE journal_entries DISABLE TRIGGER trg_check_journal_balance;
ALTER TABLE journal_entries DISABLE TRIGGER trg_block_posted_journal_mutation;

-- Delete FK children referencing journal_entries for this tenant
DELETE FROM bank_statement_lines WHERE journal_entry_id IN (
  SELECT id FROM journal_entries WHERE tenant_id = '92474a4b-ff91-48da-b111-89924e70b8b8'
);
DELETE FROM bad_debt_provisions WHERE journal_entry_id IN (
  SELECT id FROM journal_entries WHERE tenant_id = '92474a4b-ff91-48da-b111-89924e70b8b8'
);
DELETE FROM deferral_schedules WHERE journal_entry_id IN (
  SELECT id FROM journal_entries WHERE tenant_id = '92474a4b-ff91-48da-b111-89924e70b8b8'
);

DELETE FROM journal_lines WHERE journal_entry_id IN (
  SELECT id FROM journal_entries WHERE tenant_id = '92474a4b-ff91-48da-b111-89924e70b8b8'
);
DELETE FROM journal_entries WHERE tenant_id = '92474a4b-ff91-48da-b111-89924e70b8b8';

-- Re-enable triggers
ALTER TABLE journal_lines ENABLE TRIGGER trg_protect_posted_lines_update;
ALTER TABLE journal_lines ENABLE TRIGGER trg_protect_posted_lines_delete;
ALTER TABLE journal_lines ENABLE TRIGGER trg_block_posted_journal_lines_mutation;
ALTER TABLE journal_entries ENABLE TRIGGER trg_protect_posted_entry;
ALTER TABLE journal_entries ENABLE TRIGGER trg_check_journal_balance;
ALTER TABLE journal_entries ENABLE TRIGGER trg_block_posted_journal_mutation;
