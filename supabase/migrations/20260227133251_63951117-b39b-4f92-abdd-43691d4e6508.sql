-- Add supplier_invoice_id to kalkulacije for eFaktura→Kalkulacija bridge
ALTER TABLE public.kalkulacije 
ADD COLUMN IF NOT EXISTS supplier_invoice_id uuid REFERENCES public.supplier_invoices(id);

CREATE INDEX IF NOT EXISTS idx_kalkulacije_supplier_invoice 
ON public.kalkulacije(supplier_invoice_id) WHERE supplier_invoice_id IS NOT NULL;