-- Add new columns to profiles table for bookkeeper support
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'pausal' CHECK (account_type IN ('pausal', 'bookkeeper')),
ADD COLUMN IF NOT EXISTS agency_name TEXT,
ADD COLUMN IF NOT EXISTS agency_pib TEXT,
ADD COLUMN IF NOT EXISTS invited_by_user_id UUID REFERENCES public.profiles(id);

-- Create bookkeeper_referrals table for tracking referrals
CREATE TABLE IF NOT EXISTS public.bookkeeper_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bookkeeper_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id)
);

-- Create bookkeeper_earnings table for tracking commission earnings
CREATE TABLE IF NOT EXISTS public.bookkeeper_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bookkeeper_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  payment_month DATE NOT NULL,
  client_payment_amount NUMERIC NOT NULL DEFAULT 0,
  commission_rate NUMERIC NOT NULL DEFAULT 0.20,
  commission_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'invoiced', 'paid')),
  invoice_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.bookkeeper_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookkeeper_earnings ENABLE ROW LEVEL SECURITY;

-- RLS policies for bookkeeper_referrals
CREATE POLICY "Bookkeepers can view their referrals"
ON public.bookkeeper_referrals
FOR SELECT
USING (bookkeeper_id = auth.uid() AND is_approved(auth.uid()));

CREATE POLICY "Bookkeepers can create referrals"
ON public.bookkeeper_referrals
FOR INSERT
WITH CHECK (bookkeeper_id = auth.uid() AND is_approved(auth.uid()));

CREATE POLICY "Clients can view their referral info"
ON public.bookkeeper_referrals
FOR SELECT
USING (client_id = auth.uid());

CREATE POLICY "Admins can manage all referrals"
ON public.bookkeeper_referrals
FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- RLS policies for bookkeeper_earnings
CREATE POLICY "Bookkeepers can view their earnings"
ON public.bookkeeper_earnings
FOR SELECT
USING (bookkeeper_id = auth.uid() AND is_approved(auth.uid()));

CREATE POLICY "Admins can manage all earnings"
ON public.bookkeeper_earnings
FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Update handle_new_user trigger to support both account types
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invited_by UUID;
BEGIN
  -- Parse invited_by_user_id if provided
  v_invited_by := NULLIF(NEW.raw_user_meta_data->>'invited_by_user_id', '')::uuid;

  INSERT INTO public.profiles (
    id, 
    email, 
    full_name, 
    pib, 
    company_name, 
    account_type,
    agency_name,
    agency_pib,
    status, 
    subscription_end, 
    is_trial,
    invited_by_user_id
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'pib',
    NEW.raw_user_meta_data->>'company_name',
    COALESCE(NEW.raw_user_meta_data->>'account_type', 'pausal'),
    NEW.raw_user_meta_data->>'agency_name',
    NEW.raw_user_meta_data->>'agency_pib',
    'approved',
    CASE 
      WHEN COALESCE(NEW.raw_user_meta_data->>'account_type', 'pausal') = 'bookkeeper' 
        THEN NULL
      ELSE CURRENT_DATE + INTERVAL '7 days' 
    END,
    CASE 
      WHEN COALESCE(NEW.raw_user_meta_data->>'account_type', 'pausal') = 'bookkeeper' 
        THEN false
      ELSE true 
    END,
    v_invited_by
  );
  
  -- Create referral record if this user was invited by a bookkeeper
  IF v_invited_by IS NOT NULL THEN
    INSERT INTO public.bookkeeper_referrals (bookkeeper_id, client_id)
    VALUES (v_invited_by, NEW.id)
    ON CONFLICT (client_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for updating updated_at on bookkeeper_earnings
CREATE TRIGGER update_bookkeeper_earnings_updated_at
BEFORE UPDATE ON public.bookkeeper_earnings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();