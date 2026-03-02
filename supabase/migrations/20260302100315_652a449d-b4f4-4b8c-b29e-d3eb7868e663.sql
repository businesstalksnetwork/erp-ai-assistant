
-- CR11-02: Drop old function with swapped params, recreate with correct order
DROP FUNCTION IF EXISTS public.refresh_loyalty_tier(uuid, uuid);

CREATE OR REPLACE FUNCTION public.refresh_loyalty_tier(p_tenant_id UUID, p_member_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_points INTEGER;
  v_new_tier TEXT;
  v_current_tier TEXT;
BEGIN
  SELECT loyalty_tier INTO v_current_tier
  FROM loyalty_members
  WHERE id = p_member_id AND tenant_id = p_tenant_id;

  SELECT COALESCE(SUM(points), 0) INTO v_total_points
  FROM loyalty_transactions
  WHERE member_id = p_member_id AND tenant_id = p_tenant_id;

  SELECT tier_name INTO v_new_tier
  FROM loyalty_tiers
  WHERE tenant_id = p_tenant_id
    AND min_points <= v_total_points
  ORDER BY min_points DESC
  LIMIT 1;

  IF v_new_tier IS NULL THEN
    v_new_tier := 'Bronze';
  END IF;

  -- CR11-08: Only update if tier actually changed
  IF v_current_tier IS DISTINCT FROM v_new_tier THEN
    UPDATE loyalty_members
    SET loyalty_tier = v_new_tier, updated_at = now()
    WHERE id = p_member_id AND tenant_id = p_tenant_id;
  END IF;
END;
$$;
