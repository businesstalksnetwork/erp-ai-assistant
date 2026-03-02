
-- ITSM-01: SLA Definitions + Measurements (ISO 20000)
CREATE TABLE public.sla_definitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  service_name TEXT NOT NULL,
  metric_type TEXT NOT NULL DEFAULT 'availability',
  target_value NUMERIC NOT NULL DEFAULT 99.9,
  unit TEXT NOT NULL DEFAULT 'percent',
  measurement_period TEXT NOT NULL DEFAULT 'monthly',
  penalty_description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sla_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view SLA definitions"
  ON public.sla_definitions FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

CREATE POLICY "Tenant admins can manage SLA definitions"
  ON public.sla_definitions FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')));

CREATE TABLE public.sla_measurements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  sla_id UUID NOT NULL REFERENCES public.sla_definitions(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  actual_value NUMERIC NOT NULL,
  target_met BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  measured_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sla_measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view SLA measurements"
  ON public.sla_measurements FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

CREATE POLICY "Tenant admins can manage SLA measurements"
  ON public.sla_measurements FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')));

-- ITSM-02: Incidents table (ISO 20000)
CREATE TABLE public.incidents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  incident_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  category TEXT NOT NULL DEFAULT 'general',
  reported_by UUID,
  assigned_to UUID,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  root_cause TEXT,
  impact TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view incidents"
  ON public.incidents FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

CREATE POLICY "Tenant users can create incidents"
  ON public.incidents FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

CREATE POLICY "Tenant users can update incidents"
  ON public.incidents FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

CREATE POLICY "Tenant admins can delete incidents"
  ON public.incidents FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')));

-- Indexes
CREATE INDEX idx_sla_definitions_tenant ON public.sla_definitions(tenant_id);
CREATE INDEX idx_sla_measurements_sla ON public.sla_measurements(sla_id);
CREATE INDEX idx_incidents_tenant ON public.incidents(tenant_id);
CREATE INDEX idx_incidents_status ON public.incidents(tenant_id, status);
