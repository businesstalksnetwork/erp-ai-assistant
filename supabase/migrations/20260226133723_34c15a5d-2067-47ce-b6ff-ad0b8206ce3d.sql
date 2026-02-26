
-- Table for admin overrides of role notification categories
CREATE TABLE public.role_notification_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL,
  category TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, role, category)
);

-- Enable RLS
ALTER TABLE public.role_notification_overrides ENABLE ROW LEVEL SECURITY;

-- Admin members can read overrides for their tenant
CREATE POLICY "Tenant admins can read overrides"
  ON public.role_notification_overrides
  FOR SELECT
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

-- Admin members can insert overrides
CREATE POLICY "Tenant admins can insert overrides"
  ON public.role_notification_overrides
  FOR INSERT
  WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

-- Admin members can update overrides
CREATE POLICY "Tenant admins can update overrides"
  ON public.role_notification_overrides
  FOR UPDATE
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

-- Admin members can delete overrides
CREATE POLICY "Tenant admins can delete overrides"
  ON public.role_notification_overrides
  FOR DELETE
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

-- Index for fast lookups
CREATE INDEX idx_role_notification_overrides_tenant_role
  ON public.role_notification_overrides(tenant_id, role);
