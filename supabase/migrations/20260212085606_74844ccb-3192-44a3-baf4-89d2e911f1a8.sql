
-- Fix: restrict audit_log inserts to the user's own tenant or super admin
DROP POLICY "Authenticated can insert audit log" ON public.audit_log;
CREATE POLICY "Users can insert audit log for their tenants" ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    OR public.is_super_admin(auth.uid())
  );
