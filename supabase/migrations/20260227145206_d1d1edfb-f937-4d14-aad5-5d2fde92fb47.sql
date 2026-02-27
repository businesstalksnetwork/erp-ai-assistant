
-- #6: Foreign Currency Cash Register (Devizna blagajna)
CREATE TABLE public.fx_cash_register (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entry_number TEXT NOT NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  currency TEXT NOT NULL DEFAULT 'EUR',
  amount NUMERIC(18,2) NOT NULL,
  exchange_rate NUMERIC(18,6) NOT NULL DEFAULT 1,
  amount_rsd NUMERIC(18,2) NOT NULL DEFAULT 0,
  description TEXT NOT NULL,
  document_ref TEXT,
  partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL,
  legal_entity_id UUID REFERENCES public.legal_entities(id) ON DELETE SET NULL,
  journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fx_cash_register ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.fx_cash_register FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE INDEX idx_fx_cash_register_tenant ON public.fx_cash_register(tenant_id, entry_date);

-- #14: Data Retention Policy Enforcement
CREATE TABLE public.data_retention_policies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  retention_years INT NOT NULL DEFAULT 10,
  action_type TEXT NOT NULL DEFAULT 'flag' CHECK (action_type IN ('flag', 'archive', 'anonymize')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, entity_type)
);

ALTER TABLE public.data_retention_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.data_retention_policies FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE TABLE public.data_retention_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action_taken TEXT NOT NULL,
  policy_id UUID REFERENCES public.data_retention_policies(id) ON DELETE SET NULL,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  executed_by UUID
);

ALTER TABLE public.data_retention_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.data_retention_log FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));

-- #15: Data Breach Notification
CREATE TABLE public.security_incidents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  incident_type TEXT NOT NULL DEFAULT 'unauthorized_access',
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  description TEXT,
  affected_records INT DEFAULT 0,
  affected_data_types TEXT[] DEFAULT '{}',
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notified_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  notification_deadline TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'detected' CHECK (status IN ('detected', 'investigating', 'notified', 'resolved', 'dismissed')),
  response_notes TEXT,
  reported_by UUID,
  assigned_to UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.security_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.security_incidents FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE INDEX idx_security_incidents_tenant ON public.security_incidents(tenant_id, status);
