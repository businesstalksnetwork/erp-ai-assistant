
DROP FUNCTION IF EXISTS public.complete_production_order(UUID, UUID, NUMERIC, UUID);

CREATE FUNCTION public.complete_production_order(
  p_tenant_id UUID,
  p_order_id UUID,
  p_actual_quantity NUMERIC,
  p_warehouse_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_bom_line RECORD;
  v_total_qty NUMERIC;
  v_wh_id UUID;
  v_order_number TEXT;
BEGIN
  SELECT * INTO v_order
  FROM production_orders
  WHERE id = p_order_id AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Production order not found';
  END IF;

  IF v_order.status = 'completed' THEN
    RAISE EXCEPTION 'Order already completed';
  END IF;

  v_order_number := COALESCE(v_order.order_number, p_order_id::TEXT);
  v_wh_id := COALESCE(p_warehouse_id, v_order.warehouse_id);

  IF v_wh_id IS NULL THEN
    SELECT id INTO v_wh_id FROM warehouses WHERE tenant_id = p_tenant_id AND is_default = true LIMIT 1;
  END IF;

  FOR v_bom_line IN
    SELECT bl.product_id, bl.quantity, p.name as product_name
    FROM bom_lines bl
    JOIN products p ON p.id = bl.product_id
    WHERE bl.bom_template_id = v_order.bom_template_id
  LOOP
    v_total_qty := v_bom_line.quantity * p_actual_quantity;
    PERFORM adjust_inventory_stock(
      p_tenant_id,
      v_bom_line.product_id,
      v_wh_id,
      -v_total_qty,
      'production_consumption',
      'Production: ' || v_order_number || ' - ' || v_bom_line.product_name
    );
  END LOOP;

  PERFORM adjust_inventory_stock(
    p_tenant_id,
    v_order.product_id,
    v_wh_id,
    p_actual_quantity,
    'production_output',
    'Production output: ' || v_order_number
  );

  UPDATE production_orders
  SET status = 'completed',
      completed_quantity = p_actual_quantity,
      actual_end_date = CURRENT_DATE,
      updated_at = now()
  WHERE id = p_order_id AND tenant_id = p_tenant_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'actual_quantity', p_actual_quantity,
    'components_deducted', (SELECT count(*) FROM bom_lines WHERE bom_template_id = v_order.bom_template_id)
  );
END;
$$;
