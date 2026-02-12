
-- =============================================
-- 1. Audit trigger function (auto-log changes)
-- =============================================
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_action text;
  v_details jsonb;
  v_entity_id uuid;
  v_tenant_id uuid;
  v_user_id uuid;
BEGIN
  v_action := lower(TG_OP);
  v_user_id := auth.uid();

  IF TG_OP = 'DELETE' THEN
    v_entity_id := OLD.id;
    v_tenant_id := OLD.tenant_id;
    v_details := jsonb_build_object('old', row_to_json(OLD));
  ELSIF TG_OP = 'UPDATE' THEN
    v_entity_id := NEW.id;
    v_tenant_id := NEW.tenant_id;
    v_details := jsonb_build_object('old', row_to_json(OLD), 'new', row_to_json(NEW));
  ELSE -- INSERT
    v_entity_id := NEW.id;
    v_tenant_id := NEW.tenant_id;
    v_details := jsonb_build_object('new', row_to_json(NEW));
  END IF;

  INSERT INTO public.audit_log (tenant_id, user_id, action, entity_type, entity_id, details)
  VALUES (v_tenant_id, v_user_id, v_action, TG_TABLE_NAME, v_entity_id, v_details);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Attach triggers to key tables
CREATE TRIGGER audit_invoices AFTER INSERT OR UPDATE OR DELETE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_journal_entries AFTER INSERT OR UPDATE OR DELETE ON public.journal_entries FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_partners AFTER INSERT OR UPDATE OR DELETE ON public.partners FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_products AFTER INSERT OR UPDATE OR DELETE ON public.products FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_inventory_movements AFTER INSERT OR UPDATE OR DELETE ON public.inventory_movements FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_chart_of_accounts AFTER INSERT OR UPDATE OR DELETE ON public.chart_of_accounts FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_fiscal_periods AFTER INSERT OR UPDATE OR DELETE ON public.fiscal_periods FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Indexes for audit_log performance
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_created ON public.audit_log (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_entity ON public.audit_log (tenant_id, entity_type);

-- =============================================
-- 2. Tenant invitations table
-- =============================================
CREATE TABLE public.tenant_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email text NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  invited_by uuid,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

ALTER TABLE public.tenant_invitations ENABLE ROW LEVEL SECURITY;

-- Tenant admins can manage invitations for their tenant
CREATE POLICY "Tenant admins manage invitations"
ON public.tenant_invitations FOR ALL
USING (
  tenant_id IN (
    SELECT tm.tenant_id FROM tenant_members tm
    WHERE tm.user_id = auth.uid() AND tm.role = 'admin' AND tm.status = 'active'
  )
);

-- Super admins can manage all invitations
CREATE POLICY "Super admins manage invitations"
ON public.tenant_invitations FOR ALL
USING (is_super_admin(auth.uid()));

-- Index for invitation lookup by email
CREATE INDEX idx_tenant_invitations_email ON public.tenant_invitations (email, status);

-- =============================================
-- 3. Profile visibility for tenant co-members
-- =============================================
CREATE POLICY "Tenant members can view co-member profiles"
ON public.profiles FOR SELECT
USING (
  id IN (
    SELECT tm2.user_id FROM tenant_members tm2
    WHERE tm2.tenant_id IN (
      SELECT get_user_tenant_ids(auth.uid())
    ) AND tm2.status = 'active'
  )
);

-- =============================================
-- 4. Auto-accept invitation function
-- =============================================
CREATE OR REPLACE FUNCTION public.accept_pending_invitations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_invitation RECORD;
  v_email text;
BEGIN
  v_email := NEW.email;

  FOR v_invitation IN
    SELECT * FROM public.tenant_invitations
    WHERE email = v_email AND status = 'pending' AND expires_at > now()
  LOOP
    -- Add to tenant_members
    INSERT INTO public.tenant_members (tenant_id, user_id, role, status)
    VALUES (v_invitation.tenant_id, NEW.id, v_invitation.role, 'active')
    ON CONFLICT DO NOTHING;

    -- Add role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, v_invitation.role)
    ON CONFLICT DO NOTHING;

    -- Mark invitation accepted
    UPDATE public.tenant_invitations SET status = 'accepted' WHERE id = v_invitation.id;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Trigger on auth.users insert to auto-accept invitations
CREATE TRIGGER on_user_created_accept_invitations
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.accept_pending_invitations();
