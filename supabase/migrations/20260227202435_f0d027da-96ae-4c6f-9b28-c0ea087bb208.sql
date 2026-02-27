
-- Phase 5: GL Posting Improvements — POS COGS + Production rules

-- 1. Seed payment models (direction must be IN/OUT/INTERNAL/NONE)
INSERT INTO public.payment_models (code, name_en, name_sr, description, direction, is_system, affects_bank, requires_invoice, allows_partial)
VALUES 
  ('POS_SALE_REVENUE', 'POS Sale Revenue', 'POS prodaja - prihod', 'Revenue recognition for POS sales', 'IN', true, false, false, false),
  ('POS_SALE_COGS', 'POS Sale COGS', 'POS prodaja - COR', 'Cost of goods sold for POS', 'OUT', true, false, false, false),
  ('POS_SALE_RETAIL', 'POS Sale Retail', 'POS maloprodajno knjiženje', 'Retail method COGS posting', 'OUT', true, false, false, false),
  ('PRODUCTION_COMPLETION', 'Production Completion', 'Završetak proizvodnje', 'Finished goods from production', 'INTERNAL', true, false, false, false)
ON CONFLICT (code) DO NOTHING;

-- 2. Update process_pos_sale to use posting rules with fallback
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

  IF v_da IS NULL THEN
    SELECT id INTO v_acash FROM chart_of_accounts WHERE tenant_id = p_tenant_id AND code = '2430' AND is_active LIMIT 1;
    SELECT id INTO v_abank FROM chart_of_accounts WHERE tenant_id = p_tenant_id AND code = '2431' AND is_active LIMIT 1;
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

  INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order) VALUES
    (v_je, v_da, v_tx.total, 0, 'POS receipt', 0),
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

