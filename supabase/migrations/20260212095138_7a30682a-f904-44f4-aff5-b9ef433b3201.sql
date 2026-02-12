
-- Function to seed default Serbian tax rates for a tenant
CREATE OR REPLACE FUNCTION public.seed_tenant_tax_rates(_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.tax_rates (tenant_id, name, name_sr, rate, is_default, is_active)
  VALUES
    (_tenant_id, 'General Rate (20%)', 'Opšta stopa (20%)', 20, true, true),
    (_tenant_id, 'Reduced Rate (10%)', 'Posebna stopa (10%)', 10, false, true),
    (_tenant_id, 'Exempt (0%)', 'Oslobođeno od PDV-a (0%)', 0, false, true)
  ON CONFLICT DO NOTHING;
END;
$$;

-- Trigger function to auto-seed on tenant creation
CREATE OR REPLACE FUNCTION public.trigger_seed_tax_rates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.seed_tenant_tax_rates(NEW.id);
  RETURN NEW;
END;
$$;

-- Create trigger on tenants table
CREATE TRIGGER seed_tax_rates_on_tenant_create
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_seed_tax_rates();

-- Backfill: seed rates for all existing tenants that don't have any yet
DO $$
DECLARE
  t_id uuid;
BEGIN
  FOR t_id IN
    SELECT id FROM public.tenants
    WHERE id NOT IN (SELECT DISTINCT tenant_id FROM public.tax_rates)
  LOOP
    PERFORM public.seed_tenant_tax_rates(t_id);
  END LOOP;
END;
$$;
