
-- Step 2: Create legal entity for Uniprom
INSERT INTO legal_entities (tenant_id, name, country, created_at)
VALUES (
  '7774c25d-d9c0-4b26-a9eb-983f28cac822',
  'Uniprom',
  'RS',
  now()
);

-- Step 3: Enable all enterprise modules for Uniprom
INSERT INTO tenant_modules (tenant_id, module_id, is_enabled)
SELECT '7774c25d-d9c0-4b26-a9eb-983f28cac822', id, true
FROM module_definitions
ON CONFLICT DO NOTHING;
