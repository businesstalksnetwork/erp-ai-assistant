-- Create table for tracking long-running SEF sync jobs
CREATE TABLE public.sef_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  invoice_type TEXT NOT NULL DEFAULT 'purchase',
  total_months INTEGER NOT NULL DEFAULT 36,
  processed_months INTEGER NOT NULL DEFAULT 0,
  current_month TEXT,
  invoices_found INTEGER NOT NULL DEFAULT 0,
  invoices_saved INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for quick lookup of active jobs
CREATE INDEX idx_sef_sync_jobs_company_status ON sef_sync_jobs(company_id, status);

-- Enable RLS
ALTER TABLE sef_sync_jobs ENABLE ROW LEVEL SECURITY;

-- Users can view their company sync jobs
CREATE POLICY "Users can view own company sync jobs"
ON sef_sync_jobs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM companies 
    WHERE companies.id = sef_sync_jobs.company_id 
    AND companies.user_id = auth.uid()
  ) AND is_approved(auth.uid())
);

-- Users can insert sync jobs for their companies
CREATE POLICY "Users can create own company sync jobs"
ON sef_sync_jobs FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM companies 
    WHERE companies.id = sef_sync_jobs.company_id 
    AND companies.user_id = auth.uid()
  ) AND is_approved(auth.uid())
);

-- Bookkeepers can view client sync jobs
CREATE POLICY "Bookkeepers can view client sync jobs"
ON sef_sync_jobs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = sef_sync_jobs.company_id 
    AND is_bookkeeper_for(c.user_id)
  ) AND is_approved(auth.uid())
);

-- Bookkeepers can create client sync jobs
CREATE POLICY "Bookkeepers can create client sync jobs"
ON sef_sync_jobs FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = sef_sync_jobs.company_id 
    AND is_bookkeeper_for(c.user_id)
  ) AND is_approved(auth.uid())
);

-- Service role can update jobs (for edge function)
CREATE POLICY "Service role can update sync jobs"
ON sef_sync_jobs FOR UPDATE
USING (true)
WITH CHECK (true);