-- Add bookkeeper company columns to profiles for payout info
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bookkeeper_company_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bookkeeper_pib TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bookkeeper_bank_account TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bookkeeper_address TEXT;

-- Create function to automatically create bookkeeper earnings when subscription payment is made
CREATE OR REPLACE FUNCTION public.create_bookkeeper_earning()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_bookkeeper_id UUID;
  v_commission_rate NUMERIC := 0.20; -- 20%
BEGIN
  -- Find if this user was referred by a bookkeeper
  SELECT invited_by_user_id INTO v_bookkeeper_id
  FROM profiles
  WHERE id = NEW.user_id
    AND invited_by_user_id IS NOT NULL;
  
  -- If there's a referrer bookkeeper, create earnings record
  IF v_bookkeeper_id IS NOT NULL THEN
    INSERT INTO bookkeeper_earnings (
      bookkeeper_id,
      client_id,
      payment_month,
      client_payment_amount,
      commission_rate,
      commission_amount,
      status
    ) VALUES (
      v_bookkeeper_id,
      NEW.user_id,
      DATE_TRUNC('month', NEW.payment_date)::DATE,
      NEW.amount,
      v_commission_rate,
      NEW.amount * v_commission_rate,
      'pending'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on subscription_payments
DROP TRIGGER IF EXISTS on_subscription_payment_create_earning ON public.subscription_payments;
CREATE TRIGGER on_subscription_payment_create_earning
  AFTER INSERT ON public.subscription_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.create_bookkeeper_earning();

-- Add paid_at column to bookkeeper_earnings if not exists
ALTER TABLE public.bookkeeper_earnings ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE public.bookkeeper_earnings ADD COLUMN IF NOT EXISTS paid_by UUID REFERENCES auth.users(id);