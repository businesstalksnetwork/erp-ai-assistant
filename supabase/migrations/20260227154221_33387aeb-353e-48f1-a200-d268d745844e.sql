
-- Supplier evaluations: weighted scoring per supplier per period
CREATE TABLE public.supplier_evaluations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  partner_id UUID NOT NULL REFERENCES public.partners(id),
  evaluation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  quality_score NUMERIC(3,1) DEFAULT 0 CHECK (quality_score >= 0 AND quality_score <= 10),
  delivery_score NUMERIC(3,1) DEFAULT 0 CHECK (delivery_score >= 0 AND delivery_score <= 10),
  price_score NUMERIC(3,1) DEFAULT 0 CHECK (price_score >= 0 AND price_score <= 10),
  service_score NUMERIC(3,1) DEFAULT 0 CHECK (service_score >= 0 AND service_score <= 10),
  quality_weight NUMERIC(3,2) DEFAULT 0.30,
  delivery_weight NUMERIC(3,2) DEFAULT 0.25,
  price_weight NUMERIC(3,2) DEFAULT 0.25,
  service_weight NUMERIC(3,2) DEFAULT 0.20,
  weighted_score NUMERIC(4,2) GENERATED ALWAYS AS (
    quality_score * quality_weight + delivery_score * delivery_weight + price_score * price_weight + service_score * service_weight
  ) STORED,
  notes TEXT,
  evaluated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.supplier_evaluations FOR ALL
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE INDEX idx_supplier_evaluations_tenant ON public.supplier_evaluations(tenant_id);
CREATE INDEX idx_supplier_evaluations_partner ON public.supplier_evaluations(partner_id);

-- Demand forecast snapshots
CREATE TABLE public.demand_forecasts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  product_id UUID NOT NULL REFERENCES public.products(id),
  forecast_date DATE NOT NULL DEFAULT CURRENT_DATE,
  period_label TEXT NOT NULL,
  actual_qty NUMERIC DEFAULT 0,
  moving_avg_qty NUMERIC DEFAULT 0,
  seasonal_index NUMERIC(5,3) DEFAULT 1.000,
  forecast_qty NUMERIC DEFAULT 0,
  reorder_point NUMERIC DEFAULT 0,
  safety_stock NUMERIC DEFAULT 0,
  lead_time_days INT DEFAULT 7,
  method TEXT DEFAULT 'moving_average',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.demand_forecasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.demand_forecasts FOR ALL
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE INDEX idx_demand_forecasts_tenant ON public.demand_forecasts(tenant_id);
CREATE INDEX idx_demand_forecasts_product ON public.demand_forecasts(product_id);

CREATE TRIGGER update_supplier_evaluations_updated_at
  BEFORE UPDATE ON public.supplier_evaluations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
