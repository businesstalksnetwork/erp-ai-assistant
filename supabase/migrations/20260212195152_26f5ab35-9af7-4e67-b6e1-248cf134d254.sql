
-- Phase 25B: Comprehensive HR Module Overhaul

-- 1.2 Position templates
CREATE TABLE public.position_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.position_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.position_templates FOR ALL USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- 1.3 Department positions junction
CREATE TABLE public.department_positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  position_template_id UUID NOT NULL REFERENCES public.position_templates(id) ON DELETE CASCADE,
  headcount INT NOT NULL DEFAULT 1,
  UNIQUE (department_id, position_template_id)
);
ALTER TABLE public.department_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.department_positions FOR ALL USING (
  department_id IN (SELECT id FROM public.departments WHERE tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())))
);

-- 1.1 ALTER employees
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS hire_date DATE,
  ADD COLUMN IF NOT EXISTS termination_date DATE,
  ADD COLUMN IF NOT EXISTS early_termination_date DATE,
  ADD COLUMN IF NOT EXISTS annual_leave_days INT NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS slava_date DATE,
  ADD COLUMN IF NOT EXISTS daily_work_hours NUMERIC NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS position_template_id UUID REFERENCES public.position_templates(id),
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.legal_entities(id);

-- Populate first_name/last_name from full_name
UPDATE public.employees SET
  first_name = split_part(full_name, ' ', 1),
  last_name = CASE WHEN position(' ' in full_name) > 0 THEN substring(full_name from position(' ' in full_name) + 1) ELSE '' END,
  hire_date = start_date
WHERE first_name IS NULL;

-- 1.4 ALTER departments
ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.legal_entities(id);

-- 1.5 Work logs
CREATE TABLE public.work_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  date DATE NOT NULL,
  type TEXT NOT NULL DEFAULT 'workday',
  hours NUMERIC NOT NULL DEFAULT 8,
  note TEXT,
  vacation_year INT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, date)
);
ALTER TABLE public.work_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.work_logs FOR ALL USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- 1.6 Overtime hours
CREATE TABLE public.overtime_hours (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  year INT NOT NULL,
  month INT NOT NULL,
  hours NUMERIC NOT NULL DEFAULT 0,
  tracking_type TEXT NOT NULL DEFAULT 'monthly',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, year, month)
);
ALTER TABLE public.overtime_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.overtime_hours FOR ALL USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- 1.7 Overtime daily entries
CREATE TABLE public.overtime_daily_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  date DATE NOT NULL,
  hours NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.overtime_daily_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.overtime_daily_entries FOR ALL USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- 1.8 Night work hours + daily
CREATE TABLE public.night_work_hours (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  year INT NOT NULL,
  month INT NOT NULL,
  hours NUMERIC NOT NULL DEFAULT 0,
  tracking_type TEXT NOT NULL DEFAULT 'monthly',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, year, month)
);
ALTER TABLE public.night_work_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.night_work_hours FOR ALL USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE TABLE public.night_work_daily_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  date DATE NOT NULL,
  hours NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.night_work_daily_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.night_work_daily_entries FOR ALL USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- 1.9 Annual leave balances
CREATE TABLE public.annual_leave_balances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  year INT NOT NULL,
  entitled_days NUMERIC NOT NULL DEFAULT 20,
  used_days NUMERIC NOT NULL DEFAULT 0,
  carried_over_days NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, year)
);
ALTER TABLE public.annual_leave_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.annual_leave_balances FOR ALL USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- 1.10 Holidays
CREATE TABLE public.holidays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id),
  company_id UUID REFERENCES public.legal_entities(id),
  name TEXT NOT NULL,
  date DATE NOT NULL,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant or national" ON public.holidays FOR ALL USING (
  tenant_id IS NULL OR tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
);

