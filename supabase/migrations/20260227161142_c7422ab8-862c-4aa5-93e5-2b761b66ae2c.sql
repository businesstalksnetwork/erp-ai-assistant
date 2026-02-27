
-- Onboarding checklists (templates)
CREATE TABLE public.onboarding_checklists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for onboarding_checklists"
  ON public.onboarding_checklists FOR ALL
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())))
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- Employee onboarding tasks (assignments)
CREATE TABLE public.employee_onboarding_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  checklist_id UUID NOT NULL REFERENCES public.onboarding_checklists(id) ON DELETE CASCADE,
  item_index INT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_onboarding_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for employee_onboarding_tasks"
  ON public.employee_onboarding_tasks FOR ALL
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())))
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE INDEX idx_employee_onboarding_tasks_employee ON public.employee_onboarding_tasks(employee_id);
CREATE INDEX idx_employee_onboarding_tasks_checklist ON public.employee_onboarding_tasks(checklist_id);

-- Payroll bank reconciliation
CREATE TABLE public.payroll_bank_reconciliation (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  payroll_run_id UUID NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  bank_statement_line_id UUID REFERENCES public.bank_statement_lines(id) ON DELETE SET NULL,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  expected_amount NUMERIC NOT NULL DEFAULT 0,
  matched_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'unmatched',
  matched_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payroll_bank_reconciliation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for payroll_bank_reconciliation"
  ON public.payroll_bank_reconciliation FOR ALL
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())))
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE INDEX idx_payroll_bank_recon_run ON public.payroll_bank_reconciliation(payroll_run_id);
CREATE INDEX idx_payroll_bank_recon_employee ON public.payroll_bank_reconciliation(employee_id);
