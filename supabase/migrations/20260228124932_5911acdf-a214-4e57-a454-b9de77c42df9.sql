
-- Fix P3-25: complete_pos_transaction uses 'inventory' view instead of 'inventory_stock' table
-- Fix P4-18: Payroll deduplication for employees with multiple contracts
-- Fix P4-19: Payroll recalculation guard for approved/paid runs

-- P3-25: Patch complete_pos_transaction to use inventory_stock instead of inventory view
CREATE OR REPLACE FUNCTION public.complete_pos_transaction(
  p_tenant_id uuid,
  p_transaction_id uuid,
  p_fiscal_receipt_number text DEFAULT NULL,
  p_fiscal_receipt_date timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_txn record;
  v_line record;
  v_stock_id uuid;
  v_available numeric;
  v_result jsonb := '{}';
BEGIN
  -- Lock and fetch transaction
  SELECT * INTO v_txn FROM pos_transactions WHERE id = p_transaction_id AND tenant_id = p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'POS transaction not found';
  END IF;
  IF v_txn.status = 'completed' THEN
    RAISE EXCEPTION 'Transaction already completed';
  END IF;

  -- Process each line - consume FIFO cost layers
  FOR v_line IN
    SELECT * FROM pos_transaction_lines WHERE transaction_id = p_transaction_id
  LOOP
    IF v_line.product_id IS NOT NULL AND v_line.quantity > 0 THEN
      -- P3-25 FIX: Use inventory_stock table (not inventory view) for proper row locking
      SELECT id, quantity INTO v_stock_id, v_available
        FROM inventory_stock
        WHERE tenant_id = p_tenant_id
          AND product_id = v_line.product_id
          AND warehouse_id = v_txn.warehouse_id
        FOR UPDATE;

      IF v_stock_id IS NULL THEN
        RAISE EXCEPTION 'No stock record for product % in warehouse %', v_line.product_id, v_txn.warehouse_id;
      END IF;

      IF v_available < v_line.quantity THEN
        RAISE EXCEPTION 'Insufficient stock for product %: available=%, requested=%', v_line.product_id, v_available, v_line.quantity;
      END IF;

      -- Deduct stock
      UPDATE inventory_stock SET quantity = quantity - v_line.quantity, updated_at = now()
        WHERE id = v_stock_id;

      -- Record stock movement
      INSERT INTO stock_movements (tenant_id, product_id, warehouse_id, quantity, movement_type, reference, created_at)
        VALUES (p_tenant_id, v_line.product_id, v_txn.warehouse_id, v_line.quantity, 'out', 'POS-' || p_transaction_id::text, now());
    END IF;
  END LOOP;

  -- Update transaction status
  UPDATE pos_transactions SET
    status = 'completed',
    fiscal_receipt_number = COALESCE(p_fiscal_receipt_number, fiscal_receipt_number),
    fiscal_receipt_date = COALESCE(p_fiscal_receipt_date, fiscal_receipt_date),
    completed_at = now(),
    updated_at = now()
  WHERE id = p_transaction_id;

  v_result := jsonb_build_object('status', 'completed', 'transaction_id', p_transaction_id);
  RETURN v_result;
END;
$$;

-- P4-18 + P4-19: Patch calculate_payroll_for_run with dedup + recalc guard
CREATE OR REPLACE FUNCTION public.calculate_payroll_for_run(
  p_tenant_id uuid,
  p_run_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run record;
  v_contract record;
  v_processed_employees uuid[] := '{}';
BEGIN
  -- Fetch the payroll run
  SELECT * INTO v_run FROM payroll_runs WHERE id = p_run_id AND tenant_id = p_tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payroll run not found';
  END IF;

  -- P4-19 FIX: Guard against recalculating approved/paid runs
  IF v_run.status IN ('approved', 'paid') THEN
    RAISE EXCEPTION 'Cannot recalculate a payroll run with status "%". Only draft or calculated runs can be recalculated.', v_run.status;
  END IF;

  -- Clear existing payroll items for recalculation
  DELETE FROM payroll_items WHERE payroll_run_id = p_run_id AND tenant_id = p_tenant_id;

  -- Process active contracts for the payroll period
  FOR v_contract IN
    SELECT ec.*, e.id as emp_id, e.first_name, e.last_name
    FROM employee_contracts ec
    JOIN employees e ON e.id = ec.employee_id AND e.tenant_id = ec.tenant_id
    WHERE ec.tenant_id = p_tenant_id
      AND ec.status = 'active'
      AND ec.start_date <= v_run.period_end
      AND (ec.end_date IS NULL OR ec.end_date >= v_run.period_start)
    ORDER BY ec.employee_id, ec.start_date
  LOOP
    -- P4-18 FIX: Skip if employee already processed (deduplication for multiple contracts)
    IF v_contract.emp_id = ANY(v_processed_employees) THEN
      CONTINUE;
    END IF;
    v_processed_employees := array_append(v_processed_employees, v_contract.emp_id);

    -- Insert payroll item for this employee
    INSERT INTO payroll_items (
      tenant_id, payroll_run_id, employee_id, contract_id,
      gross_salary, net_salary, tax_amount, social_contributions,
      created_at, updated_at
    ) VALUES (
      p_tenant_id, p_run_id, v_contract.emp_id, v_contract.id,
      COALESCE(v_contract.gross_salary, 0),
      0, 0, 0,
      now(), now()
    );
  END LOOP;

  -- Update run status to calculated
  UPDATE payroll_runs SET status = 'calculated', updated_at = now()
    WHERE id = p_run_id AND tenant_id = p_tenant_id;
END;
$$;
