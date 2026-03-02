
-- CR12-01: Fix process_pos_sale to handle split-payment GL routing
-- When payment_details JSONB is present, create per-method debit lines
-- instead of debiting full total to a single account.

CREATE OR REPLACE FUNCTION public.process_pos_sale(p_transaction_id uuid, p_tenant_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tx RECORD; v_je uuid; v_en text; v_fp uuid; v_da uuid;
  v_item jsonb; v_pid uuid; v_qty numeric;
  v_cogs numeric := 0; v_markup numeric := 0; v_embedded_vat numeric := 0;
  v_pcost numeric; v_retail_total numeric;
  v_acash uuid; v_abank uuid;
  v_a_revenue uuid; v_a_vat uuid; v_a_cogs uuid; v_a_inv uuid;
  v_a_retail_inv uuid; v_a_markup uuid; v_a_embedded_vat uuid;
  v_rule RECORD; v_rule_line RECORD; v_use_retail boolean := false;
  v_payment jsonb; v_pay_method text; v_pay_amount numeric; v_pay_account uuid;
BEGIN
  SELECT * INTO v_tx FROM pos_transactions WHERE id = p_transaction_id AND tenant_id = p_tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'POS transaction not found'; END IF;

  -- Try posting rule for revenue
  SELECT pr.id AS rule_id INTO v_rule
  FROM posting_rules pr JOIN payment_models pm ON pm.id = pr.payment_model_id
  WHERE pm.code = 'POS_SALE_REVENUE' AND pr.tenant_id = p_tenant_id AND pr.is_active LIMIT 1;

  IF v_rule.rule_id IS NOT NULL THEN
    FOR v_rule_line IN
      SELECT prl.side, prl.account_id, ca.code AS account_code
      FROM posting_rule_lines prl JOIN chart_of_accounts ca ON ca.id = prl.account_id
      WHERE prl.posting_rule_id = v_rule.rule_id ORDER BY prl.line_number
    LOOP
      IF v_rule_line.side = 'DEBIT' AND v_da IS NULL THEN v_da := v_rule_line.account_id;
      ELSIF v_rule_line.side = 'CREDIT' THEN
        IF v_a_revenue IS NULL THEN v_a_revenue := v_rule_line.account_id;
        ELSIF v_a_vat IS NULL THEN v_a_vat := v_rule_line.account_id;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- Resolve cash/bank accounts for split payment support
  SELECT id INTO v_acash FROM chart_of_accounts WHERE tenant_id = p_tenant_id AND code = '2430' AND is_active LIMIT 1;
  SELECT id INTO v_abank FROM chart_of_accounts WHERE tenant_id = p_tenant_id AND code = '2431' AND is_active LIMIT 1;

  -- If no posting rule set v_da, use payment method (single-method fallback only)
  IF v_da IS NULL THEN
    IF v_tx.payment_method = 'cash' THEN v_da := v_acash; ELSE v_da := v_abank; END IF;
  END IF;

  IF v_a_revenue IS NULL THEN SELECT id INTO v_a_revenue FROM chart_of_accounts WHERE tenant_id = p_tenant_id AND code = '6010' AND is_active LIMIT 1; END IF;
  IF v_a_vat IS NULL THEN SELECT id INTO v_a_vat FROM chart_of_accounts WHERE tenant_id = p_tenant_id AND code = '2470' AND is_active LIMIT 1; END IF;
  IF v_da IS NULL OR v_a_revenue IS NULL OR v_a_vat IS NULL THEN RAISE EXCEPTION 'Missing required accounts for POS revenue posting'; END IF;

  -- Check retail COGS rule
  SELECT pr.id AS rule_id INTO v_rule
  FROM posting_rules pr JOIN payment_models pm ON pm.id = pr.payment_model_id
  WHERE pm.code = 'POS_SALE_RETAIL' AND pr.tenant_id = p_tenant_id AND pr.is_active LIMIT 1;

  IF v_rule.rule_id IS NOT NULL THEN
    v_use_retail := true;
    FOR v_rule_line IN
      SELECT prl.side, prl.account_id, prl.description_template, ca.code AS account_code
      FROM posting_rule_lines prl JOIN chart_of_accounts ca ON ca.id = prl.account_id
      WHERE prl.posting_rule_id = v_rule.rule_id ORDER BY prl.line_number
    LOOP
      IF v_rule_line.account_code LIKE '50%' AND v_a_cogs IS NULL THEN v_a_cogs := v_rule_line.account_id;
      ELSIF v_rule_line.description_template ILIKE '%markup%' THEN v_a_markup := v_rule_line.account_id;
      ELSIF v_rule_line.description_template ILIKE '%embedded%' OR v_rule_line.account_code = '1340' THEN v_a_embedded_vat := v_rule_line.account_id;
      ELSIF v_rule_line.account_code LIKE '132%' AND v_a_retail_inv IS NULL THEN v_a_retail_inv := v_rule_line.account_id;
      END IF;
    END LOOP;
  ELSE
    SELECT pr.id AS rule_id INTO v_rule
    FROM posting_rules pr JOIN payment_models pm ON pm.id = pr.payment_model_id
    WHERE pm.code = 'POS_SALE_COGS' AND pr.tenant_id = p_tenant_id AND pr.is_active LIMIT 1;
    IF v_rule.rule_id IS NOT NULL THEN
      FOR v_rule_line IN
        SELECT prl.side, prl.account_id, ca.code AS account_code
        FROM posting_rule_lines prl JOIN chart_of_accounts ca ON ca.id = prl.account_id
        WHERE prl.posting_rule_id = v_rule.rule_id ORDER BY prl.line_number
      LOOP
        IF v_rule_line.side = 'DEBIT' AND v_a_cogs IS NULL THEN v_a_cogs := v_rule_line.account_id;
        ELSIF v_rule_line.side = 'CREDIT' AND v_a_inv IS NULL THEN v_a_inv := v_rule_line.account_id;
        END IF;
      END LOOP;
    END IF;
  END IF;

  IF v_a_cogs IS NULL THEN SELECT id INTO v_a_cogs FROM chart_of_accounts WHERE tenant_id = p_tenant_id AND code = '5010' AND is_active LIMIT 1; END IF;
  IF v_a_inv IS NULL THEN SELECT id INTO v_a_inv FROM chart_of_accounts WHERE tenant_id = p_tenant_id AND code = '1300' AND is_active LIMIT 1; END IF;
  IF v_a_retail_inv IS NULL THEN SELECT id INTO v_a_retail_inv FROM chart_of_accounts WHERE tenant_id = p_tenant_id AND code = '1320' AND is_active LIMIT 1; END IF;
  IF v_a_markup IS NULL THEN SELECT id INTO v_a_markup FROM chart_of_accounts WHERE tenant_id = p_tenant_id AND code = '1329' AND is_active LIMIT 1; END IF;
  IF v_a_embedded_vat IS NULL THEN SELECT id INTO v_a_embedded_vat FROM chart_of_accounts WHERE tenant_id = p_tenant_id AND code = '1340' AND is_active LIMIT 1; END IF;

  v_fp := check_fiscal_period_open(p_tenant_id, CURRENT_DATE::text);
  v_en := 'POS-' || substr(md5(random()::text), 1, 8);
  INSERT INTO journal_entries (tenant_id, entry_number, entry_date, description, reference, status, fiscal_period_id, posted_at)
  VALUES (p_tenant_id, v_en, CURRENT_DATE, 'POS - ' || v_tx.transaction_number, v_tx.transaction_number, 'posted', v_fp, now())
  RETURNING id INTO v_je;

  -- CR12-01: Split payment GL routing — create per-method debit lines
  IF v_tx.payment_details IS NOT NULL AND jsonb_array_length(v_tx.payment_details::jsonb) > 1 THEN
    -- Multi-method payment: create separate debit lines per payment method
    FOR v_payment IN SELECT * FROM jsonb_array_elements(v_tx.payment_details::jsonb) LOOP
      v_pay_method := v_payment->>'method';
      v_pay_amount := (v_payment->>'amount')::numeric;
      IF v_pay_method = 'cash' THEN v_pay_account := v_acash;
      ELSE v_pay_account := v_abank;
      END IF;
      -- Use v_da as fallback if specific account not found
      IF v_pay_account IS NULL THEN v_pay_account := v_da; END IF;
      INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
      VALUES (v_je, v_pay_account, v_pay_amount, 0, 'POS receipt (' || v_pay_method || ')', 0);
    END LOOP;
  ELSE
    -- Single payment method: original behavior
    INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
    VALUES (v_je, v_da, v_tx.total, 0, 'POS receipt', 0);
  END IF;

  -- Credit lines (revenue + VAT)
  INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order) VALUES
    (v_je, v_a_revenue, 0, v_tx.subtotal, 'Revenue', 1),
    (v_je, v_a_vat, 0, v_tx.tax_amount, 'Output VAT', 2);

  IF v_tx.warehouse_id IS NOT NULL AND v_a_cogs IS NOT NULL THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_tx.items::jsonb) LOOP
      v_pid := (v_item->>'product_id')::uuid;
      v_qty := (v_item->>'quantity')::numeric;
      IF v_pid IS NULL THEN CONTINUE; END IF;
      SELECT COALESCE(purchase_price, 0) INTO v_pcost FROM products WHERE id = v_pid;
      IF v_pcost > 0 THEN v_cogs := v_cogs + (v_pcost * v_qty); END IF;
      UPDATE inventory_stock SET quantity_on_hand = quantity_on_hand - v_qty WHERE product_id = v_pid AND warehouse_id = v_tx.warehouse_id;
      INSERT INTO inventory_movements (tenant_id, product_id, warehouse_id, movement_type, quantity, reference) VALUES (p_tenant_id, v_pid, v_tx.warehouse_id, 'out', v_qty, v_tx.transaction_number);
    END LOOP;

    IF v_cogs > 0 THEN
      IF (v_use_retail OR v_a_retail_inv IS NOT NULL) AND v_a_markup IS NOT NULL THEN
        v_retail_total := v_tx.subtotal + v_tx.tax_amount;
        v_embedded_vat := v_tx.tax_amount;
        v_markup := v_retail_total - v_embedded_vat - v_cogs;
        INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order) VALUES
          (v_je, v_a_cogs, v_cogs, 0, 'COGS', 3), (v_je, v_a_markup, v_markup, 0, 'Reverse markup', 4);
        IF v_a_embedded_vat IS NOT NULL THEN
          INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order) VALUES
            (v_je, v_a_embedded_vat, v_embedded_vat, 0, 'Release embedded VAT', 5);
        END IF;
        INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order) VALUES
          (v_je, v_a_retail_inv, 0, v_retail_total, 'Retail inv out (incl. VAT)', 6);
      ELSIF v_a_inv IS NOT NULL THEN
        INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order) VALUES
          (v_je, v_a_cogs, v_cogs, 0, 'COGS', 3), (v_je, v_a_inv, 0, v_cogs, 'Inventory out', 4);
      END IF;
    END IF;
  END IF;

  UPDATE pos_transactions SET journal_entry_id = v_je WHERE id = p_transaction_id;
  RETURN v_je;
END;
$$;
