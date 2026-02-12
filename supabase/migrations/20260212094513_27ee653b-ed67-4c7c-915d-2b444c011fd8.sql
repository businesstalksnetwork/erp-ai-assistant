
-- Tax rates table (per-tenant)
CREATE TABLE public.tax_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_sr TEXT,
  rate NUMERIC NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tax_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view tax rates"
ON public.tax_rates FOR SELECT
USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Super admins manage tax rates"
ON public.tax_rates FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "Tenant admins/accountants manage tax rates"
ON public.tax_rates FOR ALL
USING (tenant_id IN (
  SELECT tenant_members.tenant_id FROM tenant_members
  WHERE tenant_members.user_id = auth.uid()
    AND tenant_members.role IN ('admin', 'accountant')
    AND tenant_members.status = 'active'
));

-- Invoices table (per-tenant)
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  partner_name TEXT NOT NULL DEFAULT '',
  partner_pib TEXT,
  partner_address TEXT,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'RSD',
  status TEXT NOT NULL DEFAULT 'draft',
  sef_status TEXT NOT NULL DEFAULT 'not_submitted',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view invoices"
ON public.invoices FOR SELECT
USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Super admins manage invoices"
ON public.invoices FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "Tenant admins/accountants manage invoices"
ON public.invoices FOR ALL
USING (tenant_id IN (
  SELECT tenant_members.tenant_id FROM tenant_members
  WHERE tenant_members.user_id = auth.uid()
    AND tenant_members.role IN ('admin', 'accountant')
    AND tenant_members.status = 'active'
));

-- Invoice lines table
CREATE TABLE public.invoice_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL DEFAULT '',
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  tax_rate_id UUID REFERENCES public.tax_rates(id),
  tax_rate_value NUMERIC NOT NULL DEFAULT 0,
  line_total NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  total_with_tax NUMERIC NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view invoice lines"
ON public.invoice_lines FOR SELECT
USING (invoice_id IN (
  SELECT id FROM invoices WHERE tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
));

CREATE POLICY "Super admins manage invoice lines"
ON public.invoice_lines FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "Tenant admins/accountants manage invoice lines"
ON public.invoice_lines FOR ALL
USING (invoice_id IN (
  SELECT je.id FROM invoices je
  JOIN tenant_members tm ON tm.tenant_id = je.tenant_id
  WHERE tm.user_id = auth.uid()
    AND tm.role IN ('admin', 'accountant')
    AND tm.status = 'active'
));

-- Updated_at triggers
CREATE TRIGGER update_tax_rates_updated_at
BEFORE UPDATE ON public.tax_rates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_invoices_tenant_id ON public.invoices(tenant_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_invoice_lines_invoice_id ON public.invoice_lines(invoice_id);
CREATE INDEX idx_tax_rates_tenant_id ON public.tax_rates(tenant_id);
