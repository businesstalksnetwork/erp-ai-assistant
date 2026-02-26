
-- =============================================
-- Phase 6: IFRS 16 Lease Accounting Tables
-- =============================================

-- 1. Lease Contracts (lessee perspective)
CREATE TABLE public.lease_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  asset_id UUID REFERENCES public.assets(id),
  legal_entity_id UUID REFERENCES public.legal_entities(id),
  contract_number TEXT NOT NULL,
  lessor_name TEXT,
  lessor_partner_id UUID REFERENCES public.partners(id),
  description TEXT,
  -- Lease terms
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  lease_term_months INTEGER NOT NULL,
  -- Financial
  currency TEXT DEFAULT 'RSD',
  monthly_payment NUMERIC(15,2) NOT NULL,
  annual_discount_rate NUMERIC(8,6) NOT NULL DEFAULT 0.05, -- e.g. 5% = 0.05
  initial_rou_value NUMERIC(15,2) NOT NULL DEFAULT 0,
  initial_liability NUMERIC(15,2) NOT NULL DEFAULT 0,
  residual_value_guarantee NUMERIC(15,2) DEFAULT 0,
  -- Current balances (updated monthly)
  rou_net_book_value NUMERIC(15,2) DEFAULT 0,
  lease_liability_balance NUMERIC(15,2) DEFAULT 0,
  -- GL accounts
  rou_asset_account TEXT, -- e.g. 0140
  rou_depreciation_account TEXT, -- e.g. 5420
  rou_accumulated_dep_account TEXT, -- e.g. 0149
  liability_account TEXT, -- e.g. 4140
  interest_expense_account TEXT, -- e.g. 5620
  -- Status
  status TEXT DEFAULT 'active', -- draft, active, expired, terminated
  classification TEXT DEFAULT 'operating', -- operating, finance
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lease_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.lease_contracts
  FOR ALL USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE INDEX idx_lease_contracts_tenant ON public.lease_contracts(tenant_id, status);
CREATE INDEX idx_lease_contracts_asset ON public.lease_contracts(asset_id);

-- 2. Lease Payment Schedule (amortization table)
CREATE TABLE public.lease_payment_schedule (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lease_id UUID NOT NULL REFERENCES public.lease_contracts(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  period_number INTEGER NOT NULL,
  payment_date DATE NOT NULL,
  -- Breakdown
  payment_amount NUMERIC(15,2) NOT NULL,
  interest_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  principal_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  rou_depreciation NUMERIC(15,2) NOT NULL DEFAULT 0,
  -- Balances after this period
  liability_balance_after NUMERIC(15,2) NOT NULL DEFAULT 0,
  rou_nbv_after NUMERIC(15,2) NOT NULL DEFAULT 0,
  -- Posting
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  posted_at TIMESTAMPTZ,
  status TEXT DEFAULT 'scheduled', -- scheduled, posted, skipped
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lease_payment_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.lease_payment_schedule
  FOR ALL USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE INDEX idx_lease_schedule_lease ON public.lease_payment_schedule(lease_id, period_number);

-- Triggers
CREATE TRIGGER update_lease_contracts_updated_at BEFORE UPDATE ON public.lease_contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
