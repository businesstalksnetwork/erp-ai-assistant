-- Add SEF API key storage to companies
ALTER TABLE public.companies 
ADD COLUMN sef_api_key text;

-- Add SEF integration columns to invoices
ALTER TABLE public.invoices
ADD COLUMN sef_invoice_id text,
ADD COLUMN sef_status text DEFAULT 'not_sent',
ADD COLUMN sef_sent_at timestamp with time zone,
ADD COLUMN sef_error text;

-- Create index for SEF status queries
CREATE INDEX idx_invoices_sef_status ON public.invoices(sef_status);

-- Add comment for documentation
COMMENT ON COLUMN public.companies.sef_api_key IS 'API key from SEF (Sistem E-Faktura) for e-invoice integration';
COMMENT ON COLUMN public.invoices.sef_invoice_id IS 'Invoice ID returned from SEF after successful submission';
COMMENT ON COLUMN public.invoices.sef_status IS 'Status of SEF submission: not_sent, pending, sent, approved, rejected, error';
COMMENT ON COLUMN public.invoices.sef_sent_at IS 'Timestamp when invoice was sent to SEF';
COMMENT ON COLUMN public.invoices.sef_error IS 'Error message if SEF submission failed';