-- Remove overly permissive UPDATE policy (service role bypasses RLS anyway)
DROP POLICY IF EXISTS "Service role can update sync jobs" ON sef_sync_jobs;

-- Add proper UPDATE policy for users
CREATE POLICY "Users can update own company sync jobs"
ON sef_sync_jobs FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM companies 
    WHERE companies.id = sef_sync_jobs.company_id 
    AND companies.user_id = auth.uid()
  ) AND is_approved(auth.uid())
);

-- Bookkeepers can update client sync jobs
CREATE POLICY "Bookkeepers can update client sync jobs"
ON sef_sync_jobs FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = sef_sync_jobs.company_id 
    AND is_bookkeeper_for(c.user_id)
  ) AND is_approved(auth.uid())
);