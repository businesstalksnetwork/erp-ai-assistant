
-- Fix overly permissive INSERT policies on new tables
-- Edge functions use service_role which bypasses RLS, so client inserts should be restricted

DROP POLICY "security_events_insert" ON public.security_events;
CREATE POLICY "security_events_insert" ON public.security_events
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND (tenant_id IS NULL OR tenant_id IN (SELECT get_user_tenant_ids(auth.uid())))
  );

DROP POLICY "secret_rotation_log_insert" ON public.secret_rotation_log;
CREATE POLICY "secret_rotation_log_insert" ON public.secret_rotation_log
  FOR INSERT WITH CHECK (
    public.is_super_admin(auth.uid())
  );
