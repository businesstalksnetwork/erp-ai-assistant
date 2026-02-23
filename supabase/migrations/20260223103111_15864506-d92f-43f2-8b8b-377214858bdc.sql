
-- Add columns to meetings
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES partners(id);
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS opportunity_id uuid REFERENCES opportunities(id);
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS outcome text;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS next_steps text;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS created_by uuid;

-- Fix meeting_participants: add partner_id, external_name
ALTER TABLE meeting_participants ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES partners(id);
ALTER TABLE meeting_participants ADD COLUMN IF NOT EXISTS external_name text;

-- Drop old company_id FK (safe even if already dropped)
DO $$ BEGIN
  ALTER TABLE meeting_participants DROP CONSTRAINT IF EXISTS meeting_participants_company_id_fkey;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- Opportunity multi-partner junction
CREATE TABLE IF NOT EXISTS opportunity_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  role text DEFAULT 'participant',
  created_at timestamptz DEFAULT now(),
  UNIQUE(opportunity_id, partner_id)
);
ALTER TABLE opportunity_partners ENABLE ROW LEVEL SECURITY;

-- RLS for opportunity_partners
DO $$ BEGIN
  CREATE POLICY "Tenant access" ON opportunity_partners FOR ALL
    USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
