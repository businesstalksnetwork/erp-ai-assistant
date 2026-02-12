
-- =============================================================
-- Phase 8: Returns Module (RET)
-- Tables: return_cases, return_lines, credit_notes, supplier_return_shipments
-- =============================================================

-- 1. return_cases
CREATE TABLE public.return_cases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  return_type TEXT NOT NULL DEFAULT 'customer' CHECK (return_type IN ('customer', 'supplier')),
  source_type TEXT NOT NULL DEFAULT 'invoice' CHECK (source_type IN ('sales_order', 'purchase_order', 'invoice')),
  source_id UUID NOT NULL,
  partner_id UUID REFERENCES public.partners(id),
  case_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'inspecting', 'approved', 'resolved', 'cancelled')),
  opened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.return_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view return cases" ON public.return_cases FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant admins manage return cases" ON public.return_cases FOR ALL
  USING (tenant_id IN (
    SELECT tm.tenant_id FROM tenant_members tm
    WHERE tm.user_id = auth.uid() AND tm.role IN ('admin', 'accountant') AND tm.status = 'active'
  ));

CREATE POLICY "Super admins manage return cases" ON public.return_cases FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE TRIGGER update_return_cases_updated_at BEFORE UPDATE ON public.return_cases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER audit_return_cases AFTER INSERT OR UPDATE OR DELETE ON public.return_cases
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- 2. return_lines
CREATE TABLE public.return_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  return_case_id UUID NOT NULL REFERENCES public.return_cases(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  description TEXT NOT NULL DEFAULT '',
  quantity_returned NUMERIC NOT NULL DEFAULT 0,
  quantity_accepted NUMERIC NOT NULL DEFAULT 0,
  reason TEXT NOT NULL DEFAULT 'other' CHECK (reason IN ('defective', 'wrong_item', 'damaged', 'not_needed', 'other')),
  inspection_status TEXT NOT NULL DEFAULT 'pending' CHECK (inspection_status IN ('pending', 'accepted', 'rejected')),
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.return_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation via return_cases" ON public.return_lines FOR ALL
  USING (return_case_id IN (
    SELECT rc.id FROM return_cases rc
    WHERE rc.tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
  ));

-- 3. credit_notes
CREATE TABLE public.credit_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  return_case_id UUID REFERENCES public.return_cases(id),
  invoice_id UUID REFERENCES public.invoices(id),
  credit_number TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'RSD',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'applied')),
  issued_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view credit notes" ON public.credit_notes FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant admins manage credit notes" ON public.credit_notes FOR ALL
  USING (tenant_id IN (
    SELECT tm.tenant_id FROM tenant_members tm
    WHERE tm.user_id = auth.uid() AND tm.role IN ('admin', 'accountant') AND tm.status = 'active'
  ));

CREATE POLICY "Super admins manage credit notes" ON public.credit_notes FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE TRIGGER update_credit_notes_updated_at BEFORE UPDATE ON public.credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER audit_credit_notes AFTER INSERT OR UPDATE OR DELETE ON public.credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- 4. supplier_return_shipments
CREATE TABLE public.supplier_return_shipments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  return_case_id UUID REFERENCES public.return_cases(id),
  purchase_order_id UUID REFERENCES public.purchase_orders(id),
  warehouse_id UUID REFERENCES public.warehouses(id),
  shipment_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'shipped', 'acknowledged', 'credited')),
  shipped_at TIMESTAMP WITH TIME ZONE,
  tracking_number TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_return_shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view supplier return shipments" ON public.supplier_return_shipments FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant admins manage supplier return shipments" ON public.supplier_return_shipments FOR ALL
  USING (tenant_id IN (
    SELECT tm.tenant_id FROM tenant_members tm
    WHERE tm.user_id = auth.uid() AND tm.role IN ('admin', 'accountant') AND tm.status = 'active'
  ));

CREATE POLICY "Super admins manage supplier return shipments" ON public.supplier_return_shipments FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE TRIGGER update_supplier_return_shipments_updated_at BEFORE UPDATE ON public.supplier_return_shipments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Event bus trigger for return_cases status changes
CREATE OR REPLACE FUNCTION public.returns_event_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'approved' THEN
      INSERT INTO public.module_events (tenant_id, event_type, entity_type, entity_id, source_module, payload)
      VALUES (NEW.tenant_id, 'return_case.approved', 'return_case', NEW.id, 'returns',
        jsonb_build_object('return_type', NEW.return_type, 'case_number', NEW.case_number, 'partner_id', NEW.partner_id, 'source_type', NEW.source_type, 'source_id', NEW.source_id));
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER returns_status_event AFTER UPDATE ON public.return_cases
  FOR EACH ROW EXECUTE FUNCTION public.returns_event_trigger();

-- 6. Event bus trigger for credit_notes status changes
CREATE OR REPLACE FUNCTION public.credit_note_event_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'issued' THEN
      INSERT INTO public.module_events (tenant_id, event_type, entity_type, entity_id, source_module, payload)
      VALUES (NEW.tenant_id, 'credit_note.issued', 'credit_note', NEW.id, 'returns',
        jsonb_build_object('credit_number', NEW.credit_number, 'amount', NEW.amount, 'invoice_id', NEW.invoice_id, 'return_case_id', NEW.return_case_id));
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER credit_note_status_event AFTER UPDATE ON public.credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.credit_note_event_trigger();

-- 7. Event bus trigger for supplier_return_shipments
CREATE OR REPLACE FUNCTION public.supplier_return_event_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'shipped' THEN
      INSERT INTO public.module_events (tenant_id, event_type, entity_type, entity_id, source_module, payload)
      VALUES (NEW.tenant_id, 'supplier_return.shipped', 'supplier_return_shipment', NEW.id, 'returns',
        jsonb_build_object('shipment_number', NEW.shipment_number, 'warehouse_id', NEW.warehouse_id, 'purchase_order_id', NEW.purchase_order_id, 'return_case_id', NEW.return_case_id));
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER supplier_return_status_event AFTER UPDATE ON public.supplier_return_shipments
  FOR EACH ROW EXECUTE FUNCTION public.supplier_return_event_trigger();

-- 8. Seed event bus subscriptions
INSERT INTO public.module_event_subscriptions (event_type, handler_module, handler_function) VALUES
  ('return_case.approved', 'inventory', 'handle_return_approved_inventory'),
  ('credit_note.issued', 'accounting', 'handle_credit_note_issued'),
  ('supplier_return.shipped', 'inventory', 'handle_supplier_return_shipped');
