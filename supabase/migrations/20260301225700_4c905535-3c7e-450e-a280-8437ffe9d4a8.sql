
-- Phase 2A: HR Contract Templates
CREATE TABLE public.hr_contract_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template_type TEXT NOT NULL, -- permanent, fixed_term, amendment, service, copyright, internship, etc.
  content TEXT NOT NULL, -- Template body with {{variable}} placeholders
  variables JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of variable names
  legal_references TEXT[], -- e.g. ['Čl. 30 ZoR', 'Čl. 31 ZoR']
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hr_contract_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view hr_contract_templates"
  ON public.hr_contract_templates FOR SELECT
  USING (
    tenant_id IS NULL OR
    tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active')
  );
CREATE POLICY "Tenant members can insert hr_contract_templates"
  ON public.hr_contract_templates FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));
CREATE POLICY "Tenant members can update hr_contract_templates"
  ON public.hr_contract_templates FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));
CREATE POLICY "Tenant members can delete hr_contract_templates"
  ON public.hr_contract_templates FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active') AND is_system = false);

-- Phase 2B: Business Contract Templates
CREATE TABLE public.business_contract_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template_type TEXT NOT NULL, -- sales, purchase, lease, nda, cesija, loan, franchise, etc.
  content TEXT NOT NULL,
  variables JSONB NOT NULL DEFAULT '[]'::jsonb,
  legal_clauses TEXT[], -- auto-included Serbian legal clauses
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.business_contract_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view business_contract_templates"
  ON public.business_contract_templates FOR SELECT
  USING (
    tenant_id IS NULL OR
    tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active')
  );
CREATE POLICY "Tenant members can insert business_contract_templates"
  ON public.business_contract_templates FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));
CREATE POLICY "Tenant members can update business_contract_templates"
  ON public.business_contract_templates FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));
CREATE POLICY "Tenant members can delete business_contract_templates"
  ON public.business_contract_templates FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active') AND is_system = false);
