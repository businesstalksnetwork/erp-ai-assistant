
INSERT INTO public.payment_models (code, name_en, name_sr, description, direction, affects_bank, requires_invoice, allows_partial, is_system)
VALUES 
  ('SUPPLIER_INVOICE', 'Supplier Invoice Posting', 'Knjiženje fakture dobavljača', 'Automatic posting of supplier invoices', 'OUT', false, true, false, true),
  ('DEPRECIATION', 'Depreciation Posting', 'Obračun amortizacije', 'Monthly depreciation for fixed assets', 'OUT', false, false, false, true),
  ('CASH_RECEIPT', 'Cash Receipt', 'Blagajnički prijem', 'Cash register receipt', 'IN', false, false, false, true),
  ('CASH_DISBURSEMENT', 'Cash Disbursement', 'Blagajnički izdatak', 'Cash register disbursement', 'OUT', false, false, false, true),
  ('KOMPENZACIJA', 'Compensation', 'Kompenzacija', 'Mutual debt compensation', 'IN', false, false, false, true),
  ('DEFERRED_EXPENSE', 'Deferred Expense', 'Razgraničenje troškova', 'Deferred expense recognition', 'OUT', false, false, false, true),
  ('DEFERRED_REVENUE', 'Deferred Revenue', 'Razgraničenje prihoda', 'Deferred revenue recognition', 'IN', false, false, false, true),
  ('INVENTORY_RECEIPT', 'Inventory Receipt', 'Prijem robe na zalihe', 'Goods receipt to inventory', 'IN', false, false, false, true),
  ('INVENTORY_ISSUE', 'Inventory Issue', 'Izdavanje sa zaliha', 'Goods issue from inventory', 'OUT', false, false, false, true),
  ('CUSTOMER_RETURN', 'Customer Return', 'Povrat kupca', 'Customer goods return', 'IN', false, false, false, true),
  ('SUPPLIER_RETURN', 'Supplier Return', 'Povrat dobavljaču', 'Return to supplier', 'OUT', false, false, false, true),
  ('DEBIT_NOTE', 'Debit Note', 'Knjižno zaduženje', 'Debit note (Type 383)', 'OUT', false, true, false, true)
ON CONFLICT (code) DO NOTHING;

CREATE OR REPLACE FUNCTION public.seed_extended_posting_rules(p_tenant_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule_id UUID;
  v_model_id UUID;
  v_count INTEGER := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM tenant_users
    WHERE tenant_id = p_tenant_id AND user_id = auth.uid() AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT id INTO v_model_id FROM payment_models WHERE code = 'SUPPLIER_INVOICE';
  IF v_model_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM posting_rules WHERE tenant_id = p_tenant_id AND payment_model_id = v_model_id) THEN
    INSERT INTO posting_rules (tenant_id, payment_model_id, name, description, is_default, priority, valid_from)
      VALUES (p_tenant_id, v_model_id, 'Faktura dobavljača - standard', 'D: Rashod / P: Obaveze', true, 0, '2020-01-01')
      RETURNING id INTO v_rule_id;
    INSERT INTO posting_rule_lines (posting_rule_id, line_number, side, account_source, dynamic_source, amount_source)
      VALUES (v_rule_id, 1, 'DEBIT', 'DYNAMIC', 'EXPENSE_ACCOUNT', 'TAX_BASE'),
             (v_rule_id, 2, 'DEBIT', 'DYNAMIC', 'INPUT_VAT', 'TAX_AMOUNT'),
             (v_rule_id, 3, 'CREDIT', 'DYNAMIC', 'PARTNER_PAYABLE', 'FULL');
    v_count := v_count + 1;
  END IF;

  SELECT id INTO v_model_id FROM payment_models WHERE code = 'DEPRECIATION';
  IF v_model_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM posting_rules WHERE tenant_id = p_tenant_id AND payment_model_id = v_model_id) THEN
    INSERT INTO posting_rules (tenant_id, payment_model_id, name, description, is_default, priority, valid_from)
      VALUES (p_tenant_id, v_model_id, 'Amortizacija - standard', 'D: Trošak amortizacije / P: Ispravka vrednosti', true, 0, '2020-01-01')
      RETURNING id INTO v_rule_id;
    INSERT INTO posting_rule_lines (posting_rule_id, line_number, side, account_source, fixed_account_code, amount_source)
      VALUES (v_rule_id, 1, 'DEBIT', 'FIXED', '5310', 'FULL'),
             (v_rule_id, 2, 'CREDIT', 'FIXED', '0121', 'FULL');
    v_count := v_count + 1;
  END IF;

  SELECT id INTO v_model_id FROM payment_models WHERE code = 'INVENTORY_RECEIPT';
  IF v_model_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM posting_rules WHERE tenant_id = p_tenant_id AND payment_model_id = v_model_id) THEN
    INSERT INTO posting_rules (tenant_id, payment_model_id, name, description, is_default, priority, valid_from)
      VALUES (p_tenant_id, v_model_id, 'Prijem robe - standard', 'D: Zalihe / P: GRNI', true, 0, '2020-01-01')
      RETURNING id INTO v_rule_id;
    INSERT INTO posting_rule_lines (posting_rule_id, line_number, side, account_source, fixed_account_code, amount_source)
      VALUES (v_rule_id, 1, 'DEBIT', 'FIXED', '1200', 'FULL'),
             (v_rule_id, 2, 'CREDIT', 'FIXED', '2100', 'FULL');
    v_count := v_count + 1;
  END IF;

  SELECT id INTO v_model_id FROM payment_models WHERE code = 'KOMPENZACIJA';
  IF v_model_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM posting_rules WHERE tenant_id = p_tenant_id AND payment_model_id = v_model_id) THEN
    INSERT INTO posting_rules (tenant_id, payment_model_id, name, description, is_default, priority, valid_from)
      VALUES (p_tenant_id, v_model_id, 'Kompenzacija - standard', 'D: Obaveza / P: Potraživanje', true, 0, '2020-01-01')
      RETURNING id INTO v_rule_id;
    INSERT INTO posting_rule_lines (posting_rule_id, line_number, side, account_source, dynamic_source, amount_source)
      VALUES (v_rule_id, 1, 'DEBIT', 'DYNAMIC', 'PARTNER_PAYABLE', 'FULL'),
             (v_rule_id, 2, 'CREDIT', 'DYNAMIC', 'PARTNER_RECEIVABLE', 'FULL');
    v_count := v_count + 1;
  END IF;

  RETURN v_count;
END;
$$;
