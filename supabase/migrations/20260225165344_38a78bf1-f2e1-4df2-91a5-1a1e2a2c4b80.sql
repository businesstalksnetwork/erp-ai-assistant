
-- ============================================================
-- RPC: seed_default_posting_rules
-- Seeds the 14 standard Serbian posting rules with lines for a tenant
-- Idempotent: skips if rules already exist for the tenant
-- ============================================================

CREATE OR REPLACE FUNCTION public.seed_default_posting_rules(p_tenant_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  v_model_id UUID;
  v_rule_id UUID;
BEGIN
  -- Skip if tenant already has rules
  SELECT COUNT(*) INTO v_count FROM posting_rules WHERE tenant_id = p_tenant_id;
  IF v_count > 0 THEN RETURN 0; END IF;

  v_count := 0;

  -- 1. CUSTOMER_PAYMENT: D:Bank(dynamic) / C:Receivable(dynamic)
  SELECT id INTO v_model_id FROM payment_models WHERE code = 'CUSTOMER_PAYMENT';
  INSERT INTO posting_rules (tenant_id, payment_model_id, name, description, is_default, priority, valid_from)
    VALUES (p_tenant_id, v_model_id, 'Uplata kupca - standard', 'Standardno knjiženje uplate kupca', true, 0, '2020-01-01')
    RETURNING id INTO v_rule_id;
  INSERT INTO posting_rule_lines (posting_rule_id, line_number, side, account_source, dynamic_source, amount_source)
    VALUES (v_rule_id, 1, 'DEBIT', 'DYNAMIC', 'BANK_ACCOUNT', 'FULL'),
           (v_rule_id, 2, 'CREDIT', 'DYNAMIC', 'PARTNER_RECEIVABLE', 'FULL');
  v_count := v_count + 1;

  -- 2. VENDOR_PAYMENT: D:Payable(dynamic) / C:Bank(dynamic)
  SELECT id INTO v_model_id FROM payment_models WHERE code = 'VENDOR_PAYMENT';
  INSERT INTO posting_rules (tenant_id, payment_model_id, name, description, is_default, priority, valid_from)
    VALUES (p_tenant_id, v_model_id, 'Plaćanje dobavljaču - standard', 'Standardno knjiženje plaćanja dobavljaču', true, 0, '2020-01-01')
    RETURNING id INTO v_rule_id;
  INSERT INTO posting_rule_lines (posting_rule_id, line_number, side, account_source, dynamic_source, amount_source)
    VALUES (v_rule_id, 1, 'DEBIT', 'DYNAMIC', 'PARTNER_PAYABLE', 'FULL'),
           (v_rule_id, 2, 'CREDIT', 'DYNAMIC', 'BANK_ACCOUNT', 'FULL');
  v_count := v_count + 1;

  -- 3. ADVANCE_RECEIVED: D:Bank / C:Advance / C:VAT(tax)
  SELECT id INTO v_model_id FROM payment_models WHERE code = 'ADVANCE_RECEIVED';
  INSERT INTO posting_rules (tenant_id, payment_model_id, name, description, is_default, priority, valid_from)
    VALUES (p_tenant_id, v_model_id, 'Primljeni avans', 'Avansna uplata od kupca sa PDV-om', true, 0, '2020-01-01')
    RETURNING id INTO v_rule_id;
  INSERT INTO posting_rule_lines (posting_rule_id, line_number, side, account_source, dynamic_source, amount_source)
    VALUES (v_rule_id, 1, 'DEBIT', 'DYNAMIC', 'BANK_ACCOUNT', 'FULL'),
           (v_rule_id, 2, 'CREDIT', 'DYNAMIC', 'ADVANCE_RECEIVED', 'TAX_BASE'),
           (v_rule_id, 3, 'CREDIT', 'DYNAMIC', 'TAX_PAYABLE', 'TAX_AMOUNT');
  v_count := v_count + 1;

  -- 4. ADVANCE_PAID: D:Advance / C:Bank
  SELECT id INTO v_model_id FROM payment_models WHERE code = 'ADVANCE_PAID';
  INSERT INTO posting_rules (tenant_id, payment_model_id, name, description, is_default, priority, valid_from)
    VALUES (p_tenant_id, v_model_id, 'Dati avans', 'Avansno plaćanje dobavljaču', true, 0, '2020-01-01')
    RETURNING id INTO v_rule_id;
  INSERT INTO posting_rule_lines (posting_rule_id, line_number, side, account_source, dynamic_source, amount_source)
    VALUES (v_rule_id, 1, 'DEBIT', 'DYNAMIC', 'ADVANCE_PAID', 'FULL'),
           (v_rule_id, 2, 'CREDIT', 'DYNAMIC', 'BANK_ACCOUNT', 'FULL');
  v_count := v_count + 1;

  -- 5. SALARY_PAYMENT: D:NetPayable / C:Bank
  SELECT id INTO v_model_id FROM payment_models WHERE code = 'SALARY_PAYMENT';
  INSERT INTO posting_rules (tenant_id, payment_model_id, name, description, is_default, priority, valid_from)
    VALUES (p_tenant_id, v_model_id, 'Isplata neto zarada', 'Isplata neto zarada zaposlenima', true, 0, '2020-01-01')
    RETURNING id INTO v_rule_id;
  INSERT INTO posting_rule_lines (posting_rule_id, line_number, side, account_source, dynamic_source, amount_source)
    VALUES (v_rule_id, 1, 'DEBIT', 'DYNAMIC', 'EMPLOYEE_NET', 'FULL'),
           (v_rule_id, 2, 'CREDIT', 'DYNAMIC', 'BANK_ACCOUNT', 'FULL');
  v_count := v_count + 1;

  -- 6. TAX_PAYMENT: D:TaxPayable + ContribPayable / C:Bank
  SELECT id INTO v_model_id FROM payment_models WHERE code = 'TAX_PAYMENT';
  INSERT INTO posting_rules (tenant_id, payment_model_id, name, description, is_default, priority, valid_from)
    VALUES (p_tenant_id, v_model_id, 'Uplata poreza i doprinosa', 'Plaćanje poreza na zarade i doprinosa', true, 0, '2020-01-01')
    RETURNING id INTO v_rule_id;
  INSERT INTO posting_rule_lines (posting_rule_id, line_number, side, account_source, dynamic_source, amount_source)
    VALUES (v_rule_id, 1, 'DEBIT', 'DYNAMIC', 'TAX_PAYABLE', 'FULL'),
           (v_rule_id, 2, 'CREDIT', 'DYNAMIC', 'BANK_ACCOUNT', 'FULL');
  v_count := v_count + 1;

  -- 7. VAT_PAYMENT: D:VATPayable / C:Bank
  SELECT id INTO v_model_id FROM payment_models WHERE code = 'VAT_PAYMENT';
  INSERT INTO posting_rules (tenant_id, payment_model_id, name, description, is_default, priority, valid_from)
    VALUES (p_tenant_id, v_model_id, 'Uplata PDV-a', 'Mesečna/kvartalna uplata PDV-a', true, 0, '2020-01-01')
    RETURNING id INTO v_rule_id;
  INSERT INTO posting_rule_lines (posting_rule_id, line_number, side, account_source, dynamic_source, amount_source)
    VALUES (v_rule_id, 1, 'DEBIT', 'DYNAMIC', 'TAX_PAYABLE', 'FULL'),
           (v_rule_id, 2, 'CREDIT', 'DYNAMIC', 'BANK_ACCOUNT', 'FULL');
  v_count := v_count + 1;

  -- 8. VAT_REFUND: D:Bank / C:VATReceivable
  SELECT id INTO v_model_id FROM payment_models WHERE code = 'VAT_REFUND';
  INSERT INTO posting_rules (tenant_id, payment_model_id, name, description, is_default, priority, valid_from)
    VALUES (p_tenant_id, v_model_id, 'Povraćaj PDV-a', 'Povraćaj pretplaćenog PDV-a', true, 0, '2020-01-01')
    RETURNING id INTO v_rule_id;
  INSERT INTO posting_rule_lines (posting_rule_id, line_number, side, account_source, dynamic_source, amount_source)
    VALUES (v_rule_id, 1, 'DEBIT', 'DYNAMIC', 'BANK_ACCOUNT', 'FULL'),
           (v_rule_id, 2, 'CREDIT', 'DYNAMIC', 'TAX_PAYABLE', 'FULL');
  v_count := v_count + 1;

  -- 9. BANK_FEE: D:BankFeeExpense / C:Bank
  SELECT id INTO v_model_id FROM payment_models WHERE code = 'BANK_FEE';
  INSERT INTO posting_rules (tenant_id, payment_model_id, name, description, is_default, priority, valid_from)
    VALUES (p_tenant_id, v_model_id, 'Bankarska provizija', 'Troškovi bankarskih usluga', true, 0, '2020-01-01')
    RETURNING id INTO v_rule_id;
  INSERT INTO posting_rule_lines (posting_rule_id, line_number, side, account_source, dynamic_source, amount_source)
    VALUES (v_rule_id, 1, 'DEBIT', 'DYNAMIC', 'CLEARING', 'FULL'),
           (v_rule_id, 2, 'CREDIT', 'DYNAMIC', 'BANK_ACCOUNT', 'FULL');
  v_count := v_count + 1;

  -- 10. INTER_ACCOUNT_TRANSFER: D:TargetBank / C:SourceBank
  SELECT id INTO v_model_id FROM payment_models WHERE code = 'INTER_ACCOUNT_TRANSFER';
  INSERT INTO posting_rules (tenant_id, payment_model_id, name, description, is_default, priority, valid_from)
    VALUES (p_tenant_id, v_model_id, 'Interni transfer', 'Transfer između sopstvenih računa', true, 0, '2020-01-01')
    RETURNING id INTO v_rule_id;
  INSERT INTO posting_rule_lines (posting_rule_id, line_number, side, account_source, dynamic_source, amount_source)
    VALUES (v_rule_id, 1, 'DEBIT', 'DYNAMIC', 'BANK_ACCOUNT', 'FULL'),
           (v_rule_id, 2, 'CREDIT', 'DYNAMIC', 'CLEARING', 'FULL');
  v_count := v_count + 1;

  -- 11. FX_REVALUATION: D/C:FXGainLoss / C/D:Receivable/Payable
  SELECT id INTO v_model_id FROM payment_models WHERE code = 'FX_REVALUATION';
  INSERT INTO posting_rules (tenant_id, payment_model_id, name, description, is_default, priority, valid_from)
    VALUES (p_tenant_id, v_model_id, 'Kursna razlika', 'Pozitivne/negativne kursne razlike', true, 0, '2020-01-01')
    RETURNING id INTO v_rule_id;
  INSERT INTO posting_rule_lines (posting_rule_id, line_number, side, account_source, dynamic_source, amount_source)
    VALUES (v_rule_id, 1, 'DEBIT', 'DYNAMIC', 'CLEARING', 'FULL'),
           (v_rule_id, 2, 'CREDIT', 'DYNAMIC', 'PARTNER_RECEIVABLE', 'FULL');
  v_count := v_count + 1;

  -- 12. INTERNAL_COMPENSATION: D:Payable / C:Receivable
  SELECT id INTO v_model_id FROM payment_models WHERE code = 'INTERNAL_COMPENSATION';
  INSERT INTO posting_rules (tenant_id, payment_model_id, name, description, is_default, priority, valid_from)
    VALUES (p_tenant_id, v_model_id, 'Kompenzacija', 'Međusobno prebijanje potraživanja i obaveza', true, 0, '2020-01-01')
    RETURNING id INTO v_rule_id;
  INSERT INTO posting_rule_lines (posting_rule_id, line_number, side, account_source, dynamic_source, amount_source)
    VALUES (v_rule_id, 1, 'DEBIT', 'DYNAMIC', 'PARTNER_PAYABLE', 'FULL'),
           (v_rule_id, 2, 'CREDIT', 'DYNAMIC', 'PARTNER_RECEIVABLE', 'FULL');
  v_count := v_count + 1;

  -- 13. CUSTOMER_REFUND: D:Receivable / C:Bank
  SELECT id INTO v_model_id FROM payment_models WHERE code = 'CUSTOMER_REFUND';
  INSERT INTO posting_rules (tenant_id, payment_model_id, name, description, is_default, priority, valid_from)
    VALUES (p_tenant_id, v_model_id, 'Povraćaj kupcu', 'Povraćaj novca kupcu', true, 0, '2020-01-01')
    RETURNING id INTO v_rule_id;
  INSERT INTO posting_rule_lines (posting_rule_id, line_number, side, account_source, dynamic_source, amount_source)
    VALUES (v_rule_id, 1, 'DEBIT', 'DYNAMIC', 'PARTNER_RECEIVABLE', 'FULL'),
           (v_rule_id, 2, 'CREDIT', 'DYNAMIC', 'BANK_ACCOUNT', 'FULL');
  v_count := v_count + 1;

  -- 14. VENDOR_REFUND: D:Bank / C:Payable
  SELECT id INTO v_model_id FROM payment_models WHERE code = 'VENDOR_REFUND';
  INSERT INTO posting_rules (tenant_id, payment_model_id, name, description, is_default, priority, valid_from)
    VALUES (p_tenant_id, v_model_id, 'Povraćaj od dobavljača', 'Povraćaj novca od dobavljača', true, 0, '2020-01-01')
    RETURNING id INTO v_rule_id;
  INSERT INTO posting_rule_lines (posting_rule_id, line_number, side, account_source, dynamic_source, amount_source)
    VALUES (v_rule_id, 1, 'DEBIT', 'DYNAMIC', 'BANK_ACCOUNT', 'FULL'),
           (v_rule_id, 2, 'CREDIT', 'DYNAMIC', 'PARTNER_PAYABLE', 'FULL');
  v_count := v_count + 1;

  RETURN v_count;
END;
$$;
