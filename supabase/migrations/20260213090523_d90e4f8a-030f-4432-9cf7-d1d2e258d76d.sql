
-- 1. Stock reservation RPCs

CREATE OR REPLACE FUNCTION public.reserve_stock_for_order(p_tenant_id uuid, p_sales_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_line RECORD;
  v_warehouse_id uuid;
BEGIN
  FOR v_line IN
    SELECT product_id, quantity FROM public.sales_order_lines
    WHERE sales_order_id = p_sales_order_id AND product_id IS NOT NULL
  LOOP
    -- Pick the warehouse with the most stock for this product
    SELECT warehouse_id INTO v_warehouse_id
    FROM public.inventory_stock
    WHERE tenant_id = p_tenant_id AND product_id = v_line.product_id
    ORDER BY quantity_on_hand DESC
    LIMIT 1;

    IF v_warehouse_id IS NOT NULL THEN
      UPDATE public.inventory_stock
      SET quantity_reserved = quantity_reserved + v_line.quantity, updated_at = now()
      WHERE tenant_id = p_tenant_id AND product_id = v_line.product_id AND warehouse_id = v_warehouse_id;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_stock_for_order(p_tenant_id uuid, p_sales_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_line RECORD;
  v_warehouse_id uuid;
BEGIN
  FOR v_line IN
    SELECT product_id, quantity FROM public.sales_order_lines
    WHERE sales_order_id = p_sales_order_id AND product_id IS NOT NULL
  LOOP
    -- Pick the warehouse with the most reserved stock for this product
    SELECT warehouse_id INTO v_warehouse_id
    FROM public.inventory_stock
    WHERE tenant_id = p_tenant_id AND product_id = v_line.product_id AND quantity_reserved > 0
    ORDER BY quantity_reserved DESC
    LIMIT 1;

    IF v_warehouse_id IS NOT NULL THEN
      UPDATE public.inventory_stock
      SET quantity_reserved = GREATEST(quantity_reserved - v_line.quantity, 0), updated_at = now()
      WHERE tenant_id = p_tenant_id AND product_id = v_line.product_id AND warehouse_id = v_warehouse_id;
    END IF;
  END LOOP;
END;
$$;

-- 2. Add cash reconciliation columns to pos_daily_reports
ALTER TABLE public.pos_daily_reports
  ADD COLUMN IF NOT EXISTS opening_float NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_cash_count NUMERIC,
  ADD COLUMN IF NOT EXISTS cash_variance NUMERIC;
