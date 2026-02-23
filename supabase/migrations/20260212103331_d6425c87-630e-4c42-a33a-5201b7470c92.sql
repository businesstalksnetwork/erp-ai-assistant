
-- =============================================
-- Phase 5: HR & Payroll Tables
-- =============================================

-- Employee status enum
CREATE TYPE public.employee_status AS ENUM ('active', 'inactive', 'terminated');
CREATE TYPE public.employment_type AS ENUM ('full_time', 'part_time', 'contract', 'intern');
CREATE TYPE public.leave_type AS ENUM ('vacation', 'sick', 'personal', 'maternity', 'paternity', 'unpaid');
CREATE TYPE public.leave_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
CREATE TYPE public.attendance_status AS ENUM ('present', 'absent', 'sick', 'vacation', 'holiday', 'remote');
CREATE TYPE public.payroll_status AS ENUM ('draft', 'calculated', 'approved', 'paid');

-- 1. Departments
CREATE TABLE public.departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  manager_employee_id UUID, -- set after employees table exists
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, code)
);

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view departments" ON public.departments FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant admins/hr manage departments" ON public.departments FOR ALL
  USING (tenant_id IN (SELECT tm.tenant_id FROM tenant_members tm WHERE tm.user_id = auth.uid() AND tm.role IN ('admin', 'hr') AND tm.status = 'active'));
CREATE POLICY "Super admins manage departments" ON public.departments FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Employees
CREATE TABLE public.employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID, -- optional link to auth user
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  jmbg TEXT, -- Serbian unique citizen number
  address TEXT,
  city TEXT,
  position TEXT,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  employment_type public.employment_type NOT NULL DEFAULT 'full_time',
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  status public.employee_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view employees" ON public.employees FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant admins/hr manage employees" ON public.employees FOR ALL
  USING (tenant_id IN (SELECT tm.tenant_id FROM tenant_members tm WHERE tm.user_id = auth.uid() AND tm.role IN ('admin', 'hr') AND tm.status = 'active'));
CREATE POLICY "Super admins manage employees" ON public.employees FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add FK from departments.manager_employee_id to employees
ALTER TABLE public.departments ADD CONSTRAINT departments_manager_employee_id_fkey
  FOREIGN KEY (manager_employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;

-- 3. Employee Contracts
CREATE TABLE public.employee_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  contract_type TEXT NOT NULL DEFAULT 'indefinite', -- indefinite, fixed_term, temporary
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  gross_salary NUMERIC NOT NULL DEFAULT 0,
  net_salary NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'RSD',
  working_hours_per_week NUMERIC NOT NULL DEFAULT 40,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view contracts" ON public.employee_contracts FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant admins/hr manage contracts" ON public.employee_contracts FOR ALL
  USING (tenant_id IN (SELECT tm.tenant_id FROM tenant_members tm WHERE tm.user_id = auth.uid() AND tm.role IN ('admin', 'hr') AND tm.status = 'active'));
CREATE POLICY "Super admins manage contracts" ON public.employee_contracts FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE TRIGGER update_employee_contracts_updated_at BEFORE UPDATE ON public.employee_contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Attendance Records
CREATE TABLE public.attendance_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  check_in TIME,
  check_out TIME,
  hours_worked NUMERIC DEFAULT 0,
  status public.attendance_status NOT NULL DEFAULT 'present',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, date)
);

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view attendance" ON public.attendance_records FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant admins/hr manage attendance" ON public.attendance_records FOR ALL
  USING (tenant_id IN (SELECT tm.tenant_id FROM tenant_members tm WHERE tm.user_id = auth.uid() AND tm.role IN ('admin', 'hr') AND tm.status = 'active'));
CREATE POLICY "Super admins manage attendance" ON public.attendance_records FOR ALL
  USING (is_super_admin(auth.uid()));

-- 5. Leave Requests
CREATE TABLE public.leave_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type public.leave_type NOT NULL DEFAULT 'vacation',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_count INTEGER NOT NULL DEFAULT 1,
  reason TEXT,
  status public.leave_status NOT NULL DEFAULT 'pending',
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view leave requests" ON public.leave_requests FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant admins/hr manage leave requests" ON public.leave_requests FOR ALL
  USING (tenant_id IN (SELECT tm.tenant_id FROM tenant_members tm WHERE tm.user_id = auth.uid() AND tm.role IN ('admin', 'hr') AND tm.status = 'active'));
CREATE POLICY "Super admins manage leave requests" ON public.leave_requests FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE TRIGGER update_leave_requests_updated_at BEFORE UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Payroll Runs
CREATE TABLE public.payroll_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year INTEGER NOT NULL,
  status public.payroll_status NOT NULL DEFAULT 'draft',
  total_gross NUMERIC NOT NULL DEFAULT 0,
  total_net NUMERIC NOT NULL DEFAULT 0,
  total_taxes NUMERIC NOT NULL DEFAULT 0,
  total_contributions NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, period_month, period_year)
);

ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view payroll runs" ON public.payroll_runs FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant admins/hr manage payroll runs" ON public.payroll_runs FOR ALL
  USING (tenant_id IN (SELECT tm.tenant_id FROM tenant_members tm WHERE tm.user_id = auth.uid() AND tm.role IN ('admin', 'hr') AND tm.status = 'active'));
