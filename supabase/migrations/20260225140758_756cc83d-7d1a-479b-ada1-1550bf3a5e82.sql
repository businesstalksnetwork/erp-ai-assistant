
-- =====================================================
-- PHASE C: Intercompany, Withholding Tax, PDP support
-- =====================================================

-- 1. INTERCOMPANY TRANSACTIONS
CREATE TABLE public.intercompany_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  from_legal_entity_id UUID NOT NULL REFERENCES public.legal_entities(id),
  to_legal_entity_id UUID NOT NULL REFERENCES public.legal_entities(id),
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'RSD',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','posted','eliminated')),
  from_journal_entry_id UUID REFERENCES public.journal_entries(id),
  to_journal_entry_id UUID REFERENCES public.journal_entries(id),
  reference TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT different_entities CHECK (from_legal_entity_id <> to_legal_entity_id)
);
ALTER TABLE public.intercompany_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.intercompany_transactions FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));
CREATE INDEX idx_ic_tenant_date ON public.intercompany_transactions(tenant_id, transaction_date DESC);

-- 2. WITHHOLDING TAX
CREATE TABLE public.withholding_tax (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  legal_entity_id UUID REFERENCES public.legal_entities(id),
  supplier_invoice_id UUID REFERENCES public.supplier_invoices(id),
  partner_id UUID REFERENCES public.partners(id),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  gross_amount NUMERIC(15,2) NOT NULL,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 20.00,
  tax_amount NUMERIC(15,2) NOT NULL,
  net_amount NUMERIC(15,2) NOT NULL,
  income_type TEXT NOT NULL DEFAULT 'services',
  country_code TEXT,
  treaty_applied BOOLEAN NOT NULL DEFAULT false,
  treaty_rate NUMERIC(5,2),
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','calculated','paid','reported')),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.withholding_tax ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.withholding_tax FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));

-- 3. CIT TAX RETURN (PDP) SNAPSHOTS
CREATE TABLE public.cit_tax_returns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  legal_entity_id UUID REFERENCES public.legal_entities(id),
  fiscal_year INTEGER NOT NULL,
  total_revenue NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_expenses NUMERIC(15,2) NOT NULL DEFAULT 0,
  accounting_profit NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_adjustments_increase NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_adjustments_decrease NUMERIC(15,2) NOT NULL DEFAULT 0,
  taxable_base NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 15.00,
  tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_credits NUMERIC(15,2) NOT NULL DEFAULT 0,
  final_tax NUMERIC(15,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','calculated','submitted','accepted')),
  submitted_at TIMESTAMPTZ,
  notes TEXT,
  adjustment_details JSONB DEFAULT '[]'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, legal_entity_id, fiscal_year)
);
ALTER TABLE public.cit_tax_returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.cit_tax_returns FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));
