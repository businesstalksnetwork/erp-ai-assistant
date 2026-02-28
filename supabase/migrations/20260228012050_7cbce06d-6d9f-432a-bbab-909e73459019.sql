
-- Phase 10: PROD-AI-1 Work Centers & Equipment tables
CREATE TABLE IF NOT EXISTS public.work_centers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  description text,
  capacity_per_hour numeric DEFAULT 0,
  is_active boolean DEFAULT true,
  location text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.work_centers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for work_centers" ON public.work_centers FOR ALL USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
);

CREATE TABLE IF NOT EXISTS public.equipment (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  work_center_id uuid REFERENCES public.work_centers(id) ON DELETE SET NULL,
  name text NOT NULL,
  code text NOT NULL,
  equipment_type text DEFAULT 'machine',
  status text DEFAULT 'operational',
  last_maintenance_date date,
  next_maintenance_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for equipment" ON public.equipment FOR ALL USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
);

-- Phase 10: PROD-AI-2 OEE logs table for tracking availability/performance/quality
CREATE TABLE IF NOT EXISTS public.oee_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  work_center_id uuid NOT NULL REFERENCES public.work_centers(id) ON DELETE CASCADE,
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  planned_time_minutes numeric NOT NULL DEFAULT 480,
  actual_run_time_minutes numeric NOT NULL DEFAULT 0,
  downtime_minutes numeric NOT NULL DEFAULT 0,
  ideal_cycle_time_seconds numeric DEFAULT 0,
  total_units_produced numeric NOT NULL DEFAULT 0,
  good_units numeric NOT NULL DEFAULT 0,
  defect_units numeric NOT NULL DEFAULT 0,
  availability numeric GENERATED ALWAYS AS (
    CASE WHEN planned_time_minutes > 0 THEN (planned_time_minutes - downtime_minutes) / planned_time_minutes ELSE 0 END
  ) STORED,
  performance numeric GENERATED ALWAYS AS (
    CASE WHEN actual_run_time_minutes > 0 AND ideal_cycle_time_seconds > 0
      THEN (total_units_produced * ideal_cycle_time_seconds / 60.0) / actual_run_time_minutes ELSE 0 END
  ) STORED,
  quality numeric GENERATED ALWAYS AS (
    CASE WHEN total_units_produced > 0 THEN good_units::numeric / total_units_produced ELSE 0 END
  ) STORED,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.oee_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for oee_logs" ON public.oee_logs FOR ALL USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
);

-- Phase 10: PROD-AI-12 QC Checkpoints
CREATE TABLE IF NOT EXISTS public.qc_checkpoints (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  production_order_id uuid NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
  stage_name text NOT NULL,
  stage_order integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending',
  inspector_id uuid,
  inspected_at timestamptz,
  result text,
  notes text,
  defects_found integer DEFAULT 0,
  pass_criteria text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT qc_status_check CHECK (status IN ('pending', 'in_progress', 'passed', 'failed', 'waived'))
);

ALTER TABLE public.qc_checkpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for qc_checkpoints" ON public.qc_checkpoints FOR ALL USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
);
