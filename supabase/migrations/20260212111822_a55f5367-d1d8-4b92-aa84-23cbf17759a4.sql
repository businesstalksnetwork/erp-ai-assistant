
-- =============================================
-- Phase 9: Advanced Accounting & Compliance
-- =============================================

-- Group A: Fixed Assets & Depreciation

CREATE TABLE public.fixed_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  description TEXT,
  acquisition_date DATE NOT NULL DEFAULT CURRENT_DATE,
  acquisition_cost NUMERIC NOT NULL DEFAULT 0,
  useful_life_months INTEGER NOT NULL DEFAULT 60,
  depreciation_method TEXT NOT NULL DEFAULT 'straight_line' CHECK (depreciation_method IN ('straight_line', 'declining')),
  salvage_value NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disposed', 'fully_depreciated')),
  account_id UUID REFERENCES public.chart_of_accounts(id),
  disposed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fixed_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.fixed_assets FOR ALL USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE TRIGGER update_fixed_assets_updated_at BEFORE UPDATE ON public.fixed_assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER audit_fixed_assets AFTER INSERT OR UPDATE OR DELETE ON public.fixed_assets FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

CREATE TABLE public.fixed_asset_depreciation (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES public.fixed_assets(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  period DATE NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  accumulated_total NUMERIC NOT NULL DEFAULT 0,
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fixed_asset_depreciation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.fixed_asset_depreciation FOR ALL USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- Group B: AR/AP Aging & Bad Debt

CREATE TABLE public.ar_aging_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  snapshot_date DATE NOT NULL,
  partner_id UUID REFERENCES public.partners(id),
  bucket_current NUMERIC NOT NULL DEFAULT 0,
  bucket_30 NUMERIC NOT NULL DEFAULT 0,
  bucket_60 NUMERIC NOT NULL DEFAULT 0,
  bucket_90 NUMERIC NOT NULL DEFAULT 0,
  bucket_over90 NUMERIC NOT NULL DEFAULT 0,
  total_outstanding NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ar_aging_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.ar_aging_snapshots FOR ALL USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE TABLE public.ap_aging_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  snapshot_date DATE NOT NULL,
  partner_id UUID REFERENCES public.partners(id),
  bucket_current NUMERIC NOT NULL DEFAULT 0,
  bucket_30 NUMERIC NOT NULL DEFAULT 0,
  bucket_60 NUMERIC NOT NULL DEFAULT 0,
  bucket_90 NUMERIC NOT NULL DEFAULT 0,
  bucket_over90 NUMERIC NOT NULL DEFAULT 0,
  total_outstanding NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ap_aging_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.ap_aging_snapshots FOR ALL USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE TABLE public.bad_debt_provisions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  partner_id UUID REFERENCES public.partners(id),
  provision_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC NOT NULL DEFAULT 0,
  reason TEXT,
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'reversed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bad_debt_provisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.bad_debt_provisions FOR ALL USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE TRIGGER update_bad_debt_provisions_updated_at BEFORE UPDATE ON public.bad_debt_provisions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Group C: Deferrals & Accruals

CREATE TABLE public.deferrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  type TEXT NOT NULL CHECK (type IN ('revenue', 'expense')),
  description TEXT,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  recognized_amount NUMERIC NOT NULL DEFAULT 0,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('monthly')),
  source_invoice_id UUID REFERENCES public.invoices(id),
  account_id UUID REFERENCES public.chart_of_accounts(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.deferrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.deferrals FOR ALL USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE TRIGGER update_deferrals_updated_at BEFORE UPDATE ON public.deferrals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER audit_deferrals AFTER INSERT OR UPDATE OR DELETE ON public.deferrals FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

CREATE TABLE public.deferral_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deferral_id UUID NOT NULL REFERENCES public.deferrals(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  period_date DATE NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'posted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.deferral_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.deferral_schedules FOR ALL USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- Group D: Loans & Installments

CREATE TABLE public.loans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  partner_id UUID REFERENCES public.partners(id),
  type TEXT NOT NULL CHECK (type IN ('receivable', 'payable')),
  description TEXT,
  principal NUMERIC NOT NULL DEFAULT 0,
  interest_rate NUMERIC NOT NULL DEFAULT 0,
  start_date DATE NOT NULL,
  term_months INTEGER NOT NULL DEFAULT 12,
  currency TEXT NOT NULL DEFAULT 'RSD',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'defaulted', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.loans FOR ALL USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE TRIGGER update_loans_updated_at BEFORE UPDATE ON public.loans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER audit_loans AFTER INSERT OR UPDATE OR DELETE ON public.loans FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

CREATE TABLE public.loan_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  due_date DATE NOT NULL,
  principal_payment NUMERIC NOT NULL DEFAULT 0,
  interest_payment NUMERIC NOT NULL DEFAULT 0,
  balance NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.loan_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.loan_schedules FOR ALL USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- Group E: Approval Workflows & SOD

CREATE TABLE public.approval_workflows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('invoice', 'journal_entry', 'purchase_order', 'payroll_run')),
  min_approvers INTEGER NOT NULL DEFAULT 1,
  required_roles TEXT[] NOT NULL DEFAULT '{}',
  threshold_amount NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.approval_workflows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.approval_workflows FOR ALL USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE TRIGGER update_approval_workflows_updated_at BEFORE UPDATE ON public.approval_workflows FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.approval_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  workflow_id UUID NOT NULL REFERENCES public.approval_workflows(id),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.approval_requests FOR ALL USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE TRIGGER update_approval_requests_updated_at BEFORE UPDATE ON public.approval_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.approval_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.approval_requests(id) ON DELETE CASCADE,
  approver_user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL CHECK (action IN ('approve', 'reject')),
  comment TEXT,
  acted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS for approval_steps: accessible if user can see the parent request's tenant
ALTER TABLE public.approval_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.approval_steps FOR ALL USING (
  EXISTS (SELECT 1 FROM public.approval_requests ar WHERE ar.id = request_id AND ar.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())))
);

-- Group F: Currencies & Exchange Rates

CREATE TABLE public.currencies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  symbol TEXT,
  is_base BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, code)
);

ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.currencies FOR ALL USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE TABLE public.exchange_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  from_currency TEXT NOT NULL,
  to_currency TEXT NOT NULL,
  rate NUMERIC NOT NULL,
  rate_date DATE NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'nbs')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.exchange_rates FOR ALL USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- Event bus subscriptions for Phase 9
INSERT INTO public.module_event_subscriptions (event_type, handler_module, handler_function, is_active) VALUES
  ('fixed_asset.depreciated', 'accounting', 'post_depreciation_entry', true),
  ('deferral.recognized', 'accounting', 'post_deferral_recognition', true),
  ('loan_payment.due', 'notifications', 'notify_loan_payment', true),
  ('approval.completed', 'workflow', 'update_entity_approval_status', true)
ON CONFLICT DO NOTHING;
