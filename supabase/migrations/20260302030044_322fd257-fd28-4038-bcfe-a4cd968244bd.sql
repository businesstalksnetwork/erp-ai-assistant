
-- CR10-32: Drop and recreate refresh_loyalty_tier with correct parameter names
DROP FUNCTION IF EXISTS public.refresh_loyalty_tier(UUID, UUID);

CREATE FUNCTION public.refresh_loyalty_tier(p_member_id UUID, p_tenant_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lifetime BIGINT;
  v_new_tier TEXT;
  v_program RECORD;
BEGIN
  SELECT lifetime_points INTO v_lifetime
  FROM loyalty_members
  WHERE id = p_member_id AND tenant_id = p_tenant_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT * INTO v_program
  FROM loyalty_programs
  WHERE tenant_id = p_tenant_id AND is_active = true
  LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;

  IF v_lifetime >= COALESCE((v_program.tier_thresholds->>'platinum')::bigint, 50000) THEN
    v_new_tier := 'platinum';
  ELSIF v_lifetime >= COALESCE((v_program.tier_thresholds->>'gold')::bigint, 20000) THEN
    v_new_tier := 'gold';
  ELSIF v_lifetime >= COALESCE((v_program.tier_thresholds->>'silver')::bigint, 5000) THEN
    v_new_tier := 'silver';
  ELSE
    v_new_tier := 'bronze';
  END IF;

  UPDATE loyalty_members
  SET current_tier = v_new_tier, updated_at = now()
  WHERE id = p_member_id AND tenant_id = p_tenant_id;
END;
$$;
