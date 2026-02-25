
-- 1. Seed location_types for all existing tenants (includes code column)
INSERT INTO public.location_types (tenant_id, name, code, has_warehouse, has_sellers)
SELECT t.id, lt.name, lt.code, lt.has_warehouse, lt.has_sellers
FROM public.tenants t
CROSS JOIN (VALUES
  ('Kancelarija', 'OFFICE', false, false),
  ('Prodavnica', 'SHOP', true, true),
  ('Magacin', 'WAREHOUSE', true, false),
  ('Proizvodnja', 'PRODUCTION', true, false)
) AS lt(name, code, has_warehouse, has_sellers)
WHERE NOT EXISTS (
  SELECT 1 FROM public.location_types x WHERE x.tenant_id = t.id AND x.code = lt.code
);

-- 2. Seed approval_workflows for all existing tenants
INSERT INTO public.approval_workflows (tenant_id, name, entity_type, threshold_amount, min_approvers, required_roles, is_active)
SELECT t.id, aw.name, aw.entity_type, aw.threshold_amount, aw.min_approvers, aw.required_roles, true
FROM public.tenants t
CROSS JOIN (VALUES
  ('Odobrenje fakture', 'invoice', 500000, 1, ARRAY['admin','manager']),
  ('Odobrenje naloga', 'journal_entry', 1000000, 1, ARRAY['admin','accountant']),
  ('Odobrenje nabavke', 'purchase_order', 200000, 1, ARRAY['admin','manager'])
) AS aw(name, entity_type, threshold_amount, min_approvers, required_roles)
WHERE NOT EXISTS (
  SELECT 1 FROM public.approval_workflows x WHERE x.tenant_id = t.id AND x.entity_type = aw.entity_type
);

-- 3. Seed discount_approval_rules for all existing tenants
INSERT INTO public.discount_approval_rules (tenant_id, role, max_discount_pct, requires_approval_above)
SELECT t.id, dr.role, dr.max_discount_pct, dr.requires_approval_above
FROM public.tenants t
CROSS JOIN (VALUES
  ('admin', 50.0, NULL::numeric),
  ('manager', 20.0, 15.0),
  ('sales', 10.0, 5.0),
  ('user', 5.0, 3.0)
) AS dr(role, max_discount_pct, requires_approval_above)
WHERE NOT EXISTS (
  SELECT 1 FROM public.discount_approval_rules x WHERE x.tenant_id = t.id AND x.role = dr.role
);

-- 4. Create or replace function to seed these defaults on new tenant creation
CREATE OR REPLACE FUNCTION public.seed_settings_defaults(p_tenant_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO location_types (tenant_id, name, code, has_warehouse, has_sellers) VALUES
    (p_tenant_id, 'Kancelarija', 'OFFICE', false, false),
    (p_tenant_id, 'Prodavnica', 'SHOP', true, true),
    (p_tenant_id, 'Magacin', 'WAREHOUSE', true, false),
    (p_tenant_id, 'Proizvodnja', 'PRODUCTION', true, false)
  ON CONFLICT DO NOTHING;

  INSERT INTO approval_workflows (tenant_id, name, entity_type, threshold_amount, min_approvers, required_roles, is_active) VALUES
    (p_tenant_id, 'Odobrenje fakture', 'invoice', 500000, 1, ARRAY['admin','manager'], true),
    (p_tenant_id, 'Odobrenje naloga', 'journal_entry', 1000000, 1, ARRAY['admin','accountant'], true),
    (p_tenant_id, 'Odobrenje nabavke', 'purchase_order', 200000, 1, ARRAY['admin','manager'], true)
  ON CONFLICT DO NOTHING;

  INSERT INTO discount_approval_rules (tenant_id, role, max_discount_pct, requires_approval_above) VALUES
    (p_tenant_id, 'admin', 50, NULL),
    (p_tenant_id, 'manager', 20, 15),
    (p_tenant_id, 'sales', 10, 5),
    (p_tenant_id, 'user', 5, 3)
  ON CONFLICT DO NOTHING;
END;
$$;

-- 5. Create trigger function that calls both DMS and settings defaults
CREATE OR REPLACE FUNCTION public.trigger_seed_all_defaults()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM seed_dms_defaults(NEW.id);
  PERFORM seed_settings_defaults(NEW.id);
  RETURN NEW;
EXCEPTION WHEN undefined_function THEN
  PERFORM seed_settings_defaults(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_dms_defaults ON public.tenants;
DROP TRIGGER IF EXISTS trg_seed_all_defaults ON public.tenants;
CREATE TRIGGER trg_seed_all_defaults
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION trigger_seed_all_defaults();
