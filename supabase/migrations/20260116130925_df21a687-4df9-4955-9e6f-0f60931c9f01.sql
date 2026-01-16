-- Dodaj kolonu country u companies tabelu
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS country text;

-- Backfill service_date za fakture koje nemaju datum prometa
UPDATE public.invoices SET service_date = issue_date WHERE service_date IS NULL;

-- Postavi service_date kao NOT NULL
ALTER TABLE public.invoices ALTER COLUMN service_date SET NOT NULL;