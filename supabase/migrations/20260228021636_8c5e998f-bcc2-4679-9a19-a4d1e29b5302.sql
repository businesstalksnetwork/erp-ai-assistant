
-- =============================================
-- Phase 1: Security & Data Integrity Migration
-- =============================================

-- -----------------------------------------------
-- 1.1: Fix RLS policies to use get_user_tenant_ids()
-- -----------------------------------------------

-- service_contracts
DROP POLICY IF EXISTS "Tenant members can view service contracts" ON service_contracts;
DROP POLICY IF EXISTS "Tenant members can create service contracts" ON service_contracts;
DROP POLICY IF EXISTS "Tenant members can update service contracts" ON service_contracts;
DROP POLICY IF EXISTS "Tenant members can delete service contracts" ON service_contracts;

CREATE POLICY "Tenant members can view service contracts" ON service_contracts FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant members can create service contracts" ON service_contracts FOR INSERT
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant members can update service contracts" ON service_contracts FOR UPDATE
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant members can delete service contracts" ON service_contracts FOR DELETE
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- loyalty_programs
DROP POLICY IF EXISTS "Tenant members can manage loyalty programs" ON loyalty_programs;
DROP POLICY IF EXISTS "Tenant members can view loyalty programs" ON loyalty_programs;
DROP POLICY IF EXISTS "Tenant members can create loyalty programs" ON loyalty_programs;
DROP POLICY IF EXISTS "Tenant members can update loyalty programs" ON loyalty_programs;
DROP POLICY IF EXISTS "Tenant members can delete loyalty programs" ON loyalty_programs;

CREATE POLICY "Tenant members can view loyalty programs" ON loyalty_programs FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant members can create loyalty programs" ON loyalty_programs FOR INSERT
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant members can update loyalty programs" ON loyalty_programs FOR UPDATE
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant members can delete loyalty programs" ON loyalty_programs FOR DELETE
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- loyalty_members
DROP POLICY IF EXISTS "Tenant members can manage loyalty members" ON loyalty_members;
DROP POLICY IF EXISTS "Tenant members can view loyalty members" ON loyalty_members;
DROP POLICY IF EXISTS "Tenant members can create loyalty members" ON loyalty_members;
DROP POLICY IF EXISTS "Tenant members can update loyalty members" ON loyalty_members;
DROP POLICY IF EXISTS "Tenant members can delete loyalty members" ON loyalty_members;

CREATE POLICY "Tenant members can view loyalty members" ON loyalty_members FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant members can create loyalty members" ON loyalty_members FOR INSERT
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant members can update loyalty members" ON loyalty_members FOR UPDATE
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant members can delete loyalty members" ON loyalty_members FOR DELETE
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- loyalty_transactions
DROP POLICY IF EXISTS "Tenant members can manage loyalty transactions" ON loyalty_transactions;
DROP POLICY IF EXISTS "Tenant members can view loyalty transactions" ON loyalty_transactions;
DROP POLICY IF EXISTS "Tenant members can create loyalty transactions" ON loyalty_transactions;
DROP POLICY IF EXISTS "Tenant members can update loyalty transactions" ON loyalty_transactions;
DROP POLICY IF EXISTS "Tenant members can delete loyalty transactions" ON loyalty_transactions;

CREATE POLICY "Tenant members can view loyalty transactions" ON loyalty_transactions FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant members can create loyalty transactions" ON loyalty_transactions FOR INSERT
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant members can update loyalty transactions" ON loyalty_transactions FOR UPDATE
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- loyalty_rewards
DROP POLICY IF EXISTS "Tenant members can manage loyalty rewards" ON loyalty_rewards;
DROP POLICY IF EXISTS "Tenant members can view loyalty rewards" ON loyalty_rewards;
DROP POLICY IF EXISTS "Tenant members can create loyalty rewards" ON loyalty_rewards;
DROP POLICY IF EXISTS "Tenant members can update loyalty rewards" ON loyalty_rewards;
DROP POLICY IF EXISTS "Tenant members can delete loyalty rewards" ON loyalty_rewards;

CREATE POLICY "Tenant members can view loyalty rewards" ON loyalty_rewards FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant members can create loyalty rewards" ON loyalty_rewards FOR INSERT
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant members can update loyalty rewards" ON loyalty_rewards FOR UPDATE
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant members can delete loyalty rewards" ON loyalty_rewards FOR DELETE
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- loyalty_redemptions
DROP POLICY IF EXISTS "Tenant members can manage loyalty redemptions" ON loyalty_redemptions;
DROP POLICY IF EXISTS "Tenant members can view loyalty redemptions" ON loyalty_redemptions;
DROP POLICY IF EXISTS "Tenant members can create loyalty redemptions" ON loyalty_redemptions;
DROP POLICY IF EXISTS "Tenant members can update loyalty redemptions" ON loyalty_redemptions;
DROP POLICY IF EXISTS "Tenant members can delete loyalty redemptions" ON loyalty_redemptions;

CREATE POLICY "Tenant members can view loyalty redemptions" ON loyalty_redemptions FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant members can create loyalty redemptions" ON loyalty_redemptions FOR INSERT
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant members can update loyalty redemptions" ON loyalty_redemptions FOR UPDATE
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- -----------------------------------------------
-- 1.2: Fix trigger naming collision
-- -----------------------------------------------
DROP TRIGGER IF EXISTS trg_check_journal_balance ON journal_entries;

-- -----------------------------------------------
-- 1.3: Add notifications DELETE policy
-- -----------------------------------------------
DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
CREATE POLICY "Users can delete own notifications" ON notifications FOR DELETE
  USING (auth.uid() = user_id);

