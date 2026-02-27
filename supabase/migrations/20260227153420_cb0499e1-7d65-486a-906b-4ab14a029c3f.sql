
-- IFRS 16: Lease modifications table
CREATE TABLE public.lease_modifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  lease_id UUID NOT NULL REFERENCES public.lease_contracts(id) ON DELETE CASCADE,
  modification_date DATE NOT NULL DEFAULT CURRENT_DATE,
  modification_type TEXT NOT NULL DEFAULT 'reassessment', -- reassessment, scope_change, term_change, payment_change
  new_monthly_payment NUMERIC,
  new_lease_term_months INTEGER,
  new_discount_rate NUMERIC,
  remaining_liability_before NUMERIC,
  remaining_rou_before NUMERIC,
  recalculated_liability NUMERIC,
  recalculated_rou NUMERIC,
  gain_loss_on_modification NUMERIC DEFAULT 0,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lease_modifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.lease_modifications
  FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE id = tenant_id));

-- Add short_term_exempt flag to lease_contracts
ALTER TABLE public.lease_contracts ADD COLUMN IF NOT EXISTS short_term_exempt BOOLEAN DEFAULT false;
ALTER TABLE public.lease_contracts ADD COLUMN IF NOT EXISTS low_value_exempt BOOLEAN DEFAULT false;

-- IFRS 15: Revenue contracts
CREATE TABLE public.revenue_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  contract_number TEXT NOT NULL,
  customer_name TEXT,
  customer_partner_id UUID REFERENCES public.partners(id),
  description TEXT,
  contract_date DATE NOT NULL DEFAULT CURRENT_DATE,
  start_date DATE NOT NULL,
  end_date DATE,
  total_transaction_price NUMERIC NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'RSD',
  status TEXT DEFAULT 'draft', -- draft, active, completed, cancelled
  step1_identification TEXT, -- notes on contract identification
  step2_obligations TEXT,    -- notes on PO identification
  step3_price_notes TEXT,    -- notes on transaction price determination
  step4_allocation_method TEXT DEFAULT 'standalone', -- standalone, residual, adjusted_market
  step5_recognition_method TEXT DEFAULT 'point_in_time', -- point_in_time, over_time_output, over_time_input, over_time_cost
  notes TEXT,
  legal_entity_id UUID REFERENCES public.legal_entities(id),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.revenue_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.revenue_contracts
  FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE id = tenant_id));

-- IFRS 15: Performance obligations
CREATE TABLE public.revenue_performance_obligations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  contract_id UUID NOT NULL REFERENCES public.revenue_contracts(id) ON DELETE CASCADE,
  obligation_number INTEGER NOT NULL DEFAULT 1,
  description TEXT NOT NULL,
  standalone_selling_price NUMERIC NOT NULL DEFAULT 0,
  allocated_price NUMERIC NOT NULL DEFAULT 0,
  recognition_method TEXT DEFAULT 'point_in_time', -- point_in_time, over_time_output, over_time_input, over_time_cost
  satisfaction_date DATE, -- for point-in-time
  start_date DATE,        -- for over-time
  end_date DATE,          -- for over-time
  percent_complete NUMERIC DEFAULT 0,
  total_cost_estimate NUMERIC DEFAULT 0,     -- for cost-to-cost %
  cost_incurred_to_date NUMERIC DEFAULT 0,   -- for cost-to-cost %
  revenue_recognized NUMERIC DEFAULT 0,
  deferred_revenue NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'unsatisfied', -- unsatisfied, partially_satisfied, satisfied
  gl_revenue_account TEXT DEFAULT '6010',
  gl_deferred_revenue_account TEXT DEFAULT '4600',
  gl_contract_asset_account TEXT DEFAULT '2050',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.revenue_performance_obligations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.revenue_performance_obligations
  FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE id = tenant_id));

-- IFRS 15: Revenue recognition journal entries log
CREATE TABLE public.revenue_recognition_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  obligation_id UUID NOT NULL REFERENCES public.revenue_performance_obligations(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  entry_type TEXT NOT NULL DEFAULT 'recognition', -- recognition, reversal, adjustment
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  percent_at_recognition NUMERIC,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.revenue_recognition_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.revenue_recognition_entries
  FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE id = tenant_id));
