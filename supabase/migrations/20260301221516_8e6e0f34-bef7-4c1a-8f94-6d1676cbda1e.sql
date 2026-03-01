
-- Phase D: Differentiation Features

-- 1. Payment Templates (BANK-4)
CREATE TABLE public.payment_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL,
  recipient_name TEXT,
  recipient_account TEXT NOT NULL,
  amount NUMERIC(15,2),
  currency TEXT NOT NULL DEFAULT 'RSD',
  payment_code TEXT DEFAULT '289',
  model TEXT DEFAULT '97',
  reference_pattern TEXT,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members can view templates" ON public.payment_templates FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.tenant_members tm WHERE tm.tenant_id = payment_templates.tenant_id AND tm.user_id = auth.uid() AND tm.status = 'active')
);
CREATE POLICY "Tenant members can insert templates" ON public.payment_templates FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.tenant_members tm WHERE tm.tenant_id = payment_templates.tenant_id AND tm.user_id = auth.uid() AND tm.status = 'active')
);
CREATE POLICY "Tenant members can update templates" ON public.payment_templates FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.tenant_members tm WHERE tm.tenant_id = payment_templates.tenant_id AND tm.user_id = auth.uid() AND tm.status = 'active')
);
CREATE POLICY "Tenant members can delete templates" ON public.payment_templates FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.tenant_members tm WHERE tm.tenant_id = payment_templates.tenant_id AND tm.user_id = auth.uid() AND tm.status = 'active')
);

-- 2. Interest Accruals (BANK-6)
CREATE TABLE public.interest_accruals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('loan', 'receivable')),
  source_id UUID NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  principal NUMERIC(15,2) NOT NULL,
  rate NUMERIC(8,4) NOT NULL,
  accrued_amount NUMERIC(15,2) NOT NULL,
  posted BOOLEAN NOT NULL DEFAULT false,
  journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);
ALTER TABLE public.interest_accruals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members can view accruals" ON public.interest_accruals FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.tenant_members tm WHERE tm.tenant_id = interest_accruals.tenant_id AND tm.user_id = auth.uid() AND tm.status = 'active')
);
CREATE POLICY "Tenant members can insert accruals" ON public.interest_accruals FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.tenant_members tm WHERE tm.tenant_id = interest_accruals.tenant_id AND tm.user_id = auth.uid() AND tm.status = 'active')
);
CREATE POLICY "Tenant members can update accruals" ON public.interest_accruals FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.tenant_members tm WHERE tm.tenant_id = interest_accruals.tenant_id AND tm.user_id = auth.uid() AND tm.status = 'active')
);

-- 3. Cesije (BANK-7b)
CREATE TABLE public.cesije (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  original_debtor_id UUID NOT NULL REFERENCES public.partners(id),
  new_debtor_id UUID NOT NULL REFERENCES public.partners(id),
  amount NUMERIC(15,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'RSD',
  cesija_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'draft',
  journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);
ALTER TABLE public.cesije ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members can manage cesije" ON public.cesije FOR ALL USING (
  EXISTS (SELECT 1 FROM public.tenant_members tm WHERE tm.tenant_id = cesije.tenant_id AND tm.user_id = auth.uid() AND tm.status = 'active')
);

-- 4. Asignacije (BANK-7b)
CREATE TABLE public.asignacije (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  original_creditor_id UUID NOT NULL REFERENCES public.partners(id),
  new_creditor_id UUID NOT NULL REFERENCES public.partners(id),
  amount NUMERIC(15,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'RSD',
  asignacija_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'draft',
  journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);
ALTER TABLE public.asignacije ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members can manage asignacije" ON public.asignacije FOR ALL USING (
  EXISTS (SELECT 1 FROM public.tenant_members tm WHERE tm.tenant_id = asignacije.tenant_id AND tm.user_id = auth.uid() AND tm.status = 'active')
);
