
-- Phase 3B: POS Discount Overrides
CREATE TABLE public.pos_discount_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  transaction_id UUID REFERENCES public.pos_transactions(id),
  product_name TEXT,
  original_price NUMERIC NOT NULL DEFAULT 0,
  override_price NUMERIC NOT NULL DEFAULT 0,
  discount_pct NUMERIC NOT NULL DEFAULT 0,
  reason TEXT,
  requested_by UUID,
  approved_by UUID,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pos_discount_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view pos_discount_overrides"
  ON public.pos_discount_overrides FOR ALL
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE INDEX idx_pos_discount_overrides_tenant ON public.pos_discount_overrides(tenant_id);
CREATE INDEX idx_pos_discount_overrides_status ON public.pos_discount_overrides(status);

-- Phase 3F: Quote Templates
CREATE TABLE public.quote_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  description TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  terms_text TEXT,
  validity_days INTEGER NOT NULL DEFAULT 30,
  currency TEXT NOT NULL DEFAULT 'RSD',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.quote_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view quote_templates"
  ON public.quote_templates FOR ALL
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE INDEX idx_quote_templates_tenant ON public.quote_templates(tenant_id);
