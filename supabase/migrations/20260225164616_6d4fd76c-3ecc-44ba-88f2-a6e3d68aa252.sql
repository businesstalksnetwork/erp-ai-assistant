
-- ============================================================
-- GL Posting Rules Engine
-- ============================================================

-- 1. payment_models
CREATE TABLE public.payment_models (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_sr TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'NONE' CHECK (direction IN ('IN','OUT','INTERNAL','NONE')),
  affects_bank BOOLEAN NOT NULL DEFAULT true,
  requires_invoice BOOLEAN NOT NULL DEFAULT false,
  allows_partial BOOLEAN NOT NULL DEFAULT false,
  is_system BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payment_models_read_all" ON public.payment_models FOR SELECT USING (true);

-- 2. posting_rules
CREATE TABLE public.posting_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  payment_model_id UUID NOT NULL REFERENCES public.payment_models(id),
  bank_account_id UUID REFERENCES public.bank_accounts(id),
  currency CHAR(3),
  partner_type TEXT,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  is_default BOOLEAN NOT NULL DEFAULT false,
  priority INTEGER NOT NULL DEFAULT 0,
  auto_post BOOLEAN NOT NULL DEFAULT false,
  require_approval BOOLEAN NOT NULL DEFAULT false,
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_to DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.posting_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posting_rules_member_select" ON public.posting_rules
  FOR SELECT USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'
  ));
CREATE POLICY "posting_rules_admin_manage" ON public.posting_rules
  FOR ALL USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active' AND role = 'admin'
  ));
CREATE INDEX idx_posting_rules_tenant ON public.posting_rules(tenant_id);
CREATE INDEX idx_posting_rules_model ON public.posting_rules(payment_model_id);
CREATE INDEX idx_posting_rules_lookup ON public.posting_rules(tenant_id, payment_model_id, is_active);

-- 3. posting_rule_lines
CREATE TABLE public.posting_rule_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  posting_rule_id UUID NOT NULL REFERENCES public.posting_rules(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL DEFAULT 1,
  side TEXT NOT NULL CHECK (side IN ('DEBIT','CREDIT')),
  account_source TEXT NOT NULL DEFAULT 'FIXED' CHECK (account_source IN ('FIXED','DYNAMIC')),
  account_id UUID REFERENCES public.chart_of_accounts(id),
  dynamic_source TEXT,
  amount_source TEXT NOT NULL DEFAULT 'FULL' CHECK (amount_source IN ('FULL','TAX_BASE','TAX_AMOUNT','NET','GROSS')),
  amount_factor DECIMAL(10,4) DEFAULT 1.0,
  description_template TEXT DEFAULT '',
  is_tax_line BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.posting_rule_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posting_rule_lines_member_select" ON public.posting_rule_lines
  FOR SELECT USING (posting_rule_id IN (
    SELECT id FROM public.posting_rules WHERE tenant_id IN (
      SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'
    )
  ));
CREATE POLICY "posting_rule_lines_admin_manage" ON public.posting_rule_lines
  FOR ALL USING (posting_rule_id IN (
    SELECT id FROM public.posting_rules WHERE tenant_id IN (
      SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active' AND role = 'admin'
    )
  ));
CREATE INDEX idx_posting_rule_lines_rule ON public.posting_rule_lines(posting_rule_id);

-- 4. account_mappings
CREATE TABLE public.account_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id),
  gl_account_id UUID NOT NULL REFERENCES public.chart_of_accounts(id),
  mapping_type TEXT NOT NULL DEFAULT 'PRIMARY' CHECK (mapping_type IN ('PRIMARY','CLEARING','FEE')),
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.account_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "account_mappings_member_select" ON public.account_mappings
  FOR SELECT USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'
  ));
CREATE POLICY "account_mappings_admin_manage" ON public.account_mappings
  FOR ALL USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active' AND role = 'admin'
  ));
CREATE INDEX idx_account_mappings_tenant ON public.account_mappings(tenant_id);

-- 5. updated_at triggers
CREATE TRIGGER update_posting_rules_updated_at
  BEFORE UPDATE ON public.posting_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_account_mappings_updated_at
  BEFORE UPDATE ON public.account_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Seed 14 payment models
