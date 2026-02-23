
-- =============================================
-- CRM Phase 2: Partially Won, Quote Versioning & Discount Approvals
-- =============================================

-- Feature 1: Partially Won Stage
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS won_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lost_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS won_reason TEXT,
  ADD COLUMN IF NOT EXISTS lost_reason TEXT,
  ADD COLUMN IF NOT EXISTS followup_opportunity_id UUID REFERENCES public.opportunities(id);

ALTER TABLE public.opportunity_stages
  ADD COLUMN IF NOT EXISTS is_partial BOOLEAN DEFAULT FALSE;

-- Seed "Partially Won" stage for every tenant that has stages
INSERT INTO public.opportunity_stages (tenant_id, code, name, name_sr, color, sort_order, is_won, is_lost, is_system, is_partial)
SELECT DISTINCT os.tenant_id,
  'partial_won',
  'Partially Won',
  'Delimično dobijeno',
  '#f59e0b',
  (SELECT MAX(sort_order) FROM public.opportunity_stages os2 WHERE os2.tenant_id = os.tenant_id AND os2.is_won = false AND os2.is_lost = false) + 1,
  false,
  false,
  true,
  true
FROM public.opportunity_stages os
WHERE NOT EXISTS (
  SELECT 1 FROM public.opportunity_stages ex
  WHERE ex.tenant_id = os.tenant_id AND ex.code = 'partial_won'
);

-- Feature 2: Quote Versioning
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS current_version INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_discount_pct NUMERIC DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.quote_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  snapshot JSONB NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT
);

ALTER TABLE public.quote_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view quote versions"
  ON public.quote_versions FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant members can insert quote versions"
  ON public.quote_versions FOR INSERT
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- Feature 3: Discount Approval Rules
CREATE TABLE IF NOT EXISTS public.discount_approval_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  role TEXT NOT NULL,
  max_discount_pct NUMERIC NOT NULL DEFAULT 100,
  requires_approval_above NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.discount_approval_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view discount rules"
  ON public.discount_approval_rules FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant members can manage discount rules"
  ON public.discount_approval_rules FOR ALL
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- Feature 3: Quote Expiry Function
CREATE OR REPLACE FUNCTION public.expire_overdue_quotes(p_tenant_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT := 0;
  v_quote RECORD;
BEGIN
  FOR v_quote IN
    SELECT id, quote_number, opportunity_id
    FROM public.quotes
    WHERE tenant_id = p_tenant_id
      AND status = 'sent'
      AND valid_until < CURRENT_DATE
  LOOP
    UPDATE public.quotes SET status = 'expired' WHERE id = v_quote.id;

    -- Create CRM task for follow-up
    INSERT INTO public.crm_tasks (tenant_id, title, description, task_type, priority, due_date)
    VALUES (
      p_tenant_id,
      'Quote expired: ' || v_quote.quote_number,
      'This quote has passed its valid_until date. Consider following up with the customer.',
      'quote_expired',
      'medium',
      CURRENT_DATE + INTERVAL '3 days'
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- Create index for quote version lookups
CREATE INDEX IF NOT EXISTS idx_quote_versions_quote_id ON public.quote_versions(quote_id);
CREATE INDEX IF NOT EXISTS idx_discount_approval_rules_tenant ON public.discount_approval_rules(tenant_id);
