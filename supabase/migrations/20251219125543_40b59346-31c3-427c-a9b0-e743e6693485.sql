-- Add maticni_broj column to clients table
ALTER TABLE public.clients ADD COLUMN maticni_broj text;

-- Create unique constraint on PIB (only for domestic clients with non-null PIB)
CREATE UNIQUE INDEX clients_pib_unique ON public.clients (company_id, pib) 
WHERE pib IS NOT NULL AND pib != '';

-- Create unique constraint on MB (only for non-null MB)
CREATE UNIQUE INDEX clients_maticni_broj_unique ON public.clients (company_id, maticni_broj) 
WHERE maticni_broj IS NOT NULL AND maticni_broj != '';