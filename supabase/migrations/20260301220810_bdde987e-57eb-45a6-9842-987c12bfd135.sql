
-- HR-6: Education, Certifications, Trainings
CREATE TABLE public.employee_education (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  degree TEXT NOT NULL,
  field_of_study TEXT,
  institution TEXT NOT NULL,
  graduation_year INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.employee_education ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members can view employee education" ON public.employee_education FOR SELECT USING (
  tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active')
);
CREATE POLICY "Tenant members can insert employee education" ON public.employee_education FOR INSERT WITH CHECK (
  tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active')
);
CREATE POLICY "Tenant members can update employee education" ON public.employee_education FOR UPDATE USING (
  tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active')
);
CREATE POLICY "Tenant members can delete employee education" ON public.employee_education FOR DELETE USING (
  tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active')
);

CREATE TABLE public.employee_certifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  issuer TEXT,
  issue_date DATE,
  expiry_date DATE,
  credential_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.employee_certifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members can view employee certifications" ON public.employee_certifications FOR SELECT USING (
  tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active')
);
CREATE POLICY "Tenant members can insert employee certifications" ON public.employee_certifications FOR INSERT WITH CHECK (
  tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active')
);
CREATE POLICY "Tenant members can update employee certifications" ON public.employee_certifications FOR UPDATE USING (
  tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active')
);
CREATE POLICY "Tenant members can delete employee certifications" ON public.employee_certifications FOR DELETE USING (
  tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active')
);

CREATE TABLE public.employee_trainings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  provider TEXT,
  training_date DATE,
  hours NUMERIC(6,1),
  cost NUMERIC(12,2),
  currency TEXT DEFAULT 'RSD',
  certificate_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.employee_trainings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members can view employee trainings" ON public.employee_trainings FOR SELECT USING (
  tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active')
);
CREATE POLICY "Tenant members can insert employee trainings" ON public.employee_trainings FOR INSERT WITH CHECK (
  tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active')
);
CREATE POLICY "Tenant members can update employee trainings" ON public.employee_trainings FOR UPDATE USING (
  tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active')
);
CREATE POLICY "Tenant members can delete employee trainings" ON public.employee_trainings FOR DELETE USING (
  tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active')
);

-- BANK-3: Payment Orders
CREATE TABLE public.payment_order_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  batch_number TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_order_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members can view payment order batches" ON public.payment_order_batches FOR SELECT USING (
  tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active')
);
CREATE POLICY "Tenant members can insert payment order batches" ON public.payment_order_batches FOR INSERT WITH CHECK (
  tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active')
);
CREATE POLICY "Tenant members can update payment order batches" ON public.payment_order_batches FOR UPDATE USING (
  tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active')
);
CREATE POLICY "Tenant members can delete payment order batches" ON public.payment_order_batches FOR DELETE USING (
  tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active')
);

CREATE TABLE public.payment_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  batch_id UUID REFERENCES public.payment_order_batches(id),
  partner_id UUID REFERENCES public.partners(id),
  amount NUMERIC(15,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'RSD',
  sender_account TEXT NOT NULL,
  recipient_account TEXT NOT NULL,
  recipient_name TEXT,
  reference_number TEXT,
  payment_code TEXT,
  model TEXT,
  description TEXT,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members can view payment orders" ON public.payment_orders FOR SELECT USING (
  tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active')
);
CREATE POLICY "Tenant members can insert payment orders" ON public.payment_orders FOR INSERT WITH CHECK (
  tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active')
);
CREATE POLICY "Tenant members can update payment orders" ON public.payment_orders FOR UPDATE USING (
  tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active')
);
CREATE POLICY "Tenant members can delete payment orders" ON public.payment_orders FOR DELETE USING (
  tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active')
);

CREATE INDEX idx_payment_orders_tenant ON public.payment_orders(tenant_id);
CREATE INDEX idx_payment_orders_batch ON public.payment_orders(batch_id);
CREATE INDEX idx_payment_orders_status ON public.payment_orders(status);
CREATE INDEX idx_employee_certifications_expiry ON public.employee_certifications(expiry_date);
