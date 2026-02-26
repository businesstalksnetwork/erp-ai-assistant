
-- Step 1: Add assets module definition
INSERT INTO module_definitions (key, name, description, sort_order)
VALUES ('assets', 'Assets & Fleet', 'Fixed assets registry, depreciation, fleet management', 11)
ON CONFLICT (key) DO NOTHING;

-- Step 2: Seed tenant_modules for all existing tenants
INSERT INTO tenant_modules (tenant_id, module_id, is_enabled)
SELECT t.id, md.id, true
FROM tenants t
CROSS JOIN module_definitions md
WHERE md.key = 'assets'
ON CONFLICT (tenant_id, module_id) DO NOTHING;
