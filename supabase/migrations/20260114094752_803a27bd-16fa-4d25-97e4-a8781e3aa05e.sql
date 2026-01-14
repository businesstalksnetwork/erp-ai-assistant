-- Dodaj kolonu country u tabelu clients
ALTER TABLE public.clients 
ADD COLUMN country text DEFAULT NULL;