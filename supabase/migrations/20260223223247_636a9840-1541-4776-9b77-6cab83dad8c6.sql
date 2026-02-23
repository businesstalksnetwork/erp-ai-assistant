
-- Quality Control tables
CREATE TABLE public.quality_checks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  production_order_id UUID REFERENCES public.production_orders(id),
  product_id UUID REFERENCES public.products(id),
  check_number TEXT NOT NULL,
  check_type TEXT NOT NULL DEFAULT 'in_process', -- incoming, in_process, final, random
  status TEXT NOT NULL DEFAULT 'pending', -- pending, passed, failed, on_hold
  inspector_id UUID,
  checked_at TIMESTAMPTZ,
  quantity_inspected NUMERIC DEFAULT 0,
  quantity_passed NUMERIC DEFAULT 0,
  quantity_failed NUMERIC DEFAULT 0,
  defect_rate NUMERIC GENERATED ALWAYS AS (
    CASE WHEN quantity_inspected > 0 THEN ROUND((quantity_failed / quantity_inspected) * 100, 2) ELSE 0 END
  ) STORED,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.quality_check_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quality_check_id UUID NOT NULL REFERENCES public.quality_checks(id) ON DELETE CASCADE,
  parameter_name TEXT NOT NULL,
  expected_value TEXT,
  actual_value TEXT,
  is_pass BOOLEAN DEFAULT true,
  notes TEXT,
  sort_order INT DEFAULT 0
);

-- WMS Returns table
CREATE TABLE public.wms_returns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  return_number TEXT NOT NULL,
  warehouse_id UUID REFERENCES public.warehouses(id),
  partner_id UUID REFERENCES public.partners(id),
  sales_order_id UUID REFERENCES public.sales_orders(id),
  return_type TEXT NOT NULL DEFAULT 'customer', -- customer, supplier, internal
  status TEXT NOT NULL DEFAULT 'pending', -- pending, inspecting, restocked, scrapped, completed
  reason TEXT,
  total_quantity NUMERIC DEFAULT 0,
  restocked_quantity NUMERIC DEFAULT 0,
  scrapped_quantity NUMERIC DEFAULT 0,
  received_by UUID,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.wms_return_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  return_id UUID NOT NULL REFERENCES public.wms_returns(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  quantity NUMERIC NOT NULL DEFAULT 1,
  condition TEXT DEFAULT 'good', -- good, damaged, defective
  disposition TEXT DEFAULT 'restock', -- restock, scrap, repair, quarantine
  bin_id UUID REFERENCES public.wms_bins(id),
  notes TEXT,
  sort_order INT DEFAULT 0
);

-- WMS Labor tracking
CREATE TABLE public.wms_labor_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  worker_id UUID NOT NULL,
  task_id UUID REFERENCES public.wms_tasks(id),
  task_type TEXT,
  warehouse_id UUID REFERENCES public.warehouses(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_minutes NUMERIC,
  items_processed NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Production maintenance records
CREATE TABLE public.production_maintenance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  equipment_name TEXT NOT NULL,
  maintenance_type TEXT NOT NULL DEFAULT 'preventive', -- preventive, corrective, predictive
  status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled, in_progress, completed, overdue
  scheduled_date DATE,
  completed_date DATE,
  assigned_to UUID,
  cost NUMERIC DEFAULT 0,
  downtime_hours NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.quality_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_check_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wms_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wms_return_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wms_labor_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_maintenance ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Tenant isolation" ON public.quality_checks FOR ALL USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant isolation" ON public.quality_check_items FOR ALL USING (quality_check_id IN (SELECT id FROM public.quality_checks WHERE tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))));
CREATE POLICY "Tenant isolation" ON public.wms_returns FOR ALL USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant isolation" ON public.wms_return_lines FOR ALL USING (return_id IN (SELECT id FROM public.wms_returns WHERE tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))));
CREATE POLICY "Tenant isolation" ON public.wms_labor_log FOR ALL USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant isolation" ON public.production_maintenance FOR ALL USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- Triggers for updated_at
CREATE TRIGGER update_quality_checks_updated_at BEFORE UPDATE ON public.quality_checks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_wms_returns_updated_at BEFORE UPDATE ON public.wms_returns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_production_maintenance_updated_at BEFORE UPDATE ON public.production_maintenance FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_quality_checks_tenant ON public.quality_checks(tenant_id);
CREATE INDEX idx_quality_checks_production_order ON public.quality_checks(production_order_id);
CREATE INDEX idx_wms_returns_tenant ON public.wms_returns(tenant_id);
CREATE INDEX idx_wms_labor_log_tenant ON public.wms_labor_log(tenant_id);
CREATE INDEX idx_wms_labor_log_worker ON public.wms_labor_log(worker_id);
CREATE INDEX idx_production_maintenance_tenant ON public.production_maintenance(tenant_id);
