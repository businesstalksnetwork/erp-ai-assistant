-- Add client_city and client_country columns to invoices table
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS client_city TEXT,
ADD COLUMN IF NOT EXISTS client_country TEXT;