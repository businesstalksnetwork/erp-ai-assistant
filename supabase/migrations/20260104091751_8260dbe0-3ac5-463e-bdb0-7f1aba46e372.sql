-- Dodavanje tipa fakture: 'regular' (obična), 'proforma' (predračun), 'advance' (avansna)
ALTER TABLE public.invoices ADD COLUMN invoice_type text DEFAULT 'regular';

-- Veza sa avansnom fakturom (za obične fakture koje koriste avans)
ALTER TABLE public.invoices ADD COLUMN linked_advance_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL;

-- Status avansne fakture: 'open' (otvorena), 'closed' (zatvorena/iskorišćena)
ALTER TABLE public.invoices ADD COLUMN advance_status text DEFAULT NULL;

-- Migracija postojećih podataka
UPDATE public.invoices SET invoice_type = CASE 
  WHEN is_proforma = true THEN 'proforma' 
  ELSE 'regular' 
END;

-- Indeks za brže pretraživanje otvorenih avansnih faktura
CREATE INDEX idx_invoices_advance_status ON public.invoices(advance_status) WHERE advance_status IS NOT NULL;

-- Indeks za povezane avansne fakture
CREATE INDEX idx_invoices_linked_advance ON public.invoices(linked_advance_id) WHERE linked_advance_id IS NOT NULL;