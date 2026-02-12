
-- Create partners table
CREATE TABLE public.partners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  pib TEXT,
  maticni_broj TEXT,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  country TEXT NOT NULL DEFAULT 'RS',
  type TEXT NOT NULL DEFAULT 'customer' CHECK (type IN ('customer', 'supplier', 'both')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Members can view partners"
  ON public.partners FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant admins manage partners"
  ON public.partners FOR ALL
  USING (tenant_id IN (
    SELECT tenant_members.tenant_id FROM tenant_members
    WHERE tenant_members.user_id = auth.uid()
      AND tenant_members.role IN ('admin', 'accountant')
      AND tenant_members.status = 'active'
  ));

CREATE POLICY "Super admins manage partners"
  ON public.partners FOR ALL
  USING (is_super_admin(auth.uid()));

-- Updated_at trigger
CREATE TRIGGER update_partners_updated_at
  BEFORE UPDATE ON public.partners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add partner_id FK to invoices
ALTER TABLE public.invoices ADD COLUMN partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL;
