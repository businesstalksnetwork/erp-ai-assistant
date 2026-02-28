
-- Phase 0: Fix complete_production_order param name conflict
-- Drop old signature first, then recreate

DROP FUNCTION IF EXISTS public.complete_production_order(uuid, uuid, numeric, uuid);

CREATE OR REPLACE FUNCTION public.complete_production_order(
  p_order_id UUID, p_warehouse_id UUID,
  p_quantity_to_complete NUMERIC DEFAULT NULL, p_user_id UUID DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
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

    -- FIXED: Added tenant_id to journal_lines INSERT
    INSERT INTO journal_lines (journal_entry_id, tenant_id, account_id, debit, credit, description, sort_order) VALUES
      (v_je_id, v_order.tenant_id, v_a_finished, v_total_material_cost, 0, 'Finished goods received', 0),
      (v_je_id, v_order.tenant_id, v_a_wip, 0, v_total_material_cost, 'WIP consumed', 1);
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
