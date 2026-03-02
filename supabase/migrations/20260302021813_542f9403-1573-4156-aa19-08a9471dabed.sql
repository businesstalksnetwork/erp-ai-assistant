
-- =============================================
-- Phase 4: Loyalty Module Overhaul (LOY-01 to LOY-05)
-- =============================================

-- LOY-01: Add personal fields to loyalty_members for fizička lica
ALTER TABLE public.loyalty_members
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS card_number TEXT,
  ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.loyalty_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Make partner_id nullable (was required before)
ALTER TABLE public.loyalty_members ALTER COLUMN partner_id DROP NOT NULL;

-- Unique card number per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_loyalty_members_card_number 
  ON public.loyalty_members(tenant_id, card_number) WHERE card_number IS NOT NULL;

-- Index for phone/email lookup
CREATE INDEX IF NOT EXISTS idx_loyalty_members_phone ON public.loyalty_members(tenant_id, phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_loyalty_members_email ON public.loyalty_members(tenant_id, email) WHERE email IS NOT NULL;

-- Auto-generate card numbers
CREATE OR REPLACE FUNCTION public.generate_loyalty_card_number()
RETURNS TRIGGER AS $$
DECLARE
  seq_num INT;
  card TEXT;
BEGIN
  IF NEW.card_number IS NULL OR NEW.card_number = '' THEN
    SELECT COALESCE(MAX(
      CASE WHEN card_number ~ '^\d+$' THEN card_number::INT ELSE 0 END
    ), 0) + 1
    INTO seq_num
    FROM public.loyalty_members
    WHERE tenant_id = NEW.tenant_id;
    
    card := LPAD(seq_num::TEXT, 10, '0');
    NEW.card_number := card;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_loyalty_card_number
  BEFORE INSERT ON public.loyalty_members
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_loyalty_card_number();

-- LOY-01: Lookup RPC (by card, phone, or email)
CREATE OR REPLACE FUNCTION public.lookup_loyalty_member(
  p_tenant_id UUID,
  p_query TEXT
)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'id', lm.id,
    'first_name', lm.first_name,
    'last_name', lm.last_name,
    'email', lm.email,
    'phone', lm.phone,
    'card_number', lm.card_number,
    'points_balance', lm.points_balance,
    'lifetime_points', lm.lifetime_points,
    'current_tier', lm.current_tier,
    'status', lm.status,
    'partner_name', p.name,
    'program_name', lp.name,
    'points_per_currency', lp.points_per_currency
  )
  INTO result
  FROM public.loyalty_members lm
  LEFT JOIN public.partners p ON p.id = lm.partner_id
  LEFT JOIN public.loyalty_programs lp ON lp.id = lm.program_id
  WHERE lm.tenant_id = p_tenant_id
    AND lm.status = 'active'
    AND (
      lm.card_number ILIKE '%' || p_query || '%'
      OR lm.phone ILIKE '%' || p_query || '%'
      OR lm.email ILIKE '%' || p_query || '%'
      OR (lm.first_name || ' ' || lm.last_name) ILIKE '%' || p_query || '%'
    )
  LIMIT 1;
  
  RETURN COALESCE(result, '{}'::JSONB);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- LOY-01: Accrue V2 with multiplier support
CREATE OR REPLACE FUNCTION public.accrue_loyalty_points_v2(
  p_tenant_id UUID,
  p_member_id UUID,
  p_amount NUMERIC,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_member RECORD;
  v_program RECORD;
  v_base_points INT;
  v_multiplier NUMERIC := 1.0;
  v_total_points INT;
  v_rule RECORD;
BEGIN
  -- Get member
  SELECT * INTO v_member FROM public.loyalty_members
    WHERE id = p_member_id AND tenant_id = p_tenant_id AND status = 'active';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Member not found');
  END IF;

  -- Get program
  SELECT * INTO v_program FROM public.loyalty_programs
    WHERE id = v_member.program_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No active program');
  END IF;

  -- Calculate base points (net amount * points_per_currency)
  v_base_points := FLOOR(p_amount * COALESCE(v_program.points_per_currency, 1));

  -- Apply multiplier rules
  FOR v_rule IN
    SELECT multiplier FROM public.loyalty_multiplier_rules
    WHERE tenant_id = p_tenant_id
      AND is_active = true
      AND (tier_filter IS NULL OR tier_filter = v_member.current_tier)
      AND (start_date IS NULL OR CURRENT_DATE >= start_date)
      AND (end_date IS NULL OR CURRENT_DATE <= end_date)
    ORDER BY multiplier DESC
    LIMIT 1
  LOOP
    v_multiplier := v_rule.multiplier;
  END LOOP;

  v_total_points := FLOOR(v_base_points * v_multiplier);
  IF v_total_points <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'points', 0);
  END IF;

  -- Insert transaction
  INSERT INTO public.loyalty_transactions(tenant_id, member_id, points, type, description, reference_type, reference_id)
  VALUES (p_tenant_id, p_member_id, v_total_points, 'earn',
    'Purchase accrual' || CASE WHEN v_multiplier > 1 THEN ' (' || v_multiplier || 'x)' ELSE '' END,
    p_reference_type, p_reference_id);

  -- Update member
  UPDATE public.loyalty_members SET
    points_balance = points_balance + v_total_points,
    lifetime_points = lifetime_points + v_total_points,
    updated_at = now()
  WHERE id = p_member_id;

  -- Auto tier upgrade
  PERFORM public.refresh_loyalty_tier(p_tenant_id, p_member_id);

  RETURN jsonb_build_object('ok', true, 'points', v_total_points, 'multiplier', v_multiplier, 'card_number', v_member.card_number);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Tier refresh helper
