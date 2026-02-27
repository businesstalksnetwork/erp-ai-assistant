
-- Add product_id to service_devices (device is an instance of a product)
ALTER TABLE public.service_devices
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_devices_product ON service_devices(tenant_id, product_id);

-- Add walk-in customer fields for retail channel (no partner required)
ALTER TABLE public.service_orders
ADD COLUMN IF NOT EXISTS customer_name TEXT,
ADD COLUMN IF NOT EXISTS customer_phone TEXT,
ADD COLUMN IF NOT EXISTS customer_email TEXT;
