
-- Add journal_entry_id to payroll_runs to track GL posting
ALTER TABLE public.payroll_runs
ADD COLUMN IF NOT EXISTS journal_entry_id UUID REFERENCES public.journal_entries(id),
ADD COLUMN IF NOT EXISTS employer_journal_entry_id UUID REFERENCES public.journal_entries(id),
ADD COLUMN IF NOT EXISTS payment_journal_entry_id UUID REFERENCES public.journal_entries(id);

COMMENT ON COLUMN public.payroll_runs.journal_entry_id IS 'Journal entry for salary accrual (gross expense)';
COMMENT ON COLUMN public.payroll_runs.employer_journal_entry_id IS 'Journal entry for employer contributions';
COMMENT ON COLUMN public.payroll_runs.payment_journal_entry_id IS 'Journal entry for salary payment (bank)';
