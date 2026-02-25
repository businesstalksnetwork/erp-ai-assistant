
-- CASH REGISTER (BLAGAJNA) - Petty cash book
CREATE TABLE public.cash_register (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  legal_entity_id UUID REFERENCES public.legal_entities(id),
  entry_number TEXT NOT NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  direction TEXT NOT NULL CHECK (direction IN ('in','out')),
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  partner_id UUID REFERENCES public.partners(id),
  document_ref TEXT,
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, entry_number)
);
ALTER TABLE public.cash_register ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.cash_register FOR ALL 
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE INDEX idx_cash_register_tenant_date ON public.cash_register(tenant_id, entry_date DESC);
