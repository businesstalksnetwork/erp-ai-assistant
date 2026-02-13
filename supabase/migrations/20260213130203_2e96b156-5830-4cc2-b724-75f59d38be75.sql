
-- Migration 3: eBolovanje connections + claims + doznake
CREATE TABLE public.ebolovanje_connections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  euprava_username text,
  euprava_password_encrypted text,
  certificate_data text,
  environment text NOT NULL DEFAULT 'sandbox',
  is_active boolean NOT NULL DEFAULT false,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ebolovanje_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view ebolovanje connections"
  ON public.ebolovanje_connections FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE POLICY "Tenant admins can manage ebolovanje connections"
  ON public.ebolovanje_connections FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active' AND role = 'admin'));

CREATE TABLE public.ebolovanje_claims (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  legal_entity_id uuid REFERENCES public.legal_entities(id),
  claim_type text NOT NULL DEFAULT 'sick_leave',
  start_date date NOT NULL,
  end_date date NOT NULL,
  diagnosis_code text,
  doctor_name text,
  medical_facility text,
  rfzo_claim_number text,
  status text NOT NULL DEFAULT 'draft',
  submitted_at timestamptz,
  confirmed_at timestamptz,
  amount numeric DEFAULT 0,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ebolovanje_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view ebolovanje claims"
  ON public.ebolovanje_claims FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE POLICY "Tenant members can manage ebolovanje claims"
  ON public.ebolovanje_claims FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active' AND role IN ('admin', 'hr')));

CREATE TABLE public.ebolovanje_doznake (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  claim_id uuid NOT NULL REFERENCES public.ebolovanje_claims(id) ON DELETE CASCADE,
  doznaka_number text,
  issued_date date,
  valid_from date,
  valid_to date,
  rfzo_status text DEFAULT 'pending',
  response_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ebolovanje_doznake ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view doznake"
  ON public.ebolovanje_doznake FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE POLICY "Tenant admins can manage doznake"
  ON public.ebolovanje_doznake FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active' AND role IN ('admin', 'hr')));
