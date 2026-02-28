
-- Phase 12: Loyalty Module

-- 1. loyalty_programs
CREATE TABLE public.loyalty_programs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  points_per_unit_currency NUMERIC NOT NULL DEFAULT 1,
  tier_thresholds JSONB NOT NULL DEFAULT '{"bronze":0,"silver":1000,"gold":5000,"platinum":20000}'::jsonb,
  expiry_months INTEGER DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.loyalty_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for loyalty_programs" ON public.loyalty_programs
  FOR ALL USING (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid()));

-- 2. loyalty_members
CREATE TABLE public.loyalty_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.loyalty_programs(id) ON DELETE CASCADE,
  points_balance INTEGER NOT NULL DEFAULT 0,
  lifetime_points INTEGER NOT NULL DEFAULT 0,
  current_tier TEXT NOT NULL DEFAULT 'bronze',
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, partner_id, program_id)
);
ALTER TABLE public.loyalty_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for loyalty_members" ON public.loyalty_members
  FOR ALL USING (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid()));

-- 3. loyalty_transactions
CREATE TABLE public.loyalty_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.loyalty_members(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'earn',
  reference_type TEXT DEFAULT NULL,
  reference_id TEXT DEFAULT NULL,
  description TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for loyalty_transactions" ON public.loyalty_transactions
  FOR ALL USING (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid()));

-- 4. loyalty_rewards
CREATE TABLE public.loyalty_rewards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  points_cost INTEGER NOT NULL,
  reward_type TEXT NOT NULL DEFAULT 'discount_pct',
  reward_value NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.loyalty_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for loyalty_rewards" ON public.loyalty_rewards
  FOR ALL USING (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid()));

-- 5. loyalty_redemptions
CREATE TABLE public.loyalty_redemptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.loyalty_members(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES public.loyalty_rewards(id) ON DELETE CASCADE,
  points_spent INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.loyalty_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for loyalty_redemptions" ON public.loyalty_redemptions
  FOR ALL USING (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid()));

-- Indexes
CREATE INDEX idx_loyalty_members_tenant_partner ON public.loyalty_members(tenant_id, partner_id);
CREATE INDEX idx_loyalty_transactions_member ON public.loyalty_transactions(member_id);
CREATE INDEX idx_loyalty_redemptions_member ON public.loyalty_redemptions(member_id);

-- RPC 1: accrue_loyalty_points
CREATE OR REPLACE FUNCTION public.accrue_loyalty_points(
  p_tenant_id UUID, p_partner_id UUID, p_amount NUMERIC,
  p_reference_type TEXT DEFAULT NULL, p_reference_id TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_program loyalty_programs%ROWTYPE;
  v_member loyalty_members%ROWTYPE;
  v_points INTEGER;
  v_new_tier TEXT;
  v_lifetime INTEGER;
BEGIN
  SELECT * INTO v_program FROM loyalty_programs WHERE tenant_id = p_tenant_id AND is_active = true LIMIT 1;
  IF v_program.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'No active loyalty program'); END IF;

  v_points := FLOOR(p_amount * v_program.points_per_unit_currency);
  IF v_points <= 0 THEN RETURN jsonb_build_object('ok', true, 'points', 0); END IF;

  SELECT * INTO v_member FROM loyalty_members WHERE tenant_id = p_tenant_id AND partner_id = p_partner_id AND program_id = v_program.id;
  IF v_member.id IS NULL THEN
    INSERT INTO loyalty_members (tenant_id, partner_id, program_id) VALUES (p_tenant_id, p_partner_id, v_program.id) RETURNING * INTO v_member;
  END IF;

  INSERT INTO loyalty_transactions (tenant_id, member_id, points, type, reference_type, reference_id, description)
  VALUES (p_tenant_id, v_member.id, v_points, 'earn', p_reference_type, p_reference_id, 'Earned ' || v_points || ' points');

  v_lifetime := v_member.lifetime_points + v_points;
  v_new_tier := 'bronze';
  IF v_lifetime >= COALESCE((v_program.tier_thresholds->>'platinum')::int, 20000) THEN v_new_tier := 'platinum';
  ELSIF v_lifetime >= COALESCE((v_program.tier_thresholds->>'gold')::int, 5000) THEN v_new_tier := 'gold';
  ELSIF v_lifetime >= COALESCE((v_program.tier_thresholds->>'silver')::int, 1000) THEN v_new_tier := 'silver';
  END IF;

  UPDATE loyalty_members SET points_balance = points_balance + v_points, lifetime_points = v_lifetime, current_tier = v_new_tier, updated_at = now() WHERE id = v_member.id;

  RETURN jsonb_build_object('ok', true, 'points', v_points, 'new_balance', v_member.points_balance + v_points, 'tier', v_new_tier);
