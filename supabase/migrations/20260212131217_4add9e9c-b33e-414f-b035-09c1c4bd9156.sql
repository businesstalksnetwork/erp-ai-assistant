
-- Phase 23: Complete CRM Module
-- New tables: companies, company_categories, company_category_assignments, contacts,
-- contact_company_assignments, meetings, meeting_types, meeting_participants, activities

-- ============ COMPANIES ============
CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  legal_name TEXT NOT NULL,
  display_name TEXT,
  pib VARCHAR(9),
  maticni_broj VARCHAR(8),
  is_internal BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','archived')),
  email TEXT,
  phone TEXT,
  website TEXT,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'Srbija',
  partner_id UUID REFERENCES public.partners(id),
  legal_entity_id UUID REFERENCES public.legal_entities(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_companies_tenant ON public.companies(tenant_id);
CREATE INDEX idx_companies_pib ON public.companies(pib);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members can view companies" ON public.companies FOR SELECT USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant members can insert companies" ON public.companies FOR INSERT WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant members can update companies" ON public.companies FOR UPDATE USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant members can delete companies" ON public.companies FOR DELETE USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- ============ COMPANY CATEGORIES ============
CREATE TABLE public.company_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  name_sr TEXT,
  code TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  parent_id UUID REFERENCES public.company_categories(id),
  is_system BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, code)
);
ALTER TABLE public.company_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members can manage company_categories" ON public.company_categories FOR ALL USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- ============ COMPANY CATEGORY ASSIGNMENTS ============
CREATE TABLE public.company_category_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.company_categories(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  UNIQUE(company_id, category_id)
);
ALTER TABLE public.company_category_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members can manage company_category_assignments" ON public.company_category_assignments FOR ALL USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- ============ CONTACTS ============
CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  first_name TEXT NOT NULL,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  type TEXT DEFAULT 'prospect' CHECK (type IN ('customer','supplier','prospect')),
  seniority_level TEXT CHECK (seniority_level IS NULL OR seniority_level IN ('c_level','executive','senior_manager','manager','senior','mid','junior','intern')),
  function_area TEXT CHECK (function_area IS NULL OR function_area IN ('management','sales','marketing','finance','hr','it','operations','legal','procurement','production','other')),
  company_name TEXT,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  country TEXT,
  website TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_contacts_tenant ON public.contacts(tenant_id);
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members can view contacts" ON public.contacts FOR SELECT USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant members can insert contacts" ON public.contacts FOR INSERT WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant members can update contacts" ON public.contacts FOR UPDATE USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant members can delete contacts" ON public.contacts FOR DELETE USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- ============ CONTACT-COMPANY ASSIGNMENTS ============
CREATE TABLE public.contact_company_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  job_title TEXT,
  department TEXT,
  is_primary BOOLEAN DEFAULT false,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.contact_company_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members can manage contact_company_assignments" ON public.contact_company_assignments FOR ALL USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- ============ MEETING TYPES ============
CREATE TABLE public.meeting_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  name_sr TEXT,
  color TEXT DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.meeting_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members can manage meeting_types" ON public.meeting_types FOR ALL USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- ============ MEETINGS ============
CREATE TABLE public.meetings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  title TEXT NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT DEFAULT 60,
  location TEXT,
  communication_channel TEXT DEFAULT 'in_person' CHECK (communication_channel IN ('in_person','video_call','phone_call','email','hybrid')),
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_progress','completed','cancelled')),
  meeting_type_id UUID REFERENCES public.meeting_types(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_meetings_tenant ON public.meetings(tenant_id);
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members can view meetings" ON public.meetings FOR SELECT USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant members can insert meetings" ON public.meetings FOR INSERT WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant members can update meetings" ON public.meetings FOR UPDATE USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant members can delete meetings" ON public.meetings FOR DELETE USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- ============ MEETING PARTICIPANTS ============
CREATE TABLE public.meeting_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id),
  employee_id UUID REFERENCES public.employees(id),
  company_id UUID REFERENCES public.companies(id),
  is_organizer BOOLEAN DEFAULT false,
  is_internal BOOLEAN DEFAULT false,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id)
);
ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members can manage meeting_participants" ON public.meeting_participants FOR ALL USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- ============ ACTIVITIES ============
CREATE TABLE public.activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  type TEXT NOT NULL,
  description TEXT,
  company_id UUID REFERENCES public.companies(id),
  contact_id UUID REFERENCES public.contacts(id),
  lead_id UUID REFERENCES public.leads(id),
  opportunity_id UUID REFERENCES public.opportunities(id),
  meeting_id UUID REFERENCES public.meetings(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_activities_tenant ON public.activities(tenant_id);
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members can manage activities" ON public.activities FOR ALL USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- ============ ALTER LEADS TABLE ============
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS job_title TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES public.contacts(id);
-- Migrate existing data
UPDATE public.leads SET first_name = name WHERE first_name IS NULL AND name IS NOT NULL;

-- ============ ALTER OPPORTUNITIES TABLE ============
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES public.contacts(id);
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS description TEXT;

-- ============ SEED COMPANY CATEGORIES (per-tenant trigger) ============
CREATE OR REPLACE FUNCTION public.seed_company_categories(_tenant_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.company_categories (tenant_id, name, name_sr, code, color, is_system, sort_order)
  VALUES
    (_tenant_id, 'Customer', 'Kupac', 'customer', '#22c55e', true, 1),
    (_tenant_id, 'Supplier', 'Dobavljač', 'supplier', '#3b82f6', true, 2),
    (_tenant_id, 'Partner', 'Partner', 'partner', '#8b5cf6', true, 3),
    (_tenant_id, 'Investor', 'Investitor', 'investor', '#f59e0b', true, 4),
    (_tenant_id, 'Contractor', 'Izvođač', 'contractor', '#ef4444', true, 5),
    (_tenant_id, 'Subcontractor', 'Podizvođač', 'subcontractor', '#ec4899', true, 6)
  ON CONFLICT (tenant_id, code) DO NOTHING;
END;
$$;

-- Trigger to auto-seed categories for new tenants
CREATE OR REPLACE FUNCTION public.trigger_seed_company_categories()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.seed_company_categories(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER seed_company_categories_on_tenant
AFTER INSERT ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.trigger_seed_company_categories();

-- Seed for existing tenants
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.tenants LOOP
    PERFORM public.seed_company_categories(r.id);
  END LOOP;
END;
$$;

-- Updated_at triggers
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_meetings_updated_at BEFORE UPDATE ON public.meetings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
