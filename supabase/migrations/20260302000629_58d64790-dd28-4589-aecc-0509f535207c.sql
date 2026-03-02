
-- PRIV-01: Data breach incident tracking (ISO 27701 / ZZPL 72-hour notification)
CREATE TABLE public.data_breach_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'detected' CHECK (status IN ('detected', 'investigating', 'contained', 'resolved', 'reported')),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reported_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  notification_deadline TIMESTAMPTZ,
  affected_data_types TEXT[] DEFAULT '{}',
  affected_record_count INTEGER DEFAULT 0,
  root_cause TEXT,
  remediation_steps TEXT,
  reported_by UUID,
  assigned_to UUID,
  regulatory_notified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_breach_notification_deadline()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.notification_deadline := NEW.detected_at + INTERVAL '72 hours';
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_breach_deadline
  BEFORE INSERT OR UPDATE OF detected_at ON public.data_breach_incidents
  FOR EACH ROW EXECUTE FUNCTION public.set_breach_notification_deadline();

ALTER TABLE public.data_breach_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins manage breach incidents"
  ON public.data_breach_incidents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_members
      WHERE tenant_members.tenant_id = data_breach_incidents.tenant_id
        AND tenant_members.user_id = auth.uid()
        AND tenant_members.status = 'active'
        AND tenant_members.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Super admins manage all breach incidents"
  ON public.data_breach_incidents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'super_admin'
    )
  );

CREATE TRIGGER update_data_breach_incidents_updated_at
  BEFORE UPDATE ON public.data_breach_incidents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_data_breach_incidents_tenant ON public.data_breach_incidents(tenant_id, status);

-- CLOUD-02: PII encryption helpers
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.encrypt_pii(plain_text TEXT, encryption_key TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF plain_text IS NULL OR plain_text = '' THEN RETURN plain_text; END IF;
  RETURN encode(extensions.pgp_sym_encrypt(plain_text, encryption_key), 'base64');
END;
$$;

CREATE OR REPLACE FUNCTION public.decrypt_pii(encrypted_text TEXT, encryption_key TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF encrypted_text IS NULL OR encrypted_text = '' THEN RETURN encrypted_text; END IF;
  RETURN extensions.pgp_sym_decrypt(decode(encrypted_text, 'base64'), encryption_key);
EXCEPTION WHEN OTHERS THEN RETURN '***ENCRYPTED***';
END;
$$;
