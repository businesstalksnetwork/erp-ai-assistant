-- Delete duplicates (keep the newest by id)
DELETE FROM sef_invoices a USING sef_invoices b
WHERE a.id < b.id
AND a.company_id = b.company_id
AND a.sef_invoice_id = b.sef_invoice_id
AND a.invoice_type = b.invoice_type;

-- Add unique constraint if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sef_invoices_unique_company_sef_type'
  ) THEN
    ALTER TABLE sef_invoices
    ADD CONSTRAINT sef_invoices_unique_company_sef_type
    UNIQUE (company_id, sef_invoice_id, invoice_type);
  END IF;
END $$;