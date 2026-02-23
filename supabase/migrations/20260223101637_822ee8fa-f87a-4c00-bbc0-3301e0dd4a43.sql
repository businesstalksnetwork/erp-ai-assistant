
-- Phase 1: Add CRM fields to partners table
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS website text;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Phase 2a: Create partner_category_assignments (mirrors company_category_assignments)
CREATE TABLE IF NOT EXISTS public.partner_category_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.company_categories(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  UNIQUE(partner_id, category_id)
);

ALTER TABLE public.partner_category_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view partner categories"
  ON public.partner_category_assignments FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant members can insert partner categories"
  ON public.partner_category_assignments FOR INSERT
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant members can delete partner categories"
  ON public.partner_category_assignments FOR DELETE
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- Phase 2b: Add partner_id to activities table
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES public.partners(id);

-- Phase 2c: Add partner_id to contact_company_assignments table
ALTER TABLE public.contact_company_assignments ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES public.partners(id);

-- Phase 5: Data migration - sync existing companies to partners
-- For companies WITH a partner_id, migrate their categories
INSERT INTO public.partner_category_assignments (partner_id, category_id, tenant_id)
SELECT c.partner_id, cca.category_id, cca.tenant_id
FROM public.company_category_assignments cca
JOIN public.companies c ON c.id = cca.company_id
WHERE c.partner_id IS NOT NULL
ON CONFLICT (partner_id, category_id) DO NOTHING;

-- Migrate activities from company_id to partner_id
UPDATE public.activities a
SET partner_id = c.partner_id
FROM public.companies c
WHERE a.company_id = c.id AND c.partner_id IS NOT NULL AND a.partner_id IS NULL;

-- Migrate contact assignments to partner_id
UPDATE public.contact_company_assignments cca
SET partner_id = c.partner_id
FROM public.companies c
WHERE cca.company_id = c.id AND c.partner_id IS NOT NULL AND cca.partner_id IS NULL;

-- Copy CRM fields from companies to their linked partners
UPDATE public.partners p
SET 
  display_name = COALESCE(p.display_name, c.display_name),
  website = COALESCE(p.website, c.website),
  notes = COALESCE(p.notes, c.notes)
FROM public.companies c
WHERE c.partner_id = p.id;

-- For companies WITHOUT a partner_id, create partner records
INSERT INTO public.partners (tenant_id, name, pib, maticni_broj, address, city, postal_code, country, type, email, phone, display_name, website, notes, status)
SELECT c.tenant_id, c.legal_name, c.pib, c.maticni_broj, c.address, c.city, c.postal_code, 
  COALESCE(c.country, 'RS'), 'customer', c.email, c.phone, c.display_name, c.website, c.notes,
  COALESCE(c.status, 'active')
FROM public.companies c
WHERE c.partner_id IS NULL;

-- Link the newly created partners back to companies
UPDATE public.companies c
SET partner_id = p.id
FROM public.partners p
WHERE c.partner_id IS NULL AND p.tenant_id = c.tenant_id AND p.name = c.legal_name AND p.pib = c.pib;

-- Now migrate categories for the newly linked companies too
INSERT INTO public.partner_category_assignments (partner_id, category_id, tenant_id)
SELECT c.partner_id, cca.category_id, cca.tenant_id
FROM public.company_category_assignments cca
JOIN public.companies c ON c.id = cca.company_id
WHERE c.partner_id IS NOT NULL
ON CONFLICT (partner_id, category_id) DO NOTHING;
