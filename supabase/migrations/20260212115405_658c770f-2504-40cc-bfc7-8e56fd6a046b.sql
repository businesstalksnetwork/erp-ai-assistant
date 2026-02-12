
-- Step 1: Create SECURITY DEFINER helper to check admin membership without RLS
CREATE OR REPLACE FUNCTION public.is_tenant_admin(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE user_id = _user_id
      AND tenant_id = _tenant_id
      AND role = 'admin'
      AND status = 'active'
  )
$$;

-- Step 2: Replace the recursive policy
DROP POLICY IF EXISTS "Tenant admins can manage their members" ON public.tenant_members;

CREATE POLICY "Tenant admins can manage their members"
  ON public.tenant_members
  FOR ALL
  USING (public.is_tenant_admin(auth.uid(), tenant_id));
