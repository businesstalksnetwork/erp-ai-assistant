
-- ============================================================
-- WMS Module: Full Database Migration
-- ============================================================

-- 1. Enums
CREATE TYPE public.wms_zone_type AS ENUM ('receiving','reserve','forward_pick','packing','shipping','quarantine','returns');
CREATE TYPE public.wms_pick_method AS ENUM ('each','case','pallet');
CREATE TYPE public.wms_bin_type AS ENUM ('bin','shelf','pallet','flow_rack');
CREATE TYPE public.wms_bin_stock_status AS ENUM ('available','damaged','quarantine','on_hold','allocated');
CREATE TYPE public.wms_task_type AS ENUM ('receive','putaway','pick','replenish','move','reslot','count','pack','load');
CREATE TYPE public.wms_task_status AS ENUM ('pending','assigned','in_progress','completed','cancelled','exception');
CREATE TYPE public.wms_wave_status AS ENUM ('draft','released','in_progress','completed');
CREATE TYPE public.wms_count_type AS ENUM ('scheduled','trigger','abc');
CREATE TYPE public.wms_count_status AS ENUM ('planned','in_progress','completed','reconciled');
CREATE TYPE public.wms_count_line_status AS ENUM ('pending','counted','recounted','approved');
CREATE TYPE public.wms_slotting_status AS ENUM ('draft','analyzing','completed');
CREATE TYPE public.wms_slotting_move_status AS ENUM ('proposed','approved','executed','skipped');

-- Helper: tenant admin check reused across all WMS tables
-- Pattern: SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'

-- 2. wms_zones
CREATE TABLE public.wms_zones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
  name TEXT NOT NULL, code TEXT NOT NULL,
  zone_type public.wms_zone_type NOT NULL DEFAULT 'reserve',
  pick_method public.wms_pick_method NOT NULL DEFAULT 'each',
  is_active BOOLEAN NOT NULL DEFAULT true, sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, warehouse_id, code)
);
ALTER TABLE public.wms_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sel_wms_zones" ON public.wms_zones FOR SELECT TO authenticated USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "sa_wms_zones" ON public.wms_zones FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "adm_wms_zones" ON public.wms_zones FOR ALL TO authenticated USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'));

-- 3. wms_aisles
CREATE TABLE public.wms_aisles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  zone_id UUID NOT NULL REFERENCES public.wms_zones(id) ON DELETE CASCADE,
  name TEXT NOT NULL, code TEXT NOT NULL, sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, zone_id, code)
);
ALTER TABLE public.wms_aisles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sel_wms_aisles" ON public.wms_aisles FOR SELECT TO authenticated USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "sa_wms_aisles" ON public.wms_aisles FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "adm_wms_aisles" ON public.wms_aisles FOR ALL TO authenticated USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'));

-- 4. wms_bins
CREATE TABLE public.wms_bins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
  zone_id UUID NOT NULL REFERENCES public.wms_zones(id),
  aisle_id UUID REFERENCES public.wms_aisles(id),
  code TEXT NOT NULL, bin_type public.wms_bin_type NOT NULL DEFAULT 'bin',
  max_volume NUMERIC, max_weight NUMERIC, max_units INT,
  level INT NOT NULL DEFAULT 1, accessibility_score INT NOT NULL DEFAULT 5 CHECK (accessibility_score BETWEEN 1 AND 10),
  restrictions JSONB DEFAULT '{}', is_active BOOLEAN NOT NULL DEFAULT true, sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, warehouse_id, code)
);
ALTER TABLE public.wms_bins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sel_wms_bins" ON public.wms_bins FOR SELECT TO authenticated USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "sa_wms_bins" ON public.wms_bins FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "adm_wms_bins" ON public.wms_bins FOR ALL TO authenticated USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'));

