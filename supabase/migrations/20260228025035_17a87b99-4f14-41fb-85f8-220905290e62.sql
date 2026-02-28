
-- Phase 6.1: AI enhancements to cycle counting

-- Add AI columns to wms_cycle_count_lines
ALTER TABLE public.wms_cycle_count_lines
  ADD COLUMN IF NOT EXISTS abc_class TEXT,
  ADD COLUMN IF NOT EXISTS ai_priority_score NUMERIC,
  ADD COLUMN IF NOT EXISTS auto_approved BOOLEAN DEFAULT false;

-- Add AI columns to wms_cycle_counts
ALTER TABLE public.wms_cycle_counts
  ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS accuracy_rate NUMERIC;

-- Create count schedule config table
CREATE TABLE IF NOT EXISTS public.wms_count_schedule_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  abc_a_frequency_days INTEGER NOT NULL DEFAULT 30,
  abc_b_frequency_days INTEGER NOT NULL DEFAULT 60,
  abc_c_frequency_days INTEGER NOT NULL DEFAULT 90,
  auto_approve_threshold_pct NUMERIC NOT NULL DEFAULT 2.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, warehouse_id)
);

ALTER TABLE public.wms_count_schedule_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.wms_count_schedule_config
  FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));
