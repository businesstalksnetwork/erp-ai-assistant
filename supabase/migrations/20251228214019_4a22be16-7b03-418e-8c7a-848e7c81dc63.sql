-- Add document_date column to kpo_entries
ALTER TABLE public.kpo_entries ADD COLUMN document_date DATE;

-- Populate document_date for existing entries from linked invoices
UPDATE public.kpo_entries k
SET document_date = COALESCE(i.service_date, i.issue_date)
FROM public.invoices i
WHERE k.invoice_id = i.id AND k.document_date IS NULL;

-- For fiscal entries (no invoice_id), try to extract date from description
-- Description format: "Fiskalni promet DD.MM.YYYY" or similar
UPDATE public.kpo_entries
SET document_date = (
  CASE 
    WHEN description ~ '\d{2}\.\d{2}\.\d{4}' THEN
      TO_DATE(
        SUBSTRING(description FROM '\d{2}\.\d{2}\.\d{4}'),
        'DD.MM.YYYY'
      )
    ELSE NULL
  END
)
WHERE invoice_id IS NULL AND document_date IS NULL;

-- Create index for better sorting performance
CREATE INDEX IF NOT EXISTS idx_kpo_entries_document_date ON public.kpo_entries(company_id, year, document_date);