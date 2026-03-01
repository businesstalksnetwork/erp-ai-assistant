-- P4-01: Add discount_percent to invoice_lines for rabat support
ALTER TABLE public.invoice_lines
ADD COLUMN IF NOT EXISTS discount_percent numeric DEFAULT 0;

COMMENT ON COLUMN public.invoice_lines.discount_percent IS 'Line-level discount percentage (rabat)';