
-- Phase 4: Purchasing/Inventory 5.0 tables

-- I1: Supplier Lead Times
CREATE TABLE public.supplier_lead_times (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  goods_receipt_id UUID REFERENCES public.goods_receipts(id) ON DELETE SET NULL,
  ordered_date DATE NOT NULL,
  received_date DATE NOT NULL,
  lead_time_days INTEGER GENERATED ALWAYS AS (received_date - ordered_date) STORED,
  expected_lead_time_days INTEGER,
  on_time BOOLEAN GENERATED ALWAYS AS (
    CASE WHEN expected_lead_time_days IS NOT NULL THEN (received_date - ordered_date) <= expected_lead_time_days ELSE TRUE END
  ) STORED,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_lead_times ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for supplier_lead_times"
  ON public.supplier_lead_times FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));
CREATE INDEX idx_supplier_lead_times_tenant_supplier ON public.supplier_lead_times(tenant_id, supplier_id);
CREATE INDEX idx_supplier_lead_times_tenant_product ON public.supplier_lead_times(tenant_id, product_id);

-- I1: Supplier Order Predictions
CREATE TABLE public.supplier_order_predictions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  current_stock NUMERIC NOT NULL DEFAULT 0,
  avg_daily_demand NUMERIC NOT NULL DEFAULT 0,
  lead_time_days INTEGER NOT NULL DEFAULT 0,
  reorder_point NUMERIC NOT NULL DEFAULT 0,
  safety_stock NUMERIC NOT NULL DEFAULT 0,
  recommended_qty NUMERIC NOT NULL DEFAULT 0,
  order_by_date DATE,
  confidence NUMERIC NOT NULL DEFAULT 0,
  estimated_value NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'converted_to_po')),
  purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  horizon_days INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_order_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for supplier_order_predictions"
  ON public.supplier_order_predictions FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));
CREATE INDEX idx_sop_tenant_supplier ON public.supplier_order_predictions(tenant_id, supplier_id);
CREATE INDEX idx_sop_tenant_product ON public.supplier_order_predictions(tenant_id, product_id);
CREATE INDEX idx_sop_status ON public.supplier_order_predictions(tenant_id, status);

-- I5: Blanket Agreements
CREATE TABLE public.blanket_agreements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  agreement_number TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_value NUMERIC NOT NULL DEFAULT 0,
  consumed_value NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'RSD',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'expired', 'cancelled', 'completed')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.blanket_agreements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for blanket_agreements"
  ON public.blanket_agreements FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));
CREATE INDEX idx_blanket_agreements_tenant ON public.blanket_agreements(tenant_id);

CREATE TABLE public.blanket_agreement_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  agreement_id UUID NOT NULL REFERENCES public.blanket_agreements(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  agreed_qty NUMERIC NOT NULL DEFAULT 0,
  agreed_price NUMERIC NOT NULL DEFAULT 0,
  consumed_qty NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.blanket_agreement_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for blanket_agreement_lines"
  ON public.blanket_agreement_lines FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));
CREATE INDEX idx_blanket_lines_agreement ON public.blanket_agreement_lines(agreement_id);

-- I7: Consignment Inventory
CREATE TABLE public.consignment_stock (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'consigned' CHECK (status IN ('consigned', 'consumed', 'returned')),
  received_date DATE NOT NULL DEFAULT CURRENT_DATE,
  consumed_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.consignment_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for consignment_stock"
  ON public.consignment_stock FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));
CREATE INDEX idx_consignment_tenant_supplier ON public.consignment_stock(tenant_id, supplier_id);
CREATE INDEX idx_consignment_tenant_product ON public.consignment_stock(tenant_id, product_id);
CREATE INDEX idx_consignment_status ON public.consignment_stock(tenant_id, status);

-- I6: Add exchange_rate to purchase_orders
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC DEFAULT 1;

-- Updated_at triggers
CREATE TRIGGER update_supplier_order_predictions_updated_at
  BEFORE UPDATE ON public.supplier_order_predictions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_blanket_agreements_updated_at
  BEFORE UPDATE ON public.blanket_agreements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_consignment_stock_updated_at
  BEFORE UPDATE ON public.consignment_stock
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
