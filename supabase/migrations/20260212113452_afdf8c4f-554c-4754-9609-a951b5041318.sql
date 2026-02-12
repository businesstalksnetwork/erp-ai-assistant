
-- Step 1: Create the "AI IT Development" tenant
INSERT INTO public.tenants (name, slug, plan, status)
VALUES ('AI IT Development', 'ai-it-development', 'enterprise', 'active');

-- Step 2: Add Bogdan as tenant admin
INSERT INTO public.tenant_members (tenant_id, user_id, role, status)
SELECT t.id, '7b279f18-57db-4b52-aea5-e0d413a5bdaa', 'admin', 'active'
FROM public.tenants t WHERE t.slug = 'ai-it-development';

-- Step 3: Add admin role (if not already present)
INSERT INTO public.user_roles (user_id, role)
VALUES ('7b279f18-57db-4b52-aea5-e0d413a5bdaa', 'admin')
ON CONFLICT DO NOTHING;

-- Step 4: Create legal entity
INSERT INTO public.legal_entities (tenant_id, name, country)
SELECT t.id, 'AI IT Development', 'RS'
FROM public.tenants t WHERE t.slug = 'ai-it-development';