END; $$;

-- RPC 2: redeem_loyalty_points
CREATE OR REPLACE FUNCTION public.redeem_loyalty_points(
  p_tenant_id UUID, p_member_id UUID, p_reward_id UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_member loyalty_members%ROWTYPE;
  v_reward loyalty_rewards%ROWTYPE;
BEGIN
  SELECT * INTO v_member FROM loyalty_members WHERE id = p_member_id AND tenant_id = p_tenant_id;
  IF v_member.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Member not found'); END IF;

  SELECT * INTO v_reward FROM loyalty_rewards WHERE id = p_reward_id AND tenant_id = p_tenant_id AND is_active = true;
  IF v_reward.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Reward not found'); END IF;

  IF v_member.points_balance < v_reward.points_cost THEN RETURN jsonb_build_object('ok', false, 'error', 'Insufficient points'); END IF;

  UPDATE loyalty_members SET points_balance = points_balance - v_reward.points_cost, updated_at = now() WHERE id = p_member_id;

  INSERT INTO loyalty_transactions (tenant_id, member_id, points, type, reference_type, reference_id, description)
  VALUES (p_tenant_id, p_member_id, -v_reward.points_cost, 'redeem', 'reward', p_reward_id::text, 'Redeemed: ' || v_reward.name);

  INSERT INTO loyalty_redemptions (tenant_id, member_id, reward_id, points_spent) VALUES (p_tenant_id, p_member_id, p_reward_id, v_reward.points_cost);

  RETURN jsonb_build_object('ok', true, 'points_spent', v_reward.points_cost, 'new_balance', v_member.points_balance - v_reward.points_cost);
END; $$;

-- RPC 3: get_loyalty_summary
CREATE OR REPLACE FUNCTION public.get_loyalty_summary(
  p_tenant_id UUID, p_partner_id UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_member loyalty_members%ROWTYPE;
  v_recent JSONB;
  v_rewards JSONB;
BEGIN
  SELECT * INTO v_member FROM loyalty_members WHERE tenant_id = p_tenant_id AND partner_id = p_partner_id LIMIT 1;
  IF v_member.id IS NULL THEN RETURN jsonb_build_object('enrolled', false); END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_recent
  FROM (SELECT id, points, type, description, created_at FROM loyalty_transactions WHERE member_id = v_member.id ORDER BY created_at DESC LIMIT 10) t;

  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb) INTO v_rewards
  FROM (SELECT id, name, points_cost, reward_type, reward_value FROM loyalty_rewards WHERE tenant_id = p_tenant_id AND is_active = true ORDER BY points_cost) r;

  RETURN jsonb_build_object('enrolled', true, 'member_id', v_member.id, 'points_balance', v_member.points_balance,
    'lifetime_points', v_member.lifetime_points, 'current_tier', v_member.current_tier,
    'recent_transactions', v_recent, 'available_rewards', v_rewards);
END; $$;

-- Timestamps triggers
CREATE TRIGGER update_loyalty_programs_updated_at BEFORE UPDATE ON public.loyalty_programs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_loyalty_members_updated_at BEFORE UPDATE ON public.loyalty_members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_loyalty_rewards_updated_at BEFORE UPDATE ON public.loyalty_rewards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
