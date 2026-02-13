
-- Get max sort_order to append new modules
-- Insert missing module definitions
INSERT INTO public.module_definitions (key, name, description, sort_order)
VALUES 
  ('purchasing', 'Purchasing', 'Purchase orders and supplier management', (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM public.module_definitions)),
  ('returns', 'Returns', 'Return cases and credit notes', (SELECT COALESCE(MAX(sort_order), 0) + 2 FROM public.module_definitions))
ON CONFLICT (key) DO NOTHING;

-- Rename dms -> documents key (and update any tenant_modules references via cascade)
-- First update tenant_modules that reference the old module_definition
UPDATE public.tenant_modules
SET module_id = (SELECT id FROM public.module_definitions WHERE key = 'documents' LIMIT 1)
WHERE module_id = (SELECT id FROM public.module_definitions WHERE key = 'dms' LIMIT 1)
  AND EXISTS (SELECT 1 FROM public.module_definitions WHERE key = 'documents');

-- Now rename the key (only if 'documents' doesn't already exist separately)
UPDATE public.module_definitions
SET key = 'documents', name = 'Documents'
WHERE key = 'dms'
  AND NOT EXISTS (SELECT 1 FROM public.module_definitions WHERE key = 'documents');