CREATE OR REPLACE FUNCTION public.refresh_loyalty_tier(
  p_tenant_id UUID,
  p_member_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_lifetime INT;
  v_new_tier TEXT;
BEGIN
  SELECT lifetime_points INTO v_lifetime FROM public.loyalty_members WHERE id = p_member_id;
  
  v_new_tier := CASE
    WHEN v_lifetime >= 50000 THEN 'platinum'
    WHEN v_lifetime >= 20000 THEN 'gold'
    WHEN v_lifetime >= 5000 THEN 'silver'
    ELSE 'bronze'
  END;
  
  UPDATE public.loyalty_members SET current_tier = v_new_tier, updated_at = now()
  WHERE id = p_member_id AND current_tier IS DISTINCT FROM v_new_tier;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================
-- LOY-02: Advanced Loyalty Features
-- =============================================

-- Multiplier rules
CREATE TABLE IF NOT EXISTS public.loyalty_multiplier_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  multiplier NUMERIC NOT NULL DEFAULT 2.0,
  tier_filter TEXT,
  category_filter UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.loyalty_multiplier_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for loyalty_multiplier_rules"
  ON public.loyalty_multiplier_rules FOR ALL
  USING (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid() AND tm.status = 'active'));

-- Tier benefits
CREATE TABLE IF NOT EXISTS public.loyalty_tier_benefits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tier TEXT NOT NULL,
  benefit_type TEXT NOT NULL, -- 'discount_pct', 'free_item', 'priority_support', 'bonus_points'
  benefit_value NUMERIC,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.loyalty_tier_benefits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for loyalty_tier_benefits"
  ON public.loyalty_tier_benefits FOR ALL
  USING (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid() AND tm.status = 'active'));

-- Campaigns
CREATE TABLE IF NOT EXISTS public.loyalty_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  campaign_type TEXT NOT NULL DEFAULT 'bonus_points', -- bonus_points, double_points, referral_bonus
  bonus_points INT DEFAULT 0,
  multiplier NUMERIC DEFAULT 1.0,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  target_tier TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.loyalty_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for loyalty_campaigns"
  ON public.loyalty_campaigns FOR ALL
  USING (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid() AND tm.status = 'active'));

-- Referral bonus trigger
CREATE OR REPLACE FUNCTION public.trg_loyalty_referral_bonus()
RETURNS TRIGGER AS $$
DECLARE
  v_bonus INT := 100;
BEGIN
  IF NEW.referred_by IS NOT NULL THEN
    -- Give bonus to referrer
    INSERT INTO public.loyalty_transactions(tenant_id, member_id, points, type, description)
    VALUES (NEW.tenant_id, NEW.referred_by, v_bonus, 'referral', 'Referral bonus for new member');
    
    UPDATE public.loyalty_members SET
      points_balance = points_balance + v_bonus,
      lifetime_points = lifetime_points + v_bonus,
      updated_at = now()
    WHERE id = NEW.referred_by;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_loyalty_referral
  AFTER INSERT ON public.loyalty_members
  FOR EACH ROW
  WHEN (NEW.referred_by IS NOT NULL)
  EXECUTE FUNCTION public.trg_loyalty_referral_bonus();

-- =============================================
-- LOY-03: Purchase profiles for AI recommendations
-- =============================================

CREATE TABLE IF NOT EXISTS public.loyalty_member_purchase_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.loyalty_members(id) ON DELETE CASCADE,
  total_transactions INT DEFAULT 0,
  total_spend NUMERIC DEFAULT 0,
  avg_basket_size NUMERIC DEFAULT 0,
  favorite_categories JSONB DEFAULT '[]'::JSONB,
  last_purchase_date TIMESTAMPTZ,
  purchase_frequency_days NUMERIC,
  clv_estimate NUMERIC DEFAULT 0,
  rfm_segment TEXT,
  rebuilt_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, member_id)
);

ALTER TABLE public.loyalty_member_purchase_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for loyalty_member_purchase_profiles"
  ON public.loyalty_member_purchase_profiles FOR ALL
  USING (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid() AND tm.status = 'active'));

-- =============================================
-- LOY-05: POS transaction loyalty columns
-- =============================================

ALTER TABLE public.pos_transactions
  ADD COLUMN IF NOT EXISTS loyalty_member_id UUID REFERENCES public.loyalty_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS loyalty_points_earned INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loyalty_multiplier NUMERIC DEFAULT 1.0;

CREATE INDEX IF NOT EXISTS idx_pos_tx_loyalty_member ON public.pos_transactions(loyalty_member_id) WHERE loyalty_member_id IS NOT NULL;
