-- Create table for tracking subscription payments (for revenue analytics)
CREATE TABLE public.subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  months INTEGER NOT NULL,
  amount NUMERIC NOT NULL,
  discount_percent NUMERIC DEFAULT 0,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  subscription_start DATE NOT NULL,
  subscription_end DATE NOT NULL,
  admin_id UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

-- Only admins can manage subscription payments
CREATE POLICY "Admins can manage subscription payments"
  ON public.subscription_payments FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));