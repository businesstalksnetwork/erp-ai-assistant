
-- Re-run full schema (tables already created from failed migration won't re-create due to error rollback)

-- 6.1 Warehouse extension
ALTER TABLE public.warehouses
ADD COLUMN IF NOT EXISTS warehouse_type TEXT NOT NULL DEFAULT 'standard';

-- 6.2 service_devices
CREATE TABLE public.service_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  partner_id UUID REFERENCES public.partners(id) ON DELETE CASCADE,
  is_internal BOOLEAN NOT NULL DEFAULT false,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  device_type TEXT NOT NULL DEFAULT 'other',
  brand TEXT,
  model TEXT,
  serial_number TEXT,
  purchase_date DATE,
  warranty_expiry DATE,
  current_location_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_device_serial UNIQUE (tenant_id, serial_number)
);

CREATE INDEX idx_devices_partner ON service_devices(tenant_id, partner_id);
CREATE INDEX idx_devices_serial ON service_devices(tenant_id, serial_number);
CREATE INDEX idx_devices_location ON service_devices(tenant_id, current_location_id);

-- 6.3 service_orders
CREATE TABLE public.service_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  intake_channel TEXT NOT NULL DEFAULT 'retail',
  partner_id UUID REFERENCES public.partners(id),
  device_id UUID REFERENCES public.service_devices(id) ON DELETE SET NULL,
  origin_location_id UUID REFERENCES public.warehouses(id),
  service_location_id UUID NOT NULL REFERENCES public.warehouses(id),
  assigned_to UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'received',
  priority TEXT NOT NULL DEFAULT 'normal',
  reported_issue TEXT NOT NULL,
  diagnosis TEXT,
  resolution TEXT,
  internal_notes TEXT,
  is_warranty BOOLEAN NOT NULL DEFAULT false,
  estimated_completion DATE,
  actual_completion DATE,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  diagnosed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  total_labor NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_parts NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method TEXT,
  linked_invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  linked_pos_transaction_id UUID REFERENCES public.pos_transactions(id) ON DELETE SET NULL,
  cost_center_id UUID,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_order_number UNIQUE (tenant_id, order_number)
);

CREATE INDEX idx_service_orders_tenant_status ON service_orders(tenant_id, status);
CREATE INDEX idx_service_orders_device ON service_orders(device_id);
CREATE INDEX idx_service_orders_partner ON service_orders(tenant_id, partner_id);

-- 6.4 service_work_orders
CREATE TABLE public.service_work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_order_id UUID NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  work_order_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  work_order_type TEXT NOT NULL DEFAULT 'repair',
  assigned_to UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  estimated_hours NUMERIC(6,2),
  actual_hours NUMERIC(6,2),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  technician_notes TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_work_order_number UNIQUE (tenant_id, work_order_number)
);

CREATE INDEX idx_work_orders_service ON service_work_orders(service_order_id);
CREATE INDEX idx_work_orders_assigned ON service_work_orders(tenant_id, assigned_to, status);

-- 6.5 service_order_lines
CREATE TABLE public.service_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_order_id UUID NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  work_order_id UUID REFERENCES public.service_work_orders(id) ON DELETE SET NULL,
  line_type TEXT NOT NULL DEFAULT 'labor',
  description TEXT NOT NULL DEFAULT '',
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_warranty_covered BOOLEAN NOT NULL DEFAULT false,
  inventory_movement_id UUID REFERENCES public.inventory_movements(id) ON DELETE SET NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_service_lines_order ON service_order_lines(service_order_id);
CREATE INDEX idx_service_lines_work_order ON service_order_lines(work_order_id);

-- 6.6 service_order_status_log
CREATE TABLE public.service_order_status_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_order_id UUID NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_status_log_order ON service_order_status_log(service_order_id);

-- RLS
ALTER TABLE public.service_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_order_status_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.service_devices FOR ALL
USING (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid()));

