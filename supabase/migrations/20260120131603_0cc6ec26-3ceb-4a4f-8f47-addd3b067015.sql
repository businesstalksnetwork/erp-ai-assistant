-- Allow NULL values for columns that may not be available from SEF API
-- This is needed because SEF API may return rate limit (429) or incomplete data

ALTER TABLE sef_invoices 
  ALTER COLUMN invoice_number DROP NOT NULL;

ALTER TABLE sef_invoices 
  ALTER COLUMN issue_date DROP NOT NULL;

ALTER TABLE sef_invoices 
  ALTER COLUMN counterparty_name DROP NOT NULL;