-- Dodaj polje za mesto u tabelu companies
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS city TEXT;

-- Dodaj polje za mesto u tabelu clients
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS city TEXT;

-- Dodaj polje za mesto prometa u tabelu invoices
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS place_of_service TEXT;