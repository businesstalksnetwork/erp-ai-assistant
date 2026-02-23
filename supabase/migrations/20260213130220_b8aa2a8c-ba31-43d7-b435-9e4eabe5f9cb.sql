
-- Migration 4: eOtpremnica connections + API columns
CREATE TABLE public.eotpremnica_connections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  api_url text,
  api_key_encrypted text,
  environment text NOT NULL DEFAULT 'sandbox',
  is_active boolean NOT NULL DEFAULT false,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.eotpremnica_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view eotpremnica connections"
  ON public.eotpremnica_connections FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE POLICY "Tenant admins can manage eotpremnica connections"
  ON public.eotpremnica_connections FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active' AND role = 'admin'));

-- Add API columns to eotpremnica table
ALTER TABLE public.eotpremnica
  ADD COLUMN IF NOT EXISTS api_status text NOT NULL DEFAULT 'not_submitted',
  ADD COLUMN IF NOT EXISTS api_request_id text,
  ADD COLUMN IF NOT EXISTS api_response jsonb;

-- Migration 5: Fiscal receipts retry columns
ALTER TABLE public.fiscal_receipts
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pending';
