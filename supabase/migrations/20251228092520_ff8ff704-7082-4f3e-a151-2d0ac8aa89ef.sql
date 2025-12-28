-- Make invoice_id nullable in kpo_entries to support fiscal cash register entries
ALTER TABLE public.kpo_entries 
ALTER COLUMN invoice_id DROP NOT NULL;

-- Drop the one-to-one constraint and recreate as regular foreign key that allows nulls
ALTER TABLE public.kpo_entries 
DROP CONSTRAINT IF EXISTS kpo_entries_invoice_id_fkey;

ALTER TABLE public.kpo_entries 
ADD CONSTRAINT kpo_entries_invoice_id_fkey 
FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;