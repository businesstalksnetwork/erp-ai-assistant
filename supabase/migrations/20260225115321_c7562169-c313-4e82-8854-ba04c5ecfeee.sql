
-- Fix the broken seed function
CREATE OR REPLACE FUNCTION public.seed_tenant_chart_of_accounts(_tenant_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.chart_of_accounts (tenant_id, code, name, name_sr, account_type, is_active)
  VALUES (_tenant_id, '4701', 'VAT on Advances', 'ПДВ на аванс', 'liability', true)
  ON CONFLICT DO NOTHING;
END;
$$;

-- Now create the tenant
INSERT INTO tenants (name, slug, plan, status)
VALUES ('BCILITY DOO', 'bcility-doo', 'professional', 'trial');

-- Create legal entity
INSERT INTO legal_entities (tenant_id, name, city, country)
SELECT id, 'BCILITY DOO', 'Čačak', 'RS' FROM tenants WHERE slug = 'bcility-doo';

-- Add bogdan as admin tenant member
INSERT INTO tenant_members (tenant_id, user_id, role, status)
SELECT t.id, '7b279f18-57db-4b52-aea5-e0d413a5bdaa', 'admin', 'active'
FROM tenants t WHERE t.slug = 'bcility-doo';

-- Seed modules for professional plan
INSERT INTO tenant_modules (tenant_id, module_id, is_enabled)
SELECT t.id, md.id, true
FROM tenants t
CROSS JOIN module_definitions md
WHERE t.slug = 'bcility-doo'
  AND md.key IN ('accounting', 'sales', 'inventory', 'hr', 'crm');
