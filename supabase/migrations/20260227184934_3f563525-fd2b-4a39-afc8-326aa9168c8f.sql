
-- Step 1a: Create data_scope enum
DO $$ BEGIN
  CREATE TYPE public.data_scope_type AS ENUM ('all', 'department', 'own');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Step 1b: Add data_scope column to tenant_members
ALTER TABLE public.tenant_members
  ADD COLUMN IF NOT EXISTS data_scope public.data_scope_type NOT NULL DEFAULT 'all';

-- Step 1c: Create tenant_role_permissions table
CREATE TABLE IF NOT EXISTS public.tenant_role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  module text NOT NULL,
  action text NOT NULL,
  allowed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, role, module, action)
);

CREATE INDEX IF NOT EXISTS idx_trp_tenant_role ON public.tenant_role_permissions(tenant_id, role);

-- RLS on tenant_role_permissions
ALTER TABLE public.tenant_role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view permissions"
  ON public.tenant_role_permissions FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Admins can manage permissions"
  ON public.tenant_role_permissions FOR ALL TO authenticated
  USING (
    tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
    AND (
      public.is_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.tenant_members
        WHERE user_id = auth.uid() AND tenant_id = tenant_role_permissions.tenant_id
          AND role IN ('admin') AND status = 'active'
      )
    )
  )
  WITH CHECK (
    tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
    AND (
      public.is_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.tenant_members
        WHERE user_id = auth.uid() AND tenant_id = tenant_role_permissions.tenant_id
          AND role IN ('admin') AND status = 'active'
      )
    )
  );

-- Step 1d: Security-definer helper — has_action_permission
-- Falls back to hardcoded defaults if no rows exist for the tenant
CREATE OR REPLACE FUNCTION public.has_action_permission(
  p_user_id uuid,
  p_tenant_id uuid,
  p_module text,
  p_action text
) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.app_role;
  v_allowed boolean;
  v_has_rows boolean;
  v_default_modules text[];
BEGIN
  -- Super admins bypass
  IF public.is_super_admin(p_user_id) THEN RETURN true; END IF;

  -- Get user role in tenant
  SELECT role INTO v_role
  FROM public.tenant_members
  WHERE user_id = p_user_id AND tenant_id = p_tenant_id AND status = 'active'
  LIMIT 1;

  IF v_role IS NULL THEN RETURN false; END IF;

  -- Check if tenant has any custom permissions
  SELECT EXISTS(
    SELECT 1 FROM public.tenant_role_permissions WHERE tenant_id = p_tenant_id LIMIT 1
  ) INTO v_has_rows;

  IF v_has_rows THEN
    -- Use custom permissions
    SELECT trp.allowed INTO v_allowed
    FROM public.tenant_role_permissions trp
    WHERE trp.tenant_id = p_tenant_id AND trp.role = v_role
      AND trp.module = p_module AND trp.action = p_action;

    -- If no specific row, deny
    RETURN COALESCE(v_allowed, false);
  ELSE
    -- Fallback to hardcoded defaults: check if role has module access
    -- and grant all standard actions (view/create/edit/delete) by default
    CASE v_role::text
      WHEN 'admin' THEN v_default_modules := ARRAY['dashboard','crm','sales','web','purchasing','inventory','accounting','analytics','hr','production','documents','pos','returns','assets','settings'];
      WHEN 'manager' THEN v_default_modules := ARRAY['dashboard','crm','sales','web','purchasing','inventory','returns','production','documents','pos','analytics','assets','settings'];
      WHEN 'accountant' THEN v_default_modules := ARRAY['dashboard','accounting','analytics','assets','settings'];
      WHEN 'sales' THEN v_default_modules := ARRAY['dashboard','crm','sales','web','inventory','documents'];
      WHEN 'hr' THEN v_default_modules := ARRAY['dashboard','hr','documents'];
      WHEN 'store' THEN v_default_modules := ARRAY['dashboard','crm','sales','inventory','pos','returns','assets'];
      WHEN 'user' THEN v_default_modules := ARRAY['dashboard','documents','pos'];
      ELSE v_default_modules := ARRAY['dashboard'];
    END CASE;

    IF p_module = ANY(v_default_modules) AND p_action IN ('view','create','edit','delete') THEN
      RETURN true;
    END IF;
    RETURN false;
  END IF;
END;
$$;

-- Step 1e: Security-definer helper — get_member_data_scope
CREATE OR REPLACE FUNCTION public.get_member_data_scope(
  p_user_id uuid,
  p_tenant_id uuid
) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(data_scope::text, 'all')
  FROM public.tenant_members
  WHERE user_id = p_user_id AND tenant_id = p_tenant_id AND status = 'active'
  LIMIT 1;
$$;

-- Step 1f: Security-definer helper — get_member_department_ids
CREATE OR REPLACE FUNCTION public.get_member_department_ids(
  p_user_id uuid,
  p_tenant_id uuid
) RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    array_agg(e.department_id),
    ARRAY[]::uuid[]
  )
  FROM public.employees e
  WHERE e.user_id = p_user_id
    AND e.tenant_id = p_tenant_id
    AND e.department_id IS NOT NULL;
$$;

-- Step 1g: Seed default permissions for all existing tenants
INSERT INTO public.tenant_role_permissions (tenant_id, role, module, action, allowed)
SELECT t.id, r.role, m.module, a.action, true
FROM public.tenants t
CROSS JOIN (VALUES
  ('admin'::app_role), ('manager'::app_role), ('accountant'::app_role),
  ('sales'::app_role), ('hr'::app_role), ('store'::app_role), ('user'::app_role)
) AS r(role)
CROSS JOIN (VALUES
  ('dashboard'), ('crm'), ('sales'), ('web'), ('purchasing'), ('inventory'),
  ('accounting'), ('analytics'), ('hr'), ('production'), ('documents'),
  ('pos'), ('returns'), ('assets'), ('settings')
) AS m(module)
CROSS JOIN (VALUES ('view'), ('create'), ('edit'), ('delete'), ('approve'), ('export')) AS a(action)
WHERE CASE r.role::text
  WHEN 'admin' THEN true
  WHEN 'manager' THEN m.module IN ('dashboard','crm','sales','web','purchasing','inventory','returns','production','documents','pos','analytics','assets','settings')
  WHEN 'accountant' THEN m.module IN ('dashboard','accounting','analytics','assets','settings')
  WHEN 'sales' THEN m.module IN ('dashboard','crm','sales','web','inventory','documents')
  WHEN 'hr' THEN m.module IN ('dashboard','hr','documents')
  WHEN 'store' THEN m.module IN ('dashboard','crm','sales','inventory','pos','returns','assets')
  WHEN 'user' THEN m.module IN ('dashboard','documents','pos')
  ELSE false
END
ON CONFLICT (tenant_id, role, module, action) DO NOTHING;

-- Trigger for updated_at
CREATE TRIGGER update_tenant_role_permissions_updated_at
  BEFORE UPDATE ON public.tenant_role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
