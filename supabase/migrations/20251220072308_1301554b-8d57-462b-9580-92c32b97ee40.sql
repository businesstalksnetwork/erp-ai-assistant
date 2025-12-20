-- Add client_maticni_broj column to invoices table
ALTER TABLE public.invoices 
ADD COLUMN client_maticni_broj text;