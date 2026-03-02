
-- Phase 3 R1: Promotions Engine + R3: Gift Card Management

CREATE TABLE public.promotions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  description TEXT,
  promotion_type TEXT NOT NULL DEFAULT 'percentage' CHECK (promotion_type IN ('percentage', 'fixed_amount', 'bogo', 'bundle', 'coupon')),
  discount_value NUMERIC NOT NULL DEFAULT 0,
  buy_quantity INTEGER DEFAULT 1,
  get_quantity INTEGER DEFAULT 0,
  applies_to TEXT NOT NULL DEFAULT 'all' CHECK (applies_to IN ('all', 'category', 'product', 'bundle')),
  product_ids UUID[] DEFAULT '{}',
  category_ids UUID[] DEFAULT '{}',
  bundle_product_ids UUID[] DEFAULT '{}',
  bundle_price NUMERIC,
  coupon_code TEXT,
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_date TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  min_cart_value NUMERIC DEFAULT 0,
  priority INTEGER DEFAULT 0,
  required_tier TEXT,
  location_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view promotions" ON public.promotions
  FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE POLICY "Admins can manage promotions" ON public.promotions
  FOR ALL USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active' AND role IN ('admin', 'super_admin', 'manager', 'store_manager')
  ));

CREATE INDEX idx_promotions_tenant_active ON public.promotions(tenant_id, is_active) WHERE is_active = true;
CREATE INDEX idx_promotions_coupon ON public.promotions(tenant_id, coupon_code) WHERE coupon_code IS NOT NULL;

CREATE TABLE public.gift_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  card_number TEXT NOT NULL,
  initial_balance NUMERIC NOT NULL DEFAULT 0,
  current_balance NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'RSD',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired', 'cancelled')),
  issued_to_name TEXT,
  issued_to_partner_id UUID REFERENCES public.partners(id),
  purchased_by_partner_id UUID REFERENCES public.partners(id),
  expires_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  pos_transaction_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, card_number)
);

ALTER TABLE public.gift_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view gift cards" ON public.gift_cards
  FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE POLICY "Staff can manage gift cards" ON public.gift_cards
  FOR ALL USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active' AND role IN ('admin', 'super_admin', 'manager', 'store_manager', 'cashier')
  ));

CREATE INDEX idx_gift_cards_tenant ON public.gift_cards(tenant_id, status);
CREATE INDEX idx_gift_cards_number ON public.gift_cards(tenant_id, card_number);

CREATE TABLE public.gift_card_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  gift_card_id UUID NOT NULL REFERENCES public.gift_cards(id),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('load', 'redeem', 'refund', 'adjustment')),
  amount NUMERIC NOT NULL,
  balance_after NUMERIC NOT NULL,
  pos_transaction_id UUID,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gift_card_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view gift card txs" ON public.gift_card_transactions
  FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE POLICY "Staff can insert gift card txs" ON public.gift_card_transactions
  FOR INSERT WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'
  ));

CREATE TRIGGER update_promotions_updated_at BEFORE UPDATE ON public.promotions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_gift_cards_updated_at BEFORE UPDATE ON public.gift_cards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
