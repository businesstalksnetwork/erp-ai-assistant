
-- Migration 2: Posting Rule Catalog (complete)
CREATE TABLE public.posting_rule_catalog (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  rule_code text NOT NULL,
  description text NOT NULL DEFAULT '',
  debit_account_code text,
  credit_account_code text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, rule_code)
);

ALTER TABLE public.posting_rule_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view posting rules"
  ON public.posting_rule_catalog FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE POLICY "Tenant admins can manage posting rules"
  ON public.posting_rule_catalog FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active' AND role = 'admin'));

CREATE OR REPLACE FUNCTION public.seed_posting_rules_for_tenant(p_tenant_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO posting_rule_catalog (tenant_id, rule_code, description, debit_account_code, credit_account_code) VALUES
    (p_tenant_id, 'pos_cash_receipt', 'POS Cash Receipt', '2430', NULL),
    (p_tenant_id, 'pos_card_receipt', 'POS Card Receipt', '2431', NULL),
    (p_tenant_id, 'pos_revenue', 'POS Revenue', NULL, '6010'),
    (p_tenant_id, 'pos_output_vat', 'POS Output VAT', NULL, '2470'),
    (p_tenant_id, 'pos_cogs', 'POS Cost of Goods Sold', '5010', NULL),
    (p_tenant_id, 'pos_retail_inv', 'POS Retail Inventory', NULL, '1320'),
    (p_tenant_id, 'pos_reverse_markup', 'POS Reverse Markup', '1329', NULL),
    (p_tenant_id, 'pos_embedded_vat', 'POS Embedded VAT', '1340', NULL),
    (p_tenant_id, 'invoice_ar', 'Invoice Accounts Receivable', '2040', NULL),
    (p_tenant_id, 'invoice_revenue', 'Invoice Revenue', NULL, '6010'),
    (p_tenant_id, 'invoice_output_vat', 'Invoice Output VAT', NULL, '2470'),
    (p_tenant_id, 'invoice_cogs', 'Invoice COGS', '5010', NULL),
    (p_tenant_id, 'invoice_inventory', 'Invoice Inventory', NULL, '1300'),
    (p_tenant_id, 'payroll_gross_exp', 'Payroll Gross Expense', '5200', NULL),
    (p_tenant_id, 'payroll_net_payable', 'Payroll Net Payable', NULL, '4500'),
    (p_tenant_id, 'payroll_tax', 'Payroll Income Tax', NULL, '4510'),
    (p_tenant_id, 'payroll_bank', 'Payroll Bank Payment', NULL, '2431')
  ON CONFLICT (tenant_id, rule_code) DO NOTHING;
END;
$$;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM tenants LOOP
    PERFORM seed_posting_rules_for_tenant(r.id);
  END LOOP;
END;
$$;
