
CREATE TABLE public.payroll_pt_gl_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  payment_type_id UUID NOT NULL REFERENCES public.payroll_payment_types(id) ON DELETE CASCADE,
  legal_entity_id UUID NOT NULL REFERENCES public.legal_entities(id) ON DELETE CASCADE,
  gl_debit TEXT NOT NULL DEFAULT '',
  gl_credit TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, payment_type_id, legal_entity_id)
);

ALTER TABLE public.payroll_pt_gl_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.payroll_pt_gl_overrides
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE INDEX idx_pt_gl_overrides_tenant ON public.payroll_pt_gl_overrides(tenant_id);
CREATE INDEX idx_pt_gl_overrides_pt ON public.payroll_pt_gl_overrides(payment_type_id);
