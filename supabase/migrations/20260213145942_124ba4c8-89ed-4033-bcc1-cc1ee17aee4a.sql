
-- Add configurable tax label mapping to fiscal devices
ALTER TABLE public.fiscal_devices
ADD COLUMN IF NOT EXISTS tax_label_map jsonb DEFAULT '{"20":"A","10":"G","0":"E"}'::jsonb;

-- Add request_id to fiscal_receipts for timeout recovery correlation
ALTER TABLE public.fiscal_receipts
ADD COLUMN IF NOT EXISTS request_id uuid;
