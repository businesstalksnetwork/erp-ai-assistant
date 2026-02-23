
-- Step 1: Create the Uniprom tenant
INSERT INTO tenants (id, name, slug, plan, status, created_at)
VALUES (
  gen_random_uuid(),
  'Uniprom',
  'uniprom',
  'enterprise',
  'active',
  now()
)
RETURNING id;
