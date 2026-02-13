
-- Phase 1.2: Add columns to production_orders
ALTER TABLE public.production_orders
  ADD COLUMN IF NOT EXISTS order_number TEXT,
  ADD COLUMN IF NOT EXISTS completed_quantity NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_start DATE;

-- Phase 1.3: Add BOM version column
ALTER TABLE public.bom_templates
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;

-- Phase 1.4: Production waste table
CREATE TABLE IF NOT EXISTS public.production_waste (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  production_order_id UUID NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity NUMERIC NOT NULL DEFAULT 0,
  reason TEXT,
  recorded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.production_waste ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for production_waste"
  ON public.production_waste
  FOR ALL
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())))
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- Auto-generate order_number trigger
CREATE OR REPLACE FUNCTION public.generate_production_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_seq INT;
  v_year INT;
BEGIN
  v_year := EXTRACT(YEAR FROM now())::int;
  SELECT COALESCE(MAX(
    CASE WHEN order_number ~ ('^PRO-' || v_year || '-\d+$')
         THEN CAST(SUBSTRING(order_number FROM 'PRO-\d{4}-(\d+)$') AS INT)
         ELSE 0
    END
  ), 0) + 1 INTO v_seq
  FROM public.production_orders
  WHERE tenant_id = NEW.tenant_id;

  NEW.order_number := 'PRO-' || v_year || '-' || LPAD(v_seq::text, 4, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_production_order_number
  BEFORE INSERT ON public.production_orders
  FOR EACH ROW
  WHEN (NEW.order_number IS NULL)
  EXECUTE FUNCTION public.generate_production_order_number();

-- Backfill existing rows using CTE
WITH numbered AS (
  SELECT id, tenant_id, created_at,
    ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at) AS rn
  FROM public.production_orders
  WHERE order_number IS NULL
)
UPDATE public.production_orders po
SET order_number = 'PRO-' || EXTRACT(YEAR FROM numbered.created_at)::int || '-' || LPAD(numbered.rn::text, 4, '0')
FROM numbered
WHERE po.id = numbered.id;

-- Atomic complete_production_order RPC
CREATE OR REPLACE FUNCTION public.complete_production_order(
  p_order_id UUID,
  p_warehouse_id UUID,
  p_quantity_to_complete NUMERIC DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order RECORD;
  v_bom_line RECORD;
  v_consume_qty NUMERIC;
  v_unit_cost NUMERIC;
  v_total_material_cost NUMERIC := 0;
  v_actual_qty NUMERIC;
  v_stock_qty NUMERIC;
  v_a5100 UUID;
  v_a5000 UUID;
  v_fp_id UUID;
  v_je_id UUID;
  v_entry_number TEXT;
  v_entry_date DATE;
  v_result JSONB;
BEGIN
  SELECT po.*, p.name AS product_name, p.purchase_price
  INTO v_order
  FROM production_orders po
  LEFT JOIN products p ON p.id = po.product_id
  WHERE po.id = p_order_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Production order not found'; END IF;

  IF v_order.status NOT IN ('planned', 'in_progress') THEN
    RAISE EXCEPTION 'Order must be planned or in_progress to complete. Current: %', v_order.status;
  END IF;

  v_actual_qty := COALESCE(p_quantity_to_complete, v_order.quantity - v_order.completed_quantity);
  IF v_actual_qty <= 0 THEN RAISE EXCEPTION 'Nothing to complete'; END IF;
  IF v_order.completed_quantity + v_actual_qty > v_order.quantity THEN
    RAISE EXCEPTION 'Cannot complete more than ordered (%)' , v_order.quantity;
  END IF;

  -- Consume BOM materials
  IF v_order.bom_template_id IS NOT NULL THEN
    FOR v_bom_line IN
      SELECT bl.material_product_id, bl.quantity AS bom_qty, p.purchase_price, p.name AS material_name
      FROM bom_lines bl
      LEFT JOIN products p ON p.id = bl.material_product_id
      WHERE bl.bom_template_id = v_order.bom_template_id
    LOOP
      v_consume_qty := v_bom_line.bom_qty * v_actual_qty;
      v_unit_cost := COALESCE(v_bom_line.purchase_price, 0);
      v_total_material_cost := v_total_material_cost + (v_consume_qty * v_unit_cost);

      SELECT COALESCE(quantity_on_hand, 0) INTO v_stock_qty
      FROM inventory_stock
      WHERE product_id = v_bom_line.material_product_id AND warehouse_id = p_warehouse_id;

      IF COALESCE(v_stock_qty, 0) < v_consume_qty THEN
        RAISE EXCEPTION 'Insufficient stock for "%" (need %, have %)',
          v_bom_line.material_name, v_consume_qty, COALESCE(v_stock_qty, 0);
      END IF;

      PERFORM adjust_inventory_stock(
        v_order.tenant_id, v_bom_line.material_product_id, p_warehouse_id,
        -v_consume_qty, 'out', 'Material consumption', p_user_id,
        'PROD-' || COALESCE(v_order.order_number, v_order.id::text)
      );
    END LOOP;
  END IF;

  -- Add finished goods
  IF v_order.product_id IS NOT NULL THEN
    PERFORM adjust_inventory_stock(
      v_order.tenant_id, v_order.product_id, p_warehouse_id,
      v_actual_qty, 'in', 'Finished goods output', p_user_id,
      'PROD-' || COALESCE(v_order.order_number, v_order.id::text)
    );
  END IF;

  -- WIP journal entry (D:5100 / P:5000)
  IF v_total_material_cost > 0 THEN
    SELECT id INTO v_a5100 FROM chart_of_accounts WHERE tenant_id = v_order.tenant_id AND code = '5100' AND is_active LIMIT 1;
    SELECT id INTO v_a5000 FROM chart_of_accounts WHERE tenant_id = v_order.tenant_id AND code = '5000' AND is_active LIMIT 1;
    IF v_a5100 IS NULL OR v_a5000 IS NULL THEN RAISE EXCEPTION 'Missing accounts 5100/5000'; END IF;

    v_entry_date := CURRENT_DATE;
    v_fp_id := check_fiscal_period_open(v_order.tenant_id, v_entry_date);
    v_entry_number := 'PROD-' || COALESCE(v_order.order_number, v_order.id::text);

    INSERT INTO journal_entries (tenant_id, entry_number, entry_date, description, reference, status, fiscal_period_id, posted_at, posted_by, created_by)
    VALUES (v_order.tenant_id, v_entry_number, v_entry_date,
      'Production completion - ' || COALESCE(v_order.product_name, v_order.order_number),
      v_order.order_number, 'posted', v_fp_id, now(), p_user_id, p_user_id)
    RETURNING id INTO v_je_id;

    INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order) VALUES
      (v_je_id, v_a5100, v_total_material_cost, 0, 'Finished goods received', 0),
      (v_je_id, v_a5000, 0, v_total_material_cost, 'WIP consumed', 1);
  END IF;

  -- Update order
  UPDATE production_orders SET
    completed_quantity = completed_quantity + v_actual_qty,
    status = CASE WHEN completed_quantity + v_actual_qty >= quantity THEN 'completed' ELSE 'in_progress' END,
    actual_end = CASE WHEN completed_quantity + v_actual_qty >= quantity THEN CURRENT_DATE ELSE actual_end END
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'completed_quantity', v_actual_qty,
    'total_completed', v_order.completed_quantity + v_actual_qty,
    'material_cost', v_total_material_cost,
    'journal_entry_id', v_je_id,
    'fully_completed', (v_order.completed_quantity + v_actual_qty >= v_order.quantity)
  );
END;
$$;
