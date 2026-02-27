
-- Step 4: Severance payments table
CREATE TABLE public.severance_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  reason TEXT NOT NULL DEFAULT 'redundancy' CHECK (reason IN ('retirement', 'redundancy', 'other')),
  years_of_service numeric NOT NULL DEFAULT 0,
  calculation_base numeric NOT NULL DEFAULT 0,
  multiplier numeric NOT NULL DEFAULT 0.333,
  total_amount numeric NOT NULL DEFAULT 0,
  payment_date DATE,
  gl_posted BOOLEAN NOT NULL DEFAULT false,
  journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.severance_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view severance_payments"
  ON public.severance_payments FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_members.tenant_id FROM tenant_members
    WHERE tenant_members.user_id = auth.uid() AND tenant_members.status = 'active'
  ));

CREATE POLICY "Tenant admins/hr can manage severance_payments"
  ON public.severance_payments FOR ALL
  USING (tenant_id IN (
    SELECT tenant_members.tenant_id FROM tenant_members
    WHERE tenant_members.user_id = auth.uid() AND tenant_members.status = 'active'
      AND tenant_members.role IN ('admin', 'hr')
  ));

-- Step 5: KEP entries table
CREATE TABLE public.kep_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  entry_number INT NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'receipt',
  document_number TEXT,
  description TEXT,
  goods_value numeric NOT NULL DEFAULT 0,
  services_value numeric NOT NULL DEFAULT 0,
  total_value numeric NOT NULL DEFAULT 0,
  payment_type TEXT NOT NULL DEFAULT 'cash' CHECK (payment_type IN ('cash', 'card', 'transfer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kep_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view kep_entries"
  ON public.kep_entries FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_members.tenant_id FROM tenant_members
    WHERE tenant_members.user_id = auth.uid() AND tenant_members.status = 'active'
  ));

CREATE POLICY "Tenant admins can manage kep_entries"
  ON public.kep_entries FOR ALL
  USING (tenant_id IN (
    SELECT tenant_members.tenant_id FROM tenant_members
    WHERE tenant_members.user_id = auth.uid() AND tenant_members.status = 'active'
      AND tenant_members.role IN ('admin', 'accountant')
  ));

CREATE UNIQUE INDEX idx_kep_entries_number ON kep_entries(tenant_id, location_id, entry_date, entry_number);