-- 5. wms_bin_stock
CREATE TABLE public.wms_bin_stock (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  bin_id UUID NOT NULL REFERENCES public.wms_bins(id),
  product_id UUID NOT NULL REFERENCES public.products(id),
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
  quantity NUMERIC NOT NULL DEFAULT 0, lot_number TEXT,
  status public.wms_bin_stock_status NOT NULL DEFAULT 'available',
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_wms_bin_stock ON public.wms_bin_stock (bin_id, product_id, COALESCE(lot_number, ''), status);
ALTER TABLE public.wms_bin_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sel_wms_bin_stock" ON public.wms_bin_stock FOR SELECT TO authenticated USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "sa_wms_bin_stock" ON public.wms_bin_stock FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "adm_wms_bin_stock" ON public.wms_bin_stock FOR ALL TO authenticated USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'));

-- 6. wms_tasks
CREATE TABLE public.wms_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
  task_number TEXT NOT NULL DEFAULT '', task_type public.wms_task_type NOT NULL,
  status public.wms_task_status NOT NULL DEFAULT 'pending',
  priority INT NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  product_id UUID REFERENCES public.products(id), quantity NUMERIC,
  from_bin_id UUID REFERENCES public.wms_bins(id), to_bin_id UUID REFERENCES public.wms_bins(id),
  order_reference TEXT, assigned_to UUID, assigned_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ,
  notes TEXT, exception_reason TEXT, created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.wms_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sel_wms_tasks" ON public.wms_tasks FOR SELECT TO authenticated USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "sa_wms_tasks" ON public.wms_tasks FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "adm_wms_tasks" ON public.wms_tasks FOR ALL TO authenticated USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'));

CREATE OR REPLACE FUNCTION public.generate_wms_task_number() RETURNS TRIGGER AS $$
DECLARE seq_num INT; yr TEXT;
BEGIN
  yr := to_char(now(), 'YYYY');
  SELECT COALESCE(MAX(CAST(NULLIF(split_part(task_number, '-', 3), '') AS INT)), 0) + 1
  INTO seq_num FROM public.wms_tasks WHERE tenant_id = NEW.tenant_id AND task_number LIKE 'TSK-' || yr || '-%';
  NEW.task_number := 'TSK-' || yr || '-' || LPAD(seq_num::TEXT, 4, '0');
  RETURN NEW;
END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_wms_task_number BEFORE INSERT ON public.wms_tasks
FOR EACH ROW WHEN (NEW.task_number IS NULL OR NEW.task_number = '') EXECUTE FUNCTION public.generate_wms_task_number();

-- 7. wms_putaway_rules
CREATE TABLE public.wms_putaway_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
  product_category TEXT, target_zone_id UUID NOT NULL REFERENCES public.wms_zones(id),
  priority INT NOT NULL DEFAULT 10, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.wms_putaway_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sel_wms_putaway_rules" ON public.wms_putaway_rules FOR SELECT TO authenticated USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "sa_wms_putaway_rules" ON public.wms_putaway_rules FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "adm_wms_putaway_rules" ON public.wms_putaway_rules FOR ALL TO authenticated USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'));

-- 8. wms_pick_waves
CREATE TABLE public.wms_pick_waves (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
  wave_number TEXT NOT NULL DEFAULT '', status public.wms_wave_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), completed_at TIMESTAMPTZ
);
ALTER TABLE public.wms_pick_waves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sel_wms_pick_waves" ON public.wms_pick_waves FOR SELECT TO authenticated USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "sa_wms_pick_waves" ON public.wms_pick_waves FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "adm_wms_pick_waves" ON public.wms_pick_waves FOR ALL TO authenticated USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'));

CREATE OR REPLACE FUNCTION public.generate_wms_wave_number() RETURNS TRIGGER AS $$
DECLARE seq_num INT; yr TEXT;
BEGIN
  yr := to_char(now(), 'YYYY');
  SELECT COALESCE(MAX(CAST(NULLIF(split_part(wave_number, '-', 3), '') AS INT)), 0) + 1
  INTO seq_num FROM public.wms_pick_waves WHERE tenant_id = NEW.tenant_id AND wave_number LIKE 'WAV-' || yr || '-%';
  NEW.wave_number := 'WAV-' || yr || '-' || LPAD(seq_num::TEXT, 4, '0');
  RETURN NEW;
END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_wms_wave_number BEFORE INSERT ON public.wms_pick_waves
FOR EACH ROW WHEN (NEW.wave_number IS NULL OR NEW.wave_number = '') EXECUTE FUNCTION public.generate_wms_wave_number();

-- 9. wms_pick_wave_orders
CREATE TABLE public.wms_pick_wave_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  wave_id UUID NOT NULL REFERENCES public.wms_pick_waves(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.sales_orders(id),
  status TEXT NOT NULL DEFAULT 'pending', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.wms_pick_wave_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sel_wms_pick_wave_orders" ON public.wms_pick_wave_orders FOR SELECT TO authenticated USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "sa_wms_pick_wave_orders" ON public.wms_pick_wave_orders FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "adm_wms_pick_wave_orders" ON public.wms_pick_wave_orders FOR ALL TO authenticated USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'));

-- 10. wms_cycle_counts
CREATE TABLE public.wms_cycle_counts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
  count_number TEXT NOT NULL DEFAULT '', count_type public.wms_count_type NOT NULL DEFAULT 'scheduled',
  status public.wms_count_status NOT NULL DEFAULT 'planned',
  zone_id UUID REFERENCES public.wms_zones(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), completed_at TIMESTAMPTZ
);
ALTER TABLE public.wms_cycle_counts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sel_wms_cycle_counts" ON public.wms_cycle_counts FOR SELECT TO authenticated USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "sa_wms_cycle_counts" ON public.wms_cycle_counts FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "adm_wms_cycle_counts" ON public.wms_cycle_counts FOR ALL TO authenticated USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'));

