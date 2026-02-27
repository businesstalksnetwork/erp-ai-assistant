
-- Phase 1: Org Hierarchy — Add parent-child and cross-linking columns

-- 1. Companies: parent hierarchy
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_companies_parent_id ON public.companies(parent_id);

-- 2. Departments: parent hierarchy
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_departments_parent_id ON public.departments(parent_id);

-- 3. Locations: parent hierarchy + company link
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.locations(id) ON DELETE SET NULL;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_locations_parent_id ON public.locations(parent_id);
CREATE INDEX IF NOT EXISTS idx_locations_company_id ON public.locations(company_id);

-- 4. Position Templates: department link + reporting structure
ALTER TABLE public.position_templates ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE public.position_templates ADD COLUMN IF NOT EXISTS reports_to_position_id uuid REFERENCES public.position_templates(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_position_templates_department_id ON public.position_templates(department_id);
CREATE INDEX IF NOT EXISTS idx_position_templates_reports_to ON public.position_templates(reports_to_position_id);
