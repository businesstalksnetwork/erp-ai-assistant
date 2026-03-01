
-- SEC-04: Security events table for ISO 27001 security monitoring
CREATE TABLE public.security_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id),
  user_id UUID,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  source TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_security_events_tenant ON public.security_events(tenant_id, created_at DESC);
CREATE INDEX idx_security_events_type ON public.security_events(event_type, created_at DESC);
CREATE INDEX idx_security_events_severity ON public.security_events(severity) WHERE severity IN ('error', 'critical');

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Only super_admins and tenant admins can view security events
CREATE POLICY "security_events_select" ON public.security_events
  FOR SELECT USING (
    public.is_super_admin(auth.uid())
    OR tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
  );

-- Insert allowed for authenticated users (edge functions log via service role)
CREATE POLICY "security_events_insert" ON public.security_events
  FOR INSERT WITH CHECK (true);

-- SEC-07: Secret rotation log for key management tracking
CREATE TABLE public.secret_rotation_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id),
  secret_name TEXT NOT NULL,
  rotated_by UUID,
  rotated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  rotation_reason TEXT,
  previous_version_hash TEXT,
  new_version_hash TEXT,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'rolled_back')),
  details JSONB DEFAULT '{}'
);

CREATE INDEX idx_secret_rotation_tenant ON public.secret_rotation_log(tenant_id, rotated_at DESC);

ALTER TABLE public.secret_rotation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "secret_rotation_log_select" ON public.secret_rotation_log
  FOR SELECT USING (public.is_super_admin(auth.uid()));

CREATE POLICY "secret_rotation_log_insert" ON public.secret_rotation_log
  FOR INSERT WITH CHECK (true);
