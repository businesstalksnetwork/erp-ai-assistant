
-- Travel Orders (Putni Nalozi)
CREATE TABLE public.travel_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  legal_entity_id UUID REFERENCES public.legal_entities(id) ON DELETE SET NULL,
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  order_number TEXT NOT NULL DEFAULT '',
  destination TEXT NOT NULL,
  purpose TEXT,
  departure_date DATE NOT NULL,
  return_date DATE NOT NULL,
  transport_type TEXT NOT NULL DEFAULT 'car',
  vehicle_plate TEXT,
  advance_amount NUMERIC(15,2) DEFAULT 0,
  per_diem_rate NUMERIC(15,2) DEFAULT 0,
  per_diem_days NUMERIC(5,1) DEFAULT 0,
  per_diem_total NUMERIC(15,2) DEFAULT 0,
  total_expenses NUMERIC(15,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.travel_order_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  travel_order_id UUID NOT NULL REFERENCES public.travel_orders(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  expense_type TEXT NOT NULL DEFAULT 'other',
  description TEXT,
  amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  receipt_number TEXT,
  receipt_date DATE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.travel_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.travel_order_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for travel_orders" ON public.travel_orders
  FOR ALL USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())))
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Super admins full access on travel_orders" ON public.travel_orders
  FOR ALL USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Tenant isolation for travel_order_expenses" ON public.travel_order_expenses
  FOR ALL USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())))
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Super admins full access on travel_order_expenses" ON public.travel_order_expenses
  FOR ALL USING (public.is_super_admin(auth.uid()));

-- Auto-generate order_number
CREATE OR REPLACE FUNCTION public.generate_travel_order_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INT;
  yr TEXT;
BEGIN
  yr := EXTRACT(YEAR FROM NEW.departure_date)::TEXT;
  SELECT COALESCE(MAX(
    CASE WHEN order_number ~ ('^PN-' || yr || '-\d+$')
    THEN CAST(SUBSTRING(order_number FROM '\d+$') AS INT)
    ELSE 0 END
  ), 0) + 1 INTO next_num
  FROM public.travel_orders WHERE tenant_id = NEW.tenant_id;
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := 'PN-' || yr || '-' || LPAD(next_num::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_travel_order_number
  BEFORE INSERT ON public.travel_orders
  FOR EACH ROW EXECUTE FUNCTION public.generate_travel_order_number();

-- Updated_at trigger
CREATE TRIGGER update_travel_orders_updated_at
  BEFORE UPDATE ON public.travel_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_travel_orders_tenant ON public.travel_orders(tenant_id);
CREATE INDEX idx_travel_orders_employee ON public.travel_orders(employee_id);
CREATE INDEX idx_travel_orders_status ON public.travel_orders(status);
CREATE INDEX idx_travel_order_expenses_order ON public.travel_order_expenses(travel_order_id);
