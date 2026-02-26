
-- =============================================
-- Phase 5: Fleet Management Tables
-- =============================================

-- 1. Fleet Vehicles (extension of assets for vehicle-specific data)
CREATE TABLE public.fleet_vehicles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  registration_plate TEXT,
  vin TEXT,
  make TEXT,
  model TEXT,
  year_of_manufacture INTEGER,
  engine_type TEXT DEFAULT 'diesel', -- diesel, petrol, electric, hybrid, lpg
  engine_capacity_cc INTEGER,
  engine_power_kw NUMERIC(8,2),
  fuel_tank_capacity_l NUMERIC(8,2),
  odometer_km NUMERIC(12,2) DEFAULT 0,
  color TEXT,
  seat_count INTEGER DEFAULT 5,
  vehicle_class TEXT, -- passenger, cargo, special
  is_company_car BOOLEAN DEFAULT true,
  assigned_driver_id UUID REFERENCES public.employees(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, asset_id)
);

ALTER TABLE public.fleet_vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.fleet_vehicles
  FOR ALL USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE INDEX idx_fleet_vehicles_asset ON public.fleet_vehicles(asset_id);
CREATE INDEX idx_fleet_vehicles_plate ON public.fleet_vehicles(tenant_id, registration_plate);

-- 2. Fleet Registrations
CREATE TABLE public.fleet_registrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID NOT NULL REFERENCES public.fleet_vehicles(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  registration_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  registration_number TEXT,
  inspection_date DATE,
  inspection_expiry DATE,
  cost NUMERIC(15,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fleet_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.fleet_registrations
  FOR ALL USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- 3. Fleet Insurance
CREATE TABLE public.fleet_insurance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID NOT NULL REFERENCES public.fleet_vehicles(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  insurance_type TEXT NOT NULL DEFAULT 'mandatory', -- mandatory, casco, combined
  policy_number TEXT,
  insurer TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  premium_amount NUMERIC(15,2) DEFAULT 0,
  currency TEXT DEFAULT 'RSD',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fleet_insurance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.fleet_insurance
  FOR ALL USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- 4. Fleet Fuel Logs
CREATE TABLE public.fleet_fuel_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID NOT NULL REFERENCES public.fleet_vehicles(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  fuel_type TEXT DEFAULT 'diesel',
  quantity_liters NUMERIC(10,2) NOT NULL,
  price_per_liter NUMERIC(10,4),
  total_cost NUMERIC(15,2) NOT NULL,
  odometer_km NUMERIC(12,2),
  station_name TEXT,
  receipt_number TEXT,
  driver_id UUID REFERENCES public.employees(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fleet_fuel_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.fleet_fuel_logs
  FOR ALL USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE INDEX idx_fleet_fuel_logs_vehicle ON public.fleet_fuel_logs(vehicle_id, log_date DESC);

-- 5. Fleet Service Orders
CREATE TABLE public.fleet_service_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID NOT NULL REFERENCES public.fleet_vehicles(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  order_number TEXT NOT NULL,
  service_type TEXT DEFAULT 'regular', -- regular, repair, inspection, tires, other
  status TEXT DEFAULT 'planned', -- planned, in_progress, completed, cancelled
  planned_date DATE,
  completed_date DATE,
  odometer_km NUMERIC(12,2),
  service_provider TEXT,
  description TEXT,
  labor_cost NUMERIC(15,2) DEFAULT 0,
  parts_cost NUMERIC(15,2) DEFAULT 0,
  total_cost NUMERIC(15,2) DEFAULT 0,
  currency TEXT DEFAULT 'RSD',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fleet_service_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.fleet_service_orders
  FOR ALL USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE INDEX idx_fleet_service_orders_vehicle ON public.fleet_service_orders(vehicle_id);

-- Triggers for updated_at
CREATE TRIGGER update_fleet_vehicles_updated_at BEFORE UPDATE ON public.fleet_vehicles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_fleet_registrations_updated_at BEFORE UPDATE ON public.fleet_registrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_fleet_insurance_updated_at BEFORE UPDATE ON public.fleet_insurance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_fleet_service_orders_updated_at BEFORE UPDATE ON public.fleet_service_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
