-- Task 30: Bank categorization learning rules
CREATE TABLE IF NOT EXISTS public.bank_categorization_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pattern TEXT NOT NULL,
  account_id UUID REFERENCES chart_of_accounts(id),
  partner_id UUID REFERENCES partners(id),
  confidence NUMERIC DEFAULT 1.0,
  usage_count INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bank_categorization_rules ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own tenant rules"
  ON public.bank_categorization_rules FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE POLICY "Users can insert own tenant rules"
  ON public.bank_categorization_rules FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE POLICY "Users can update own tenant rules"
  ON public.bank_categorization_rules FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE POLICY "Users can delete own tenant rules"
  ON public.bank_categorization_rules FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND status = 'active'));

-- Indexes
CREATE INDEX idx_bank_cat_rules_tenant ON public.bank_categorization_rules(tenant_id);
CREATE INDEX idx_bank_cat_rules_pattern ON public.bank_categorization_rules(tenant_id, pattern);