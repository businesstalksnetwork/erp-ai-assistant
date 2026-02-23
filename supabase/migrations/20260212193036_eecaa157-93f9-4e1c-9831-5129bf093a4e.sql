
-- SEF Connections: per-tenant SEF connector config
CREATE TABLE public.sef_connections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  legal_entity_id uuid REFERENCES public.legal_entities(id),
  api_url text NOT NULL DEFAULT '',
  api_key_encrypted text NOT NULL DEFAULT '',
  environment text NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
  is_active boolean NOT NULL DEFAULT false,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

ALTER TABLE public.sef_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view SEF connections"
  ON public.sef_connections FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE POLICY "Tenant admins can manage SEF connections"
  ON public.sef_connections FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND role IN ('admin') AND status = 'active'));

CREATE TRIGGER update_sef_connections_updated_at
  BEFORE UPDATE ON public.sef_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SEF Submissions: invoice submission audit log
CREATE TABLE public.sef_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  sef_connection_id uuid NOT NULL REFERENCES public.sef_connections(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'accepted', 'rejected', 'error')),
  sef_invoice_id text,
  request_payload jsonb,
  response_payload jsonb,
  error_message text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE public.sef_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view SEF submissions"
  ON public.sef_submissions FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE POLICY "Tenant members can insert SEF submissions"
  ON public.sef_submissions FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE INDEX idx_sef_submissions_tenant ON public.sef_submissions(tenant_id);
CREATE INDEX idx_sef_submissions_invoice ON public.sef_submissions(invoice_id);

-- eOtpremnica: electronic dispatch notes
CREATE TABLE public.eotpremnica (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  legal_entity_id uuid REFERENCES public.legal_entities(id),
  document_number text NOT NULL,
  document_date date NOT NULL DEFAULT CURRENT_DATE,
  sender_name text NOT NULL,
  sender_pib text,
  sender_address text,
  receiver_name text NOT NULL,
  receiver_pib text,
  receiver_address text,
  warehouse_id uuid REFERENCES public.warehouses(id),
  invoice_id uuid REFERENCES public.invoices(id),
  sales_order_id uuid REFERENCES public.sales_orders(id),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'in_transit', 'delivered', 'cancelled')),
  notes text,
  total_weight numeric,
  vehicle_plate text,
  driver_name text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.eotpremnica ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view dispatch notes"
  ON public.eotpremnica FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE POLICY "Tenant members can manage dispatch notes"
  ON public.eotpremnica FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE TRIGGER update_eotpremnica_updated_at
  BEFORE UPDATE ON public.eotpremnica
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_eotpremnica_tenant ON public.eotpremnica(tenant_id);
CREATE INDEX idx_eotpremnica_status ON public.eotpremnica(status);

-- eOtpremnica Lines
CREATE TABLE public.eotpremnica_lines (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  eotpremnica_id uuid NOT NULL REFERENCES public.eotpremnica(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id),
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'kom',
  sort_order int NOT NULL DEFAULT 0
);

ALTER TABLE public.eotpremnica_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view dispatch note lines"
  ON public.eotpremnica_lines FOR SELECT
  USING (eotpremnica_id IN (SELECT id FROM public.eotpremnica WHERE tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active')));

CREATE POLICY "Tenant members can manage dispatch note lines"
  ON public.eotpremnica_lines FOR ALL
  USING (eotpremnica_id IN (SELECT id FROM public.eotpremnica WHERE tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active')));

CREATE INDEX idx_eotpremnica_lines_parent ON public.eotpremnica_lines(eotpremnica_id);
