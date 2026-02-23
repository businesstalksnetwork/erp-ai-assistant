
-- Create opportunity_stages table
CREATE TABLE public.opportunity_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  code text NOT NULL,
  name text NOT NULL,
  name_sr text,
  color text,
  sort_order int DEFAULT 0,
  is_won boolean DEFAULT false,
  is_lost boolean DEFAULT false,
  is_system boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, code)
);

ALTER TABLE public.opportunity_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant access" ON public.opportunity_stages FOR ALL
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- Seed default stages for all existing tenants
INSERT INTO public.opportunity_stages (tenant_id, code, name, name_sr, color, sort_order, is_won, is_lost, is_system)
SELECT t.id, s.code, s.name, s.name_sr, s.color, s.sort_order, s.is_won, s.is_lost, true
FROM public.tenants t
CROSS JOIN (VALUES
  ('qualification', 'Qualification', 'Kvalifikacija', '#3B82F6', 1, false, false),
  ('proposal', 'Proposal', 'Ponuda', '#8B5CF6', 2, false, false),
  ('negotiation', 'Negotiation', 'Pregovaranje', '#F59E0B', 3, false, false),
  ('closed_won', 'Closed Won', 'Zatvoreno - dobijeno', '#10B981', 4, true, false),
  ('closed_lost', 'Closed Lost', 'Zatvoreno - izgubljeno', '#EF4444', 5, false, true)
) AS s(code, name, name_sr, color, sort_order, is_won, is_lost)
ON CONFLICT (tenant_id, code) DO NOTHING;
