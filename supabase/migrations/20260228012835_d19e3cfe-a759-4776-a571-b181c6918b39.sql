
-- Service Contracts & SLA table
CREATE TABLE public.service_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  partner_id UUID REFERENCES public.partners(id),
  contract_number TEXT NOT NULL,
  title TEXT NOT NULL,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  sla_response_hours INTEGER DEFAULT 24,
  sla_resolution_hours INTEGER DEFAULT 72,
  contract_type TEXT NOT NULL DEFAULT 'standard',
  monthly_fee NUMERIC(12,2) DEFAULT 0,
  max_interventions INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.service_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for service_contracts"
  ON public.service_contracts FOR ALL
  USING (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid()));

CREATE INDEX idx_service_contracts_tenant ON public.service_contracts(tenant_id);
CREATE INDEX idx_service_contracts_partner ON public.service_contracts(partner_id);
