-- Add updated_at column to sef_sync_jobs for tracking activity
ALTER TABLE sef_sync_jobs 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create trigger function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_sef_sync_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger
DROP TRIGGER IF EXISTS sef_sync_jobs_updated_at_trigger ON sef_sync_jobs;
CREATE TRIGGER sef_sync_jobs_updated_at_trigger
BEFORE UPDATE ON sef_sync_jobs
FOR EACH ROW EXECUTE FUNCTION update_sef_sync_jobs_updated_at();

-- Reset any currently stuck jobs
UPDATE sef_sync_jobs 
SET status = 'failed', 
    error_message = 'Timeout - sinhronizacija je resetovana',
    completed_at = NOW()
WHERE status IN ('running', 'pending')
AND created_at < NOW() - INTERVAL '10 minutes';