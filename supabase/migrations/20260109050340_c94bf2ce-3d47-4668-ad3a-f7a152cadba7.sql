-- Dodaj foreign_amount kolonu u invoice_items tabelu za čuvanje deviznog iznosa po stavci
ALTER TABLE public.invoice_items 
ADD COLUMN foreign_amount NUMERIC DEFAULT NULL;