CREATE POLICY "Tenant isolation" ON public.service_orders FOR ALL
USING (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid()));

CREATE POLICY "Tenant isolation" ON public.service_work_orders FOR ALL
USING (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid()));

CREATE POLICY "Lines via order tenant" ON public.service_order_lines FOR ALL
USING (service_order_id IN (
  SELECT id FROM public.service_orders
  WHERE tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid())
));

CREATE POLICY "Status log via order tenant" ON public.service_order_status_log FOR ALL
USING (service_order_id IN (
  SELECT id FROM public.service_orders
  WHERE tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid())
));

-- RPCs
CREATE OR REPLACE FUNCTION public.generate_service_order_number(p_tenant_id UUID)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE v_year TEXT := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT; v_seq INT;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(order_number, '^SRV-' || v_year || '-', ''), order_number)::INT), 0) + 1
  INTO v_seq FROM public.service_orders WHERE tenant_id = p_tenant_id AND order_number LIKE 'SRV-' || v_year || '-%';
  RETURN 'SRV-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');
END; $$;

CREATE OR REPLACE FUNCTION public.generate_work_order_number(p_tenant_id UUID)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE v_year TEXT := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT; v_seq INT;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(work_order_number, '^RN-' || v_year || '-', ''), work_order_number)::INT), 0) + 1
  INTO v_seq FROM public.service_work_orders WHERE tenant_id = p_tenant_id AND work_order_number LIKE 'RN-' || v_year || '-%';
  RETURN 'RN-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');
END; $$;

