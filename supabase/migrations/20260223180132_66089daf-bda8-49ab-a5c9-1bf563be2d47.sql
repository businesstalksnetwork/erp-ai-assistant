
-- Add priority column to production_orders
ALTER TABLE public.production_orders ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 3;

-- Create production_scenarios table for persistent scenario storage
CREATE TABLE IF NOT EXISTS public.production_scenarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  scenario_type TEXT NOT NULL DEFAULT 'simulation',
  params JSONB NOT NULL DEFAULT '{}',
  result JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'completed',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.production_scenarios ENABLE ROW LEVEL SECURITY;

-- Tenant-scoped policies
CREATE POLICY "Tenant members can view scenarios"
ON public.production_scenarios FOR SELECT
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant members can create scenarios"
ON public.production_scenarios FOR INSERT
WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant members can update scenarios"
ON public.production_scenarios FOR UPDATE
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant members can delete scenarios"
ON public.production_scenarios FOR DELETE
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- Index for fast tenant queries
CREATE INDEX IF NOT EXISTS idx_production_scenarios_tenant ON public.production_scenarios(tenant_id, scenario_type, created_at DESC);
