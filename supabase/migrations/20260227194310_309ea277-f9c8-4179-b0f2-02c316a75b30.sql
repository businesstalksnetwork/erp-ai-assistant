
-- Phase 1.2: employee_locations junction table
CREATE TABLE public.employee_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, location_id)
);

CREATE INDEX idx_employee_locations_employee ON public.employee_locations(employee_id);
CREATE INDEX idx_employee_locations_location ON public.employee_locations(location_id);
CREATE INDEX idx_employee_locations_tenant ON public.employee_locations(tenant_id);

ALTER TABLE public.employee_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for employee_locations"
  ON public.employee_locations
  FOR ALL
  TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'
  ))
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'
  ));

-- Trigger: ensure only one primary location per employee
CREATE OR REPLACE FUNCTION public.ensure_single_primary_location()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_primary = true THEN
    UPDATE public.employee_locations
    SET is_primary = false
    WHERE employee_id = NEW.employee_id AND id != NEW.id AND is_primary = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ensure_single_primary_location
  BEFORE INSERT OR UPDATE ON public.employee_locations
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_single_primary_location();

-- Migrate existing location_id data
INSERT INTO public.employee_locations (employee_id, location_id, is_primary, tenant_id)
SELECT id, location_id, true, tenant_id
FROM public.employees
WHERE location_id IS NOT NULL
ON CONFLICT (employee_id, location_id) DO NOTHING;
