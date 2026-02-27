
-- #1: OD-O Reports table
CREATE TABLE public.od_o_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  legal_entity_id UUID REFERENCES public.legal_entities(id),
  period_year INTEGER NOT NULL,
  period_month INTEGER NOT NULL,
  income_type TEXT NOT NULL DEFAULT 'royalties',
  gross_amount NUMERIC NOT NULL DEFAULT 0,
  tax_base NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  pio_amount NUMERIC NOT NULL DEFAULT 0,
  health_amount NUMERIC NOT NULL DEFAULT 0,
  unemployment_amount NUMERIC NOT NULL DEFAULT 0,
  net_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  xml_data TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.od_o_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.od_o_reports FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE INDEX idx_od_o_reports_tenant ON public.od_o_reports(tenant_id);

-- #2: M4 Reports table
CREATE TABLE public.m4_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  legal_entity_id UUID REFERENCES public.legal_entities(id),
  report_year INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  generated_data JSONB,
  xml_data TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.m4_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.m4_reports FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE INDEX idx_m4_reports_tenant ON public.m4_reports(tenant_id);
