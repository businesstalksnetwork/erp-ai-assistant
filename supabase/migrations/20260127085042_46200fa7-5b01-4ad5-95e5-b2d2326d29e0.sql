-- Add payment tracking to fiscal entries
ALTER TABLE public.fiscal_entries 
ADD COLUMN is_paid BOOLEAN NOT NULL DEFAULT false;

-- Add index for payment status queries
CREATE INDEX idx_fiscal_entries_is_paid ON public.fiscal_entries(company_id, entry_date, is_paid);