INSERT INTO public.payment_models (code, name_en, name_sr, direction, affects_bank, requires_invoice, allows_partial, is_system, description) VALUES
  ('CUSTOMER_PAYMENT', 'Customer Payment', 'Uplata kupca', 'IN', true, true, true, true, 'Payment received from customer for invoice'),
  ('VENDOR_PAYMENT', 'Vendor Payment', 'Plaćanje dobavljaču', 'OUT', true, true, true, true, 'Payment made to vendor for purchase invoice'),
  ('ADVANCE_RECEIVED', 'Advance Received', 'Primljeni avans', 'IN', true, false, false, true, 'Advance payment received from customer'),
  ('ADVANCE_PAID', 'Advance Paid', 'Dati avans', 'OUT', true, false, false, true, 'Advance payment made to vendor'),
  ('SALARY_PAYMENT', 'Salary Payment', 'Isplata zarada', 'OUT', true, false, false, true, 'Net salary payment to employees'),
  ('TAX_PAYMENT', 'Tax Payment', 'Uplata poreza i doprinosa', 'OUT', true, false, false, true, 'Tax and social contribution payments'),
  ('VAT_PAYMENT', 'VAT Payment', 'Uplata PDV-a', 'OUT', true, false, false, true, 'VAT payment to tax authority'),
  ('VAT_REFUND', 'VAT Refund', 'Povraćaj PDV-a', 'IN', true, false, false, true, 'VAT refund received from tax authority'),
  ('BANK_FEE', 'Bank Fee', 'Bankarska provizija', 'OUT', true, false, false, true, 'Bank service charges and fees'),
  ('INTER_ACCOUNT_TRANSFER', 'Inter-Account Transfer', 'Interni transfer', 'INTERNAL', true, false, false, true, 'Transfer between own bank accounts'),
  ('FX_REVALUATION', 'FX Revaluation', 'Kursna razlika', 'NONE', false, false, false, true, 'Foreign exchange gain or loss revaluation'),
  ('INTERNAL_COMPENSATION', 'Internal Compensation', 'Kompenzacija', 'NONE', false, true, true, true, 'Mutual debt/receivable offset without bank'),
  ('CUSTOMER_REFUND', 'Customer Refund', 'Povraćaj kupcu', 'OUT', true, true, false, true, 'Refund issued to customer'),
  ('VENDOR_REFUND', 'Vendor Refund', 'Povraćaj od dobavljača', 'IN', true, true, false, true, 'Refund received from vendor');

-- 7. Waterfall RPC: find_posting_rule
CREATE OR REPLACE FUNCTION public.find_posting_rule(
  p_tenant_id UUID,
  p_model_code TEXT,
  p_bank_account_id UUID DEFAULT NULL,
  p_currency TEXT DEFAULT NULL,
  p_partner_type TEXT DEFAULT NULL
)
RETURNS TABLE(rule_id UUID, rule_name TEXT, rule_description TEXT, lines JSONB)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ranked AS (
    SELECT 
      pr.id,
      pr.name,
      pr.description,
      ROW_NUMBER() OVER (
        ORDER BY
          CASE WHEN pr.bank_account_id IS NOT NULL AND pr.bank_account_id = p_bank_account_id THEN 0 ELSE 1 END,
          CASE WHEN pr.currency IS NOT NULL AND pr.currency = p_currency THEN 0 ELSE 1 END,
          CASE WHEN pr.partner_type IS NOT NULL AND pr.partner_type = p_partner_type THEN 0 ELSE 1 END,
          pr.priority DESC
      ) AS rn
    FROM posting_rules pr
    JOIN payment_models pm ON pr.payment_model_id = pm.id
    WHERE pr.tenant_id = p_tenant_id
      AND pm.code = p_model_code
      AND pr.is_active = true
      AND CURRENT_DATE >= pr.valid_from
      AND (pr.valid_to IS NULL OR CURRENT_DATE <= pr.valid_to)
  )
  SELECT 
    r.id AS rule_id,
    r.name AS rule_name,
    r.description AS rule_description,
    jsonb_agg(
      jsonb_build_object(
        'id', prl.id,
        'line_number', prl.line_number,
        'side', prl.side,
        'account_source', prl.account_source,
        'account_id', prl.account_id,
        'dynamic_source', prl.dynamic_source,
        'amount_source', prl.amount_source,
        'amount_factor', prl.amount_factor,
        'description_template', prl.description_template,
        'is_tax_line', prl.is_tax_line
      ) ORDER BY prl.line_number
    ) AS lines
  FROM ranked r
  JOIN posting_rule_lines prl ON prl.posting_rule_id = r.id
  WHERE r.rn = 1
  GROUP BY r.id, r.name, r.description;
$$;