CREATE OR REPLACE FUNCTION public.generate_wms_count_number() RETURNS TRIGGER AS $$
DECLARE seq_num INT; yr TEXT;
BEGIN
  yr := to_char(now(), 'YYYY');
  SELECT COALESCE(MAX(CAST(NULLIF(split_part(count_number, '-', 3), '') AS INT)), 0) + 1
  INTO seq_num FROM public.wms_cycle_counts WHERE tenant_id = NEW.tenant_id AND count_number LIKE 'CNT-' || yr || '-%';
  NEW.count_number := 'CNT-' || yr || '-' || LPAD(seq_num::TEXT, 4, '0');
  RETURN NEW;
END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_wms_count_number BEFORE INSERT ON public.wms_cycle_counts
FOR EACH ROW WHEN (NEW.count_number IS NULL OR NEW.count_number = '') EXECUTE FUNCTION public.generate_wms_count_number();

-- 11. wms_cycle_count_lines
CREATE TABLE public.wms_cycle_count_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  count_id UUID NOT NULL REFERENCES public.wms_cycle_counts(id) ON DELETE CASCADE,
  bin_id UUID NOT NULL REFERENCES public.wms_bins(id),
  product_id UUID NOT NULL REFERENCES public.products(id),
  expected_quantity NUMERIC NOT NULL DEFAULT 0, counted_quantity NUMERIC,
  variance NUMERIC GENERATED ALWAYS AS (COALESCE(counted_quantity, 0) - expected_quantity) STORED,
  status public.wms_count_line_status NOT NULL DEFAULT 'pending',
  counted_by UUID, counted_at TIMESTAMPTZ, approved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.wms_cycle_count_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sel_wms_ccl" ON public.wms_cycle_count_lines FOR SELECT TO authenticated USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "sa_wms_ccl" ON public.wms_cycle_count_lines FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "adm_wms_ccl" ON public.wms_cycle_count_lines FOR ALL TO authenticated USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'));

-- 12. wms_slotting_scenarios
CREATE TABLE public.wms_slotting_scenarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
  name TEXT NOT NULL, parameters JSONB NOT NULL DEFAULT '{}',
  status public.wms_slotting_status NOT NULL DEFAULT 'draft',
  results JSONB DEFAULT '[]', estimated_improvement JSONB DEFAULT '{}',
  created_by UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.wms_slotting_scenarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sel_wms_ss" ON public.wms_slotting_scenarios FOR SELECT TO authenticated USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "sa_wms_ss" ON public.wms_slotting_scenarios FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "adm_wms_ss" ON public.wms_slotting_scenarios FOR ALL TO authenticated USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'));

-- 13. wms_slotting_moves
CREATE TABLE public.wms_slotting_moves (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  scenario_id UUID NOT NULL REFERENCES public.wms_slotting_scenarios(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  from_bin_id UUID NOT NULL REFERENCES public.wms_bins(id),
  to_bin_id UUID NOT NULL REFERENCES public.wms_bins(id),
  quantity NUMERIC NOT NULL DEFAULT 0, priority INT NOT NULL DEFAULT 3,
  task_id UUID REFERENCES public.wms_tasks(id),
  status public.wms_slotting_move_status NOT NULL DEFAULT 'proposed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.wms_slotting_moves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sel_wms_sm" ON public.wms_slotting_moves FOR SELECT TO authenticated USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "sa_wms_sm" ON public.wms_slotting_moves FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "adm_wms_sm" ON public.wms_slotting_moves FOR ALL TO authenticated USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'));

-- 14. Indexes
CREATE INDEX idx_wms_zones_wh ON public.wms_zones(tenant_id, warehouse_id);
CREATE INDEX idx_wms_bins_zone ON public.wms_bins(tenant_id, zone_id);
CREATE INDEX idx_wms_bins_wh ON public.wms_bins(tenant_id, warehouse_id);
CREATE INDEX idx_wms_bin_stock_bin ON public.wms_bin_stock(bin_id);
CREATE INDEX idx_wms_bin_stock_prod ON public.wms_bin_stock(tenant_id, product_id);
CREATE INDEX idx_wms_tasks_st ON public.wms_tasks(tenant_id, status);
CREATE INDEX idx_wms_tasks_wh ON public.wms_tasks(tenant_id, warehouse_id);
CREATE INDEX idx_wms_ccl_count ON public.wms_cycle_count_lines(count_id);
CREATE INDEX idx_wms_sm_scenario ON public.wms_slotting_moves(scenario_id);