-- Seed Serbian national holidays 2025-2027
INSERT INTO public.holidays (tenant_id, name, date, is_recurring) VALUES
  (NULL, 'Nova Godina', '2025-01-01', false), (NULL, 'Nova Godina', '2025-01-02', false),
  (NULL, 'Božić', '2025-01-07', false),
  (NULL, 'Sretenje', '2025-02-15', false), (NULL, 'Sretenje', '2025-02-16', false),
  (NULL, 'Praznik Rada', '2025-05-01', false), (NULL, 'Praznik Rada', '2025-05-02', false),
  (NULL, 'Dan Primirja', '2025-11-11', false),
  (NULL, 'Veliki Petak', '2025-04-18', false), (NULL, 'Uskrs', '2025-04-20', false), (NULL, 'Uskršnji Ponedeljak', '2025-04-21', false),
  (NULL, 'Nova Godina', '2026-01-01', false), (NULL, 'Nova Godina', '2026-01-02', false),
  (NULL, 'Božić', '2026-01-07', false),
  (NULL, 'Sretenje', '2026-02-15', false), (NULL, 'Sretenje', '2026-02-16', false),
  (NULL, 'Praznik Rada', '2026-05-01', false), (NULL, 'Praznik Rada', '2026-05-02', false),
  (NULL, 'Dan Primirja', '2026-11-11', false),
  (NULL, 'Veliki Petak', '2026-04-10', false), (NULL, 'Uskrs', '2026-04-12', false), (NULL, 'Uskršnji Ponedeljak', '2026-04-13', false),
  (NULL, 'Nova Godina', '2027-01-01', false), (NULL, 'Nova Godina', '2027-01-02', false),
  (NULL, 'Božić', '2027-01-07', false),
  (NULL, 'Sretenje', '2027-02-15', false), (NULL, 'Sretenje', '2027-02-16', false),
  (NULL, 'Praznik Rada', '2027-05-01', false), (NULL, 'Praznik Rada', '2027-05-02', false),
  (NULL, 'Dan Primirja', '2027-11-11', false),
  (NULL, 'Veliki Petak', '2027-03-26', false), (NULL, 'Uskrs', '2027-03-28', false), (NULL, 'Uskršnji Ponedeljak', '2027-03-29', false);

-- 1.11 Deductions + payments
CREATE TABLE public.deductions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  type TEXT NOT NULL DEFAULT 'other',
  description TEXT NOT NULL DEFAULT '',
  total_amount NUMERIC NOT NULL DEFAULT 0,
  paid_amount NUMERIC NOT NULL DEFAULT 0,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.deductions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.deductions FOR ALL USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE TABLE public.deduction_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deduction_id UUID NOT NULL REFERENCES public.deductions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  amount NUMERIC NOT NULL DEFAULT 0,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  month INT NOT NULL,
  year INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.deduction_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.deduction_payments FOR ALL USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- 1.12 Allowance types + allowances
CREATE TABLE public.allowance_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true
);
ALTER TABLE public.allowance_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant or system" ON public.allowance_types FOR ALL USING (
  tenant_id IS NULL OR tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
);

CREATE TABLE public.allowances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  allowance_type_id UUID NOT NULL REFERENCES public.allowance_types(id),
  amount NUMERIC NOT NULL DEFAULT 0,
  month INT NOT NULL,
  year INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, allowance_type_id, month, year)
);
ALTER TABLE public.allowances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.allowances FOR ALL USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- 1.13 External work
CREATE TABLE public.external_work_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  code TEXT NOT NULL
);
ALTER TABLE public.external_work_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant or system" ON public.external_work_types FOR ALL USING (
  tenant_id IS NULL OR tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
);

CREATE TABLE public.engaged_persons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  jmbg TEXT NOT NULL,
  contract_expiry DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.engaged_persons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.engaged_persons FOR ALL USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE TABLE public.external_work_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  person_id UUID NOT NULL REFERENCES public.engaged_persons(id) ON DELETE CASCADE,
  work_type_id UUID NOT NULL REFERENCES public.external_work_types(id),
  amount NUMERIC NOT NULL DEFAULT 0,
  month INT NOT NULL,
  year INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.external_work_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.external_work_payments FOR ALL USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- 1.14 Employee salaries
CREATE TABLE public.employee_salaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  amount NUMERIC NOT NULL DEFAULT 0,
  salary_type TEXT NOT NULL DEFAULT 'monthly',
  amount_type TEXT NOT NULL DEFAULT 'gross',
  meal_allowance NUMERIC NOT NULL DEFAULT 0,
  regres NUMERIC NOT NULL DEFAULT 0,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.employee_salaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.employee_salaries FOR ALL USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- 1.15 Insurance records
CREATE TABLE public.insurance_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  middle_name TEXT,
  jmbg TEXT NOT NULL,
  lbo TEXT,
  insurance_start DATE NOT NULL,
  insurance_end DATE,
  registration_date DATE NOT NULL DEFAULT CURRENT_DATE,
  employee_id UUID REFERENCES public.employees(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, jmbg)
);
ALTER TABLE public.insurance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.insurance_records FOR ALL USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- 1.16 ALTER payroll_items
ALTER TABLE public.payroll_items
  ADD COLUMN IF NOT EXISTS leave_days_deducted NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS leave_deduction_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS working_days NUMERIC NOT NULL DEFAULT 22,
  ADD COLUMN IF NOT EXISTS actual_working_days NUMERIC NOT NULL DEFAULT 22,
  ADD COLUMN IF NOT EXISTS dlp_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overtime_hours_count NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS night_work_hours_count NUMERIC NOT NULL DEFAULT 0;

-- 1.17 ALTER leave_requests
ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS vacation_year INT;

-- Triggers for updated_at
CREATE TRIGGER update_annual_leave_balances_updated_at BEFORE UPDATE ON public.annual_leave_balances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
