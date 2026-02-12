
-- ==========================================
-- Phase 3: Sales & CRM Expansion
-- ==========================================

-- LEADS
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  source TEXT DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','qualified','converted','lost')),
  assigned_to UUID,
  notes TEXT,
  converted_partner_id UUID REFERENCES public.partners(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members can manage leads" ON public.leads FOR ALL
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())))
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "Super admins full access on leads" ON public.leads FOR ALL
  USING (public.is_super_admin(auth.uid()));
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- OPPORTUNITIES
CREATE TABLE public.opportunities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  partner_id UUID REFERENCES public.partners(id),
  lead_id UUID REFERENCES public.leads(id),
  value NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'RSD',
  probability INTEGER NOT NULL DEFAULT 50 CHECK (probability >= 0 AND probability <= 100),
  stage TEXT NOT NULL DEFAULT 'prospecting' CHECK (stage IN ('prospecting','qualification','proposal','negotiation','closed_won','closed_lost')),
  expected_close_date DATE,
  assigned_to UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members can manage opportunities" ON public.opportunities FOR ALL
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())))
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "Super admins full access on opportunities" ON public.opportunities FOR ALL
  USING (public.is_super_admin(auth.uid()));
CREATE TRIGGER update_opportunities_updated_at BEFORE UPDATE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- QUOTES
CREATE TABLE public.quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  quote_number TEXT NOT NULL,
  opportunity_id UUID REFERENCES public.opportunities(id),
  partner_id UUID REFERENCES public.partners(id),
  partner_name TEXT NOT NULL DEFAULT '',
  quote_date DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','accepted','rejected','expired')),
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'RSD',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members can manage quotes" ON public.quotes FOR ALL
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())))
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "Super admins full access on quotes" ON public.quotes FOR ALL
  USING (public.is_super_admin(auth.uid()));
CREATE TRIGGER update_quotes_updated_at BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- QUOTE LINES
CREATE TABLE public.quote_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
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
ALTER TABLE public.quote_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members can manage quote_lines" ON public.quote_lines FOR ALL
  USING (quote_id IN (SELECT id FROM public.quotes WHERE tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))))
  WITH CHECK (quote_id IN (SELECT id FROM public.quotes WHERE tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))));
CREATE POLICY "Super admins full access on quote_lines" ON public.quote_lines FOR ALL
  USING (public.is_super_admin(auth.uid()));

-- SALES ORDERS
CREATE TABLE public.sales_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  quote_id UUID REFERENCES public.quotes(id),
  partner_id UUID REFERENCES public.partners(id),
  partner_name TEXT NOT NULL DEFAULT '',
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','shipped','delivered','cancelled')),
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'RSD',
  invoice_id UUID REFERENCES public.invoices(id),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members can manage sales_orders" ON public.sales_orders FOR ALL
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())))
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "Super admins full access on sales_orders" ON public.sales_orders FOR ALL
  USING (public.is_super_admin(auth.uid()));
CREATE TRIGGER update_sales_orders_updated_at BEFORE UPDATE ON public.sales_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SALES ORDER LINES
CREATE TABLE public.sales_order_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sales_order_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
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
ALTER TABLE public.sales_order_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members can manage sales_order_lines" ON public.sales_order_lines FOR ALL
  USING (sales_order_id IN (SELECT id FROM public.sales_orders WHERE tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))))
  WITH CHECK (sales_order_id IN (SELECT id FROM public.sales_orders WHERE tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))));
CREATE POLICY "Super admins full access on sales_order_lines" ON public.sales_order_lines FOR ALL
  USING (public.is_super_admin(auth.uid()));

-- AUDIT TRIGGERS
CREATE TRIGGER audit_leads AFTER INSERT OR UPDATE OR DELETE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_opportunities AFTER INSERT OR UPDATE OR DELETE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_quotes AFTER INSERT OR UPDATE OR DELETE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_sales_orders AFTER INSERT OR UPDATE OR DELETE ON public.sales_orders
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