CREATE OR REPLACE FUNCTION public.check_device_warranty(p_device_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE AS $$
DECLARE v_expiry DATE; v_active BOOLEAN;
BEGIN
  SELECT warranty_expiry INTO v_expiry FROM public.service_devices WHERE id = p_device_id;
  IF v_expiry IS NULL THEN RETURN jsonb_build_object('has_warranty', false, 'reason', 'no_warranty_date'); END IF;
  v_active := v_expiry >= CURRENT_DATE;
  RETURN jsonb_build_object('has_warranty', v_active, 'expiry_date', v_expiry,
    'days_remaining', CASE WHEN v_active THEN (v_expiry - CURRENT_DATE) ELSE 0 END,
    'reason', CASE WHEN v_active THEN 'active' ELSE 'expired' END);
END; $$;

CREATE OR REPLACE FUNCTION public.create_service_intake(
  p_tenant_id UUID, p_intake_channel TEXT, p_service_location_id UUID,
  p_origin_location_id UUID DEFAULT NULL, p_partner_id UUID DEFAULT NULL,
  p_device_id UUID DEFAULT NULL, p_reported_issue TEXT DEFAULT '',
  p_priority TEXT DEFAULT 'normal', p_user_id UUID DEFAULT auth.uid()
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_order_id UUID := gen_random_uuid(); v_order_number TEXT; v_is_warranty BOOLEAN := false; v_warranty JSONB;
BEGIN
  v_order_number := public.generate_service_order_number(p_tenant_id);
  IF p_device_id IS NOT NULL THEN
    v_warranty := public.check_device_warranty(p_device_id);
    v_is_warranty := (v_warranty->>'has_warranty')::boolean;
    UPDATE public.service_devices SET current_location_id = p_service_location_id, updated_at = now() WHERE id = p_device_id;
  END IF;
  INSERT INTO public.service_orders (id, tenant_id, order_number, intake_channel, partner_id, device_id, origin_location_id, service_location_id, reported_issue, priority, is_warranty, payment_method, created_by)
  VALUES (v_order_id, p_tenant_id, v_order_number, p_intake_channel, p_partner_id, p_device_id, p_origin_location_id, p_service_location_id, p_reported_issue, p_priority, v_is_warranty,
    CASE p_intake_channel WHEN 'retail' THEN 'pos' WHEN 'wholesale' THEN 'invoice' WHEN 'internal' THEN 'internal' END, p_user_id);
  INSERT INTO public.service_order_status_log (service_order_id, new_status, changed_by, note)
  VALUES (v_order_id, 'received', p_user_id, CASE p_intake_channel WHEN 'retail' THEN 'Prijem iz maloprodaje' WHEN 'wholesale' THEN 'Prijem iz veleprodaje' WHEN 'internal' THEN 'Interni servisni zahtev' END);
  RETURN v_order_id;
END; $$;

CREATE OR REPLACE FUNCTION public.change_service_order_status(
  p_order_id UUID, p_new_status TEXT, p_note TEXT DEFAULT NULL, p_user_id UUID DEFAULT auth.uid()
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_old_status TEXT; v_valid BOOLEAN := false;
BEGIN
  SELECT status INTO v_old_status FROM public.service_orders WHERE id = p_order_id;
  v_valid := CASE v_old_status
    WHEN 'received' THEN p_new_status IN ('diagnosed','cancelled')
    WHEN 'diagnosed' THEN p_new_status IN ('waiting_parts','in_repair','cancelled')
    WHEN 'waiting_parts' THEN p_new_status IN ('in_repair','cancelled')
    WHEN 'in_repair' THEN p_new_status IN ('completed','cancelled')
    WHEN 'completed' THEN p_new_status IN ('delivered')
    ELSE false END;
  IF NOT v_valid THEN RAISE EXCEPTION 'Invalid status transition: % → %', v_old_status, p_new_status; END IF;
  UPDATE public.service_orders SET status = p_new_status,
    diagnosed_at = CASE WHEN p_new_status = 'diagnosed' THEN now() ELSE diagnosed_at END,
    completed_at = CASE WHEN p_new_status = 'completed' THEN now() ELSE completed_at END,
    delivered_at = CASE WHEN p_new_status = 'delivered' THEN now() ELSE delivered_at END,
    cancelled_at = CASE WHEN p_new_status = 'cancelled' THEN now() ELSE cancelled_at END,
    actual_completion = CASE WHEN p_new_status = 'completed' THEN CURRENT_DATE ELSE actual_completion END,
    cancellation_reason = CASE WHEN p_new_status = 'cancelled' THEN p_note ELSE cancellation_reason END,
    updated_at = now() WHERE id = p_order_id;
  IF p_new_status = 'delivered' THEN
    UPDATE public.service_devices SET current_location_id = so.origin_location_id, updated_at = now()
    FROM public.service_orders so WHERE service_devices.id = so.device_id AND so.id = p_order_id;
  END IF;
  INSERT INTO public.service_order_status_log (service_order_id, old_status, new_status, changed_by, note)
  VALUES (p_order_id, v_old_status, p_new_status, p_user_id, p_note);
END; $$;

CREATE OR REPLACE FUNCTION public.consume_service_part(
  p_service_order_id UUID, p_work_order_id UUID DEFAULT NULL, p_product_id UUID DEFAULT NULL,
  p_warehouse_id UUID DEFAULT NULL, p_description TEXT DEFAULT '', p_quantity NUMERIC DEFAULT 1,
  p_unit_price NUMERIC DEFAULT 0, p_is_warranty BOOLEAN DEFAULT false
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_line_id UUID := gen_random_uuid(); v_movement_id UUID; v_service_location UUID; v_order_number TEXT;
BEGIN
  SELECT service_location_id, order_number INTO v_service_location, v_order_number FROM public.service_orders WHERE id = p_service_order_id;
  IF p_product_id IS NOT NULL AND p_warehouse_id IS NOT NULL THEN
    INSERT INTO public.inventory_movements (id, tenant_id, product_id, warehouse_id, movement_type, quantity, unit_cost, reference_type, reference_id, notes)
    SELECT gen_random_uuid(), so.tenant_id, p_product_id, COALESCE(p_warehouse_id, v_service_location), 'issue', p_quantity, p_unit_price, 'service_order', p_service_order_id, 'Servisni nalog: ' || v_order_number
    FROM public.service_orders so WHERE so.id = p_service_order_id RETURNING id INTO v_movement_id;
  END IF;
  INSERT INTO public.service_order_lines (id, service_order_id, work_order_id, line_type, description, product_id, warehouse_id, quantity, unit_price, line_total, is_warranty_covered, inventory_movement_id)
  VALUES (v_line_id, p_service_order_id, p_work_order_id, 'part', p_description, p_product_id, p_warehouse_id, p_quantity, p_unit_price, p_quantity * p_unit_price, p_is_warranty, v_movement_id);
  RETURN v_line_id;
END; $$;

CREATE OR REPLACE FUNCTION public.update_service_order_totals() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_order_id UUID; v_labor NUMERIC; v_parts NUMERIC;
BEGIN
  v_order_id := COALESCE(NEW.service_order_id, OLD.service_order_id);
  SELECT COALESCE(SUM(line_total) FILTER (WHERE line_type = 'labor' AND NOT is_warranty_covered), 0),
    COALESCE(SUM(line_total) FILTER (WHERE line_type = 'part' AND NOT is_warranty_covered), 0)
  INTO v_labor, v_parts FROM public.service_order_lines WHERE service_order_id = v_order_id;
  UPDATE public.service_orders SET total_labor = v_labor, total_parts = v_parts, total_amount = v_labor + v_parts, updated_at = now() WHERE id = v_order_id;
  RETURN COALESCE(NEW, OLD);
END; $$;

CREATE TRIGGER trg_service_line_totals AFTER INSERT OR UPDATE OR DELETE ON public.service_order_lines
FOR EACH ROW EXECUTE FUNCTION public.update_service_order_totals();

CREATE OR REPLACE FUNCTION public.generate_invoice_from_service_order(p_order_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_order RECORD; v_inv_id UUID;
BEGIN
  SELECT * INTO v_order FROM public.service_orders WHERE id = p_order_id;
  IF v_order.status NOT IN ('completed','delivered') THEN RAISE EXCEPTION 'Order must be completed/delivered to generate invoice'; END IF;
  IF v_order.linked_invoice_id IS NOT NULL THEN RAISE EXCEPTION 'Invoice already exists for this order'; END IF;
  IF v_order.intake_channel = 'internal' THEN RAISE EXCEPTION 'Internal orders do not generate invoices'; END IF;
  INSERT INTO public.invoices (tenant_id, partner_id, invoice_type, status, invoice_date, due_date, subtotal, tax_total, total, notes)
  VALUES (v_order.tenant_id, v_order.partner_id, 'sales', 'draft', CURRENT_DATE, CURRENT_DATE + INTERVAL '15 days',
    v_order.total_amount, ROUND(v_order.total_amount * 0.20, 2), ROUND(v_order.total_amount * 1.20, 2), 'Servisni nalog: ' || v_order.order_number)
  RETURNING id INTO v_inv_id;
  INSERT INTO public.invoice_lines (invoice_id, description, quantity, unit_price, tax_rate, line_total, product_id)
  SELECT v_inv_id, sol.description, sol.quantity, sol.unit_price, 20, sol.line_total, sol.product_id
  FROM public.service_order_lines sol WHERE sol.service_order_id = p_order_id AND NOT sol.is_warranty_covered ORDER BY sol.sort_order;
  UPDATE public.service_orders SET linked_invoice_id = v_inv_id, updated_at = now() WHERE id = p_order_id;
  RETURN v_inv_id;
END; $$;

-- Module registration (without is_active column)
INSERT INTO public.module_definitions (key, name, description, sort_order)
VALUES ('service', 'Service Management', 'Service order management with device tracking, work orders, and multi-channel intake', 12)
ON CONFLICT (key) DO NOTHING;
