-- Add payment tracking columns to invoices table
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'unpaid',
ADD COLUMN IF NOT EXISTS paid_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_date date;

-- Add check constraint for payment_status
ALTER TABLE public.invoices
ADD CONSTRAINT invoices_payment_status_check 
CHECK (payment_status IN ('unpaid', 'partial', 'paid'));