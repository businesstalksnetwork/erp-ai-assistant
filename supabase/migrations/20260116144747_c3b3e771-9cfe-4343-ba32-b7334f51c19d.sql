-- Dodaj VAT number kolonu za strane klijente
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS vat_number text;

-- Dodaj client_vat_number kolonu u invoices tabelu
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS client_vat_number text;

-- Dodaj client_vat_number kolonu u invoice_templates tabelu
ALTER TABLE public.invoice_templates ADD COLUMN IF NOT EXISTS client_vat_number text;

-- Dodaj komentar za dokumentaciju
COMMENT ON COLUMN public.clients.vat_number IS 'VAT broj za strane klijente';
COMMENT ON COLUMN public.invoices.client_vat_number IS 'VAT broj klijenta sačuvan sa fakturom';
COMMENT ON COLUMN public.invoice_templates.client_vat_number IS 'VAT broj klijenta za šablon';