-- -----------------------------------------------
-- 1.5: Create complete_pos_transaction RPC
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_pos_transaction(
  p_tenant_id UUID,
  p_transaction_id UUID,
  p_warehouse_id UUID,
  p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_product_id UUID;
  v_quantity NUMERIC;
  v_item_name TEXT;
  v_errors TEXT[] := '{}';
  v_inv RECORD;
BEGIN
  -- Validate tenant membership
  PERFORM assert_tenant_member(p_tenant_id);

  -- Verify transaction belongs to tenant
  IF NOT EXISTS (
    SELECT 1 FROM pos_transactions
    WHERE id = p_transaction_id AND tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'Transaction not found or access denied';
  END IF;

  -- Skip if no warehouse
  IF p_warehouse_id IS NULL THEN
    RETURN jsonb_build_object('status', 'skipped', 'reason', 'no_warehouse');
  END IF;

  -- Process each item atomically
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity   := (v_item->>'quantity')::NUMERIC;
    v_item_name  := v_item->>'name';

    IF v_product_id IS NULL THEN
      CONTINUE;
    END IF;

    -- Lock inventory row
    SELECT * INTO v_inv FROM inventory
    WHERE tenant_id = p_tenant_id
      AND product_id = v_product_id
      AND warehouse_id = p_warehouse_id
    FOR UPDATE;

    -- Consume FIFO layers
    BEGIN
      PERFORM consume_fifo_layers(
        p_tenant_id   := p_tenant_id,
        p_product_id  := v_product_id,
        p_warehouse_id := p_warehouse_id,
        p_quantity    := v_quantity
      );
    EXCEPTION WHEN OTHERS THEN
      v_errors := array_append(v_errors, 'FIFO:' || v_item_name || ':' || SQLERRM);
    END;

    -- Adjust physical stock
    BEGIN
      PERFORM adjust_inventory_stock(
        p_tenant_id    := p_tenant_id,
        p_product_id   := v_product_id,
        p_warehouse_id := p_warehouse_id,
        p_quantity     := -v_quantity,
        p_reference    := 'POS sale ' || p_transaction_id::TEXT
      );
    EXCEPTION WHEN OTHERS THEN
      v_errors := array_append(v_errors, 'Stock:' || v_item_name || ':' || SQLERRM);
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'status', CASE WHEN array_length(v_errors, 1) > 0 THEN 'partial' ELSE 'success' END,
    'errors', to_jsonb(v_errors)
  );
END;
$$;

-- -----------------------------------------------
-- 1.6: Fix loyalty points race condition
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION public.redeem_loyalty_points(
  p_tenant_id UUID,
  p_member_id UUID,
  p_points INTEGER,
  p_reward_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT 'Points redemption'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member RECORD;
  v_transaction_id UUID;
BEGIN
  -- Validate tenant membership
  PERFORM assert_tenant_member(p_tenant_id);

  -- Lock the member row to prevent concurrent overdraw
  SELECT * INTO v_member
  FROM loyalty_members
  WHERE id = p_member_id AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Loyalty member not found';
  END IF;

  IF v_member.current_points < p_points THEN
    RAISE EXCEPTION 'Insufficient loyalty points. Available: %, Requested: %', v_member.current_points, p_points;
  END IF;

  -- Deduct points
  UPDATE loyalty_members
  SET current_points = current_points - p_points,
      updated_at = now()
  WHERE id = p_member_id AND tenant_id = p_tenant_id;

  -- Record transaction
  INSERT INTO loyalty_transactions (
    tenant_id, member_id, type, points, description, reward_id
  ) VALUES (
    p_tenant_id, p_member_id, 'redeem', p_points, p_description, p_reward_id
  )
  RETURNING id INTO v_transaction_id;

  -- If reward specified, create redemption record
  IF p_reward_id IS NOT NULL THEN
    INSERT INTO loyalty_redemptions (
      tenant_id, member_id, reward_id, points_used, transaction_id, status
    ) VALUES (
      p_tenant_id, p_member_id, p_reward_id, p_points, v_transaction_id, 'completed'
    );
  END IF;

  RETURN v_transaction_id;
END;
$$;

-- -----------------------------------------------
-- 1.7: Harden execute_readonly_query
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION public.execute_readonly_query(query_text TEXT, tenant_id_param UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '5s'
AS $$
DECLARE
  result JSONB;
  lower_query TEXT;
  sanitized_query TEXT;
BEGIN
  -- Validate tenant membership
  PERFORM assert_tenant_member(tenant_id_param);

  lower_query := lower(trim(query_text));

  -- Must start with SELECT
  IF NOT (lower_query LIKE 'select%') THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;

  -- Block dangerous patterns
  IF lower_query ~ '(insert|update|delete|drop|create|alter|truncate|grant|revoke|copy|execute|call)\s' THEN
    RAISE EXCEPTION 'Only read-only queries are allowed';
  END IF;

  -- Block access to system schemas
  IF lower_query ~ '(information_schema|pg_catalog|pg_temp|auth\.|storage\.|supabase_)' THEN
    RAISE EXCEPTION 'Access to system schemas is not allowed';
  END IF;

  -- Block UNION for SQL injection prevention
  IF lower_query ~ '\bunion\b' THEN
    RAISE EXCEPTION 'UNION queries are not allowed';
  END IF;

  -- Force LIMIT 100 if no LIMIT clause present
  sanitized_query := query_text;
  IF NOT (lower_query ~ '\blimit\b') THEN
    sanitized_query := sanitized_query || ' LIMIT 100';
  END IF;

  -- Execute
  EXECUTE format('SELECT jsonb_agg(row_to_json(t)) FROM (%s) t', sanitized_query)
  INTO result;

  RETURN COALESCE(result, '[]'::JSONB);
END;
$$;
