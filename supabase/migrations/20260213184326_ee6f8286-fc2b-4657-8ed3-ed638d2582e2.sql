-- Add paid_at column to invoices for DSO calculation
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;

-- Backfill paid_at for already-paid invoices (use due_date as estimate)
UPDATE public.invoices SET paid_at = due_date WHERE status = 'paid' AND paid_at IS NULL AND due_date IS NOT NULL;