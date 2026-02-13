-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;

-- Replace with tenant-scoped, user-scoped insert policy
CREATE POLICY "Users can insert notifications for themselves"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
);