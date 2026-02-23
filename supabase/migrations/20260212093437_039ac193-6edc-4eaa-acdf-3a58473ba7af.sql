
-- Chart of Accounts (kontni plan)
CREATE TABLE public.chart_of_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  name_sr TEXT,
  account_type TEXT NOT NULL DEFAULT 'asset', -- asset, liability, equity, revenue, expense
  parent_id UUID REFERENCES public.chart_of_accounts(id),
  level INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_system BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, code)
);

ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view chart of accounts" ON public.chart_of_accounts
  FOR SELECT USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Super admins manage chart of accounts" ON public.chart_of_accounts
  FOR ALL USING (is_super_admin(auth.uid()));

CREATE POLICY "Tenant admins/accountants manage chart of accounts" ON public.chart_of_accounts
  FOR ALL USING (tenant_id IN (
    SELECT tenant_id FROM tenant_members
    WHERE user_id = auth.uid() AND role IN ('admin', 'accountant') AND status = 'active'
  ));

CREATE TRIGGER update_chart_of_accounts_updated_at
  BEFORE UPDATE ON public.chart_of_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Fiscal Periods
CREATE TABLE public.fiscal_periods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', -- open, closed, locked
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fiscal_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view fiscal periods" ON public.fiscal_periods
  FOR SELECT USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Super admins manage fiscal periods" ON public.fiscal_periods
  FOR ALL USING (is_super_admin(auth.uid()));

CREATE POLICY "Tenant admins/accountants manage fiscal periods" ON public.fiscal_periods
  FOR ALL USING (tenant_id IN (
    SELECT tenant_id FROM tenant_members
    WHERE user_id = auth.uid() AND role IN ('admin', 'accountant') AND status = 'active'
  ));

CREATE TRIGGER update_fiscal_periods_updated_at
  BEFORE UPDATE ON public.fiscal_periods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Journal Entries (glavna knjiga)
CREATE TABLE public.journal_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entry_number TEXT NOT NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  reference TEXT,
  fiscal_period_id UUID REFERENCES public.fiscal_periods(id),
  status TEXT NOT NULL DEFAULT 'draft', -- draft, posted, reversed
  posted_at TIMESTAMPTZ,
  posted_by UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, entry_number)
);

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view journal entries" ON public.journal_entries
  FOR SELECT USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Super admins manage journal entries" ON public.journal_entries
  FOR ALL USING (is_super_admin(auth.uid()));

CREATE POLICY "Tenant admins/accountants manage journal entries" ON public.journal_entries
  FOR ALL USING (tenant_id IN (
    SELECT tenant_id FROM tenant_members
    WHERE user_id = auth.uid() AND role IN ('admin', 'accountant') AND status = 'active'
  ));

CREATE TRIGGER update_journal_entries_updated_at
  BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Journal Lines (stavke naloga)
CREATE TABLE public.journal_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  journal_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.chart_of_accounts(id),
  description TEXT,
  debit NUMERIC(15,2) NOT NULL DEFAULT 0,
  credit NUMERIC(15,2) NOT NULL DEFAULT 0,
  cost_center_id UUID REFERENCES public.cost_centers(id),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view journal lines" ON public.journal_lines
  FOR SELECT USING (journal_entry_id IN (
    SELECT id FROM journal_entries WHERE tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
  ));

CREATE POLICY "Super admins manage journal lines" ON public.journal_lines
  FOR ALL USING (is_super_admin(auth.uid()));

CREATE POLICY "Tenant admins/accountants manage journal lines" ON public.journal_lines
  FOR ALL USING (journal_entry_id IN (
    SELECT je.id FROM journal_entries je
    JOIN tenant_members tm ON tm.tenant_id = je.tenant_id
    WHERE tm.user_id = auth.uid() AND tm.role IN ('admin', 'accountant') AND tm.status = 'active'
  ));

-- Indexes
CREATE INDEX idx_coa_tenant ON public.chart_of_accounts(tenant_id);
CREATE INDEX idx_coa_parent ON public.chart_of_accounts(parent_id);
CREATE INDEX idx_journal_entries_tenant ON public.journal_entries(tenant_id);
CREATE INDEX idx_journal_entries_date ON public.journal_entries(entry_date);
CREATE INDEX idx_journal_lines_entry ON public.journal_lines(journal_entry_id);
CREATE INDEX idx_journal_lines_account ON public.journal_lines(account_id);
CREATE INDEX idx_fiscal_periods_tenant ON public.fiscal_periods(tenant_id);