CREATE POLICY "Super admins manage payroll runs" ON public.payroll_runs FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE TRIGGER update_payroll_runs_updated_at BEFORE UPDATE ON public.payroll_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Payroll Items (individual employee lines)
CREATE TABLE public.payroll_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payroll_run_id UUID NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  gross_salary NUMERIC NOT NULL DEFAULT 0,
  taxable_base NUMERIC NOT NULL DEFAULT 0,
  income_tax NUMERIC NOT NULL DEFAULT 0,       -- 10%
  pension_contribution NUMERIC NOT NULL DEFAULT 0,  -- 25.5% (14% employee + 11.5% employer)
  health_contribution NUMERIC NOT NULL DEFAULT 0,   -- 10.3% (5.15% + 5.15%)
  unemployment_contribution NUMERIC NOT NULL DEFAULT 0, -- 0.75%
  net_salary NUMERIC NOT NULL DEFAULT 0,
  total_cost NUMERIC NOT NULL DEFAULT 0, -- total employer cost
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payroll_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view payroll items" ON public.payroll_items FOR SELECT
  USING (payroll_run_id IN (SELECT pr.id FROM payroll_runs pr WHERE pr.tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))));
CREATE POLICY "Tenant admins/hr manage payroll items" ON public.payroll_items FOR ALL
  USING (payroll_run_id IN (SELECT pr.id FROM payroll_runs pr JOIN tenant_members tm ON tm.tenant_id = pr.tenant_id WHERE tm.user_id = auth.uid() AND tm.role IN ('admin', 'hr') AND tm.status = 'active'));
CREATE POLICY "Super admins manage payroll items" ON public.payroll_items FOR ALL
  USING (is_super_admin(auth.uid()));

-- Audit triggers for key HR tables
CREATE TRIGGER audit_employees AFTER INSERT OR UPDATE OR DELETE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_payroll_runs AFTER INSERT OR UPDATE OR DELETE ON public.payroll_runs
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Serbian payroll calculation function
CREATE OR REPLACE FUNCTION public.calculate_payroll_for_run(p_payroll_run_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run RECORD;
  v_emp RECORD;
  v_contract RECORD;
  v_gross NUMERIC;
  v_nontaxable NUMERIC := 25000; -- Serbian non-taxable amount (approximate)
  v_taxable NUMERIC;
  v_income_tax NUMERIC;
  v_pension NUMERIC;
  v_health NUMERIC;
  v_unemployment NUMERIC;
  v_net NUMERIC;
  v_total_cost NUMERIC;
  v_sum_gross NUMERIC := 0;
  v_sum_net NUMERIC := 0;
  v_sum_taxes NUMERIC := 0;
  v_sum_contributions NUMERIC := 0;
BEGIN
  SELECT * INTO v_run FROM payroll_runs WHERE id = p_payroll_run_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payroll run not found'; END IF;

  -- Clear existing items
  DELETE FROM payroll_items WHERE payroll_run_id = p_payroll_run_id;

  FOR v_emp IN
    SELECT e.* FROM employees e WHERE e.tenant_id = v_run.tenant_id AND e.status = 'active'
  LOOP
    -- Get active contract
    SELECT * INTO v_contract FROM employee_contracts
      WHERE employee_id = v_emp.id AND is_active = true
      ORDER BY start_date DESC LIMIT 1;

    IF v_contract IS NULL THEN CONTINUE; END IF;

    v_gross := v_contract.gross_salary;

    -- Employee contributions (from gross)
    v_pension := ROUND(v_gross * 0.14, 2);     -- 14% employee pension
    v_health := ROUND(v_gross * 0.0515, 2);    -- 5.15% employee health
    v_unemployment := ROUND(v_gross * 0.0075, 2); -- 0.75% unemployment

    -- Taxable base = gross - employee contributions - non-taxable
    v_taxable := GREATEST(v_gross - v_pension - v_health - v_unemployment - v_nontaxable, 0);
    v_income_tax := ROUND(v_taxable * 0.10, 2); -- 10% income tax

    -- Net = gross - employee contributions - income tax
    v_net := v_gross - v_pension - v_health - v_unemployment - v_income_tax;

    -- Employer contributions (additional cost)
    -- Employer pension: 11.5%, health: 5.15%
    v_total_cost := v_gross + ROUND(v_gross * 0.115, 2) + ROUND(v_gross * 0.0515, 2);

    INSERT INTO payroll_items (payroll_run_id, employee_id, gross_salary, taxable_base, income_tax, pension_contribution, health_contribution, unemployment_contribution, net_salary, total_cost)
    VALUES (p_payroll_run_id, v_emp.id, v_gross, v_taxable, v_income_tax, v_pension, v_health, v_unemployment, v_net, v_total_cost);

    v_sum_gross := v_sum_gross + v_gross;
    v_sum_net := v_sum_net + v_net;
    v_sum_taxes := v_sum_taxes + v_income_tax;
    v_sum_contributions := v_sum_contributions + v_pension + v_health + v_unemployment;
  END LOOP;

  UPDATE payroll_runs SET
    status = 'calculated',
    total_gross = v_sum_gross,
    total_net = v_sum_net,
    total_taxes = v_sum_taxes,
    total_contributions = v_sum_contributions,
    updated_at = now()
  WHERE id = p_payroll_run_id;
END;
$$;
