
-- Phase 1.1: Add manager_id + org_level to employees
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS org_level INT NOT NULL DEFAULT 3;

CREATE INDEX IF NOT EXISTS idx_employees_manager_id ON public.employees(manager_id);
CREATE INDEX IF NOT EXISTS idx_employees_org_level ON public.employees(org_level);

-- Get direct reports for a manager
CREATE OR REPLACE FUNCTION public.get_direct_reports(p_manager_id UUID)
RETURNS SETOF public.employees
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.employees WHERE manager_id = p_manager_id;
$$;

-- Get all subordinates recursively
CREATE OR REPLACE FUNCTION public.get_all_subordinates(p_manager_id UUID)
RETURNS SETOF public.employees
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE subordinates AS (
    SELECT * FROM public.employees WHERE manager_id = p_manager_id
    UNION ALL
    SELECT e.* FROM public.employees e
    INNER JOIN subordinates s ON e.manager_id = s.id
  )
  SELECT * FROM subordinates;
$$;
