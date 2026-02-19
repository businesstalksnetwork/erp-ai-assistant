INSERT INTO tenant_modules (tenant_id, module_id, is_enabled)
SELECT 
  t.id,
  md.id,
  true
FROM tenants t
CROSS JOIN module_definitions md
WHERE t.name = 'Uniprom'
  AND md.key = 'analytics'
  AND NOT EXISTS (
    SELECT 1 FROM tenant_modules tm 
    WHERE tm.tenant_id = t.id AND tm.module_id = md.id
  );