-- 3. Update complete_production_order to use posting rules with fallback
CREATE OR REPLACE FUNCTION public.complete_production_order(
  p_order_id UUID, p_warehouse_id UUID,
  p_quantity_to_complete NUMERIC DEFAULT NULL, p_user_id UUID DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_order RECORD; v_bom_line RECORD;
  v_consume_qty NUMERIC; v_unit_cost NUMERIC; v_total_material_cost NUMERIC := 0;
  v_actual_qty NUMERIC; v_stock_qty NUMERIC;
  v_a_finished uuid; v_a_wip uuid;
  v_fp_id UUID; v_je_id UUID; v_entry_number TEXT; v_entry_date DATE;
  v_rule RECORD; v_rule_line RECORD;
BEGIN
  SELECT po.*, p.name AS product_name, p.purchase_price INTO v_order
  FROM production_orders po LEFT JOIN products p ON p.id = po.product_id WHERE po.id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Production order not found'; END IF;
  IF v_order.status NOT IN ('planned', 'in_progress') THEN
    RAISE EXCEPTION 'Order must be planned or in_progress. Current: %', v_order.status;
  END IF;

  v_actual_qty := COALESCE(p_quantity_to_complete, v_order.quantity - v_order.completed_quantity);
  IF v_actual_qty <= 0 THEN RAISE EXCEPTION 'Nothing to complete'; END IF;
  IF v_order.completed_quantity + v_actual_qty > v_order.quantity THEN
    RAISE EXCEPTION 'Cannot complete more than ordered (%)' , v_order.quantity;
  END IF;

  IF v_order.bom_template_id IS NOT NULL THEN
    FOR v_bom_line IN
      SELECT bl.material_product_id, bl.quantity AS bom_qty, p.purchase_price, p.name AS material_name
      FROM bom_lines bl LEFT JOIN products p ON p.id = bl.material_product_id
      WHERE bl.bom_template_id = v_order.bom_template_id
    LOOP
      v_consume_qty := v_bom_line.bom_qty * v_actual_qty;
      v_unit_cost := COALESCE(v_bom_line.purchase_price, 0);
      v_total_material_cost := v_total_material_cost + (v_consume_qty * v_unit_cost);
      SELECT COALESCE(quantity_on_hand, 0) INTO v_stock_qty FROM inventory_stock
        WHERE product_id = v_bom_line.material_product_id AND warehouse_id = p_warehouse_id;
      IF COALESCE(v_stock_qty, 0) < v_consume_qty THEN
        RAISE EXCEPTION 'Insufficient stock for "%" (need %, have %)', v_bom_line.material_name, v_consume_qty, COALESCE(v_stock_qty, 0);
      END IF;
      PERFORM adjust_inventory_stock(v_order.tenant_id, v_bom_line.material_product_id, p_warehouse_id,
        -v_consume_qty, 'out', 'Material consumption', p_user_id, 'PROD-' || COALESCE(v_order.order_number, v_order.id::text));
    END LOOP;
  END IF;

  IF v_order.product_id IS NOT NULL THEN
    PERFORM adjust_inventory_stock(v_order.tenant_id, v_order.product_id, p_warehouse_id,
      v_actual_qty, 'in', 'Finished goods output', p_user_id, 'PROD-' || COALESCE(v_order.order_number, v_order.id::text));
  END IF;

  IF v_total_material_cost > 0 THEN
    SELECT pr.id AS rule_id INTO v_rule
    FROM posting_rules pr JOIN payment_models pm ON pm.id = pr.payment_model_id
    WHERE pm.code = 'PRODUCTION_COMPLETION' AND pr.tenant_id = v_order.tenant_id AND pr.is_active LIMIT 1;

    IF v_rule.rule_id IS NOT NULL THEN
      FOR v_rule_line IN
        SELECT prl.side, prl.account_id FROM posting_rule_lines prl
        WHERE prl.posting_rule_id = v_rule.rule_id ORDER BY prl.line_number
      LOOP
        IF v_rule_line.side = 'DEBIT' AND v_a_finished IS NULL THEN v_a_finished := v_rule_line.account_id;
        ELSIF v_rule_line.side = 'CREDIT' AND v_a_wip IS NULL THEN v_a_wip := v_rule_line.account_id;
        END IF;
      END LOOP;
    END IF;

    IF v_a_finished IS NULL THEN SELECT id INTO v_a_finished FROM chart_of_accounts WHERE tenant_id = v_order.tenant_id AND code = '5100' AND is_active LIMIT 1; END IF;
    IF v_a_wip IS NULL THEN SELECT id INTO v_a_wip FROM chart_of_accounts WHERE tenant_id = v_order.tenant_id AND code = '5000' AND is_active LIMIT 1; END IF;
    IF v_a_finished IS NULL OR v_a_wip IS NULL THEN RAISE EXCEPTION 'Missing accounts for production posting (5100/5000)'; END IF;

    v_entry_date := CURRENT_DATE;
    v_fp_id := check_fiscal_period_open(v_order.tenant_id, v_entry_date);
    v_entry_number := 'PROD-' || COALESCE(v_order.order_number, v_order.id::text);

    INSERT INTO journal_entries (tenant_id, entry_number, entry_date, description, reference, status, fiscal_period_id, posted_at, posted_by, created_by)
    VALUES (v_order.tenant_id, v_entry_number, v_entry_date,
      'Production completion - ' || COALESCE(v_order.product_name, v_order.order_number),
      v_order.order_number, 'posted', v_fp_id, now(), p_user_id, p_user_id)
    RETURNING id INTO v_je_id;

    INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order) VALUES
      (v_je_id, v_a_finished, v_total_material_cost, 0, 'Finished goods received', 0),
      (v_je_id, v_a_wip, 0, v_total_material_cost, 'WIP consumed', 1);
  END IF;

  UPDATE production_orders SET
    completed_quantity = completed_quantity + v_actual_qty,
    status = CASE WHEN completed_quantity + v_actual_qty >= quantity THEN 'completed' ELSE 'in_progress' END,
    actual_end = CASE WHEN completed_quantity + v_actual_qty >= quantity THEN CURRENT_DATE ELSE actual_end END
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true, 'completed_quantity', v_actual_qty,
    'total_completed', v_order.completed_quantity + v_actual_qty,
    'material_cost', v_total_material_cost, 'journal_entry_id', v_je_id,
    'fully_completed', (v_order.completed_quantity + v_actual_qty >= v_order.quantity)
  );
END;
$$;
