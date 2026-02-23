
-- =============================================
-- Step 2: PDPA (Serbian GDPR) Compliance Module
-- Tables: data_subject_requests, consent_records
-- Columns: data_retention_expiry on contacts and employees
-- =============================================

-- Data Subject Requests table
CREATE TABLE public.data_subject_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  request_type TEXT NOT NULL CHECK (request_type IN ('access', 'erasure', 'portability', 'rectification')),
  subject_type TEXT NOT NULL CHECK (subject_type IN ('employee', 'contact', 'lead')),
  subject_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  requested_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.data_subject_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view data subject requests"
  ON public.data_subject_requests FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE POLICY "Tenant members can insert data subject requests"
  ON public.data_subject_requests FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE POLICY "Tenant members can update data subject requests"
  ON public.data_subject_requests FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));

-- Consent Records table
CREATE TABLE public.consent_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  subject_type TEXT NOT NULL CHECK (subject_type IN ('employee', 'contact', 'lead')),
  subject_id UUID NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('marketing', 'analytics', 'processing')),
  consented_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  withdrawn_at TIMESTAMP WITH TIME ZONE,
  legal_basis TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view consent records"
  ON public.consent_records FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE POLICY "Tenant members can insert consent records"
  ON public.consent_records FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE POLICY "Tenant members can update consent records"
  ON public.consent_records FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));

-- Add data_retention_expiry to contacts and employees
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS data_retention_expiry DATE;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS data_retention_expiry DATE;

-- Add anonymized_at to contacts and employees for tracking anonymization
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMP WITH TIME ZONE;

-- Indexes
CREATE INDEX idx_data_subject_requests_tenant ON public.data_subject_requests(tenant_id);
CREATE INDEX idx_data_subject_requests_status ON public.data_subject_requests(tenant_id, status);
CREATE INDEX idx_consent_records_tenant ON public.consent_records(tenant_id);
CREATE INDEX idx_consent_records_subject ON public.consent_records(tenant_id, subject_type, subject_id);
