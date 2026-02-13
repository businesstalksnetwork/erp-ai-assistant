
-- Create web_sync_logs table
CREATE TABLE public.web_sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  web_connection_id UUID NOT NULL,
  sync_type TEXT NOT NULL DEFAULT 'full',
  status TEXT NOT NULL DEFAULT 'pending',
  products_synced INT DEFAULT 0,
  errors JSONB DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.web_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant sync logs"
  ON public.web_sync_logs FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can insert sync logs for their tenant"
  ON public.web_sync_logs FOR INSERT
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can update their tenant sync logs"
  ON public.web_sync_logs FOR UPDATE
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- Add source, web_connection_id, external_order_id to sales_orders
ALTER TABLE public.sales_orders ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
ALTER TABLE public.sales_orders ADD COLUMN IF NOT EXISTS web_connection_id UUID;
ALTER TABLE public.sales_orders ADD COLUMN IF NOT EXISTS external_order_id TEXT;
