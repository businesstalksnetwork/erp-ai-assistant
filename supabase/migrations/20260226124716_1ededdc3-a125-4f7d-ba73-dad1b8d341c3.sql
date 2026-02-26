
ALTER TABLE asset_reverses 
  ADD COLUMN IF NOT EXISTS signature_token uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS signature_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS employee_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS employee_signed_by_name text,
  ADD COLUMN IF NOT EXISTS employee_signature_ip text,
  ADD COLUMN IF NOT EXISTS issuer_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS issuer_signed_by_name text,
  ADD COLUMN IF NOT EXISTS notification_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_asset_reverses_signature_token 
  ON asset_reverses(signature_token) WHERE signature_token IS NOT NULL;

-- RLS policy for public signature token lookup (no auth required)
CREATE POLICY "Public can read revers by signature token"
  ON asset_reverses FOR SELECT
  USING (signature_token IS NOT NULL);

-- Allow public updates via signature token (for sign/reject)
CREATE POLICY "Public can update revers via signature token"
  ON asset_reverses FOR UPDATE
  USING (signature_token IS NOT NULL)
  WITH CHECK (signature_token IS NOT NULL);
