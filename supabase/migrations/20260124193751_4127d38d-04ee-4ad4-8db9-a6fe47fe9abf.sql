-- Create partners table
CREATE TABLE public.partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  discount_percent NUMERIC DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  free_trial_days INTEGER DEFAULT 14 CHECK (free_trial_days >= 0),
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

-- Admins can manage partners
CREATE POLICY "Admins can manage partners"
  ON public.partners FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Anyone can view active partners (needed for registration)
CREATE POLICY "Anyone can view active partners"
  ON public.partners FOR SELECT
  USING (is_active = true);

-- Add partner columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES public.partners(id),
  ADD COLUMN IF NOT EXISTS partner_discount_percent NUMERIC DEFAULT 0;

-- Update handle_new_user function to support partner codes
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_invited_by UUID;
  v_partner_code TEXT;
  v_partner RECORD;
  v_trial_days INTEGER := 14;
  v_discount NUMERIC := 0;
  v_partner_id UUID := NULL;
BEGIN
  -- Parse invited_by_user_id if provided
  v_invited_by := NULLIF(NEW.raw_user_meta_data->>'invited_by_user_id', '')::uuid;
  v_partner_code := NEW.raw_user_meta_data->>'partner_code';
  
  -- Find partner if code provided
  IF v_partner_code IS NOT NULL AND v_partner_code != '' THEN
    SELECT id, free_trial_days, discount_percent INTO v_partner_id, v_trial_days, v_discount
    FROM public.partners 
    WHERE code = v_partner_code AND is_active = true;
  END IF;

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
    invited_by_user_id,
    partner_id,
    partner_discount_percent
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
      ELSE CURRENT_DATE + (v_trial_days || ' days')::INTERVAL
    END,
    CASE 
      WHEN COALESCE(NEW.raw_user_meta_data->>'account_type', 'pausal') = 'bookkeeper' 
        THEN false
      ELSE true 
    END,
    v_invited_by,
    v_partner_id,
    v_discount
  );
  
  -- Create referral record if this user was invited by a bookkeeper
  IF v_invited_by IS NOT NULL THEN
    INSERT INTO public.bookkeeper_referrals (bookkeeper_id, client_id)
    VALUES (v_invited_by, NEW.id)
    ON CONFLICT (client_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for updated_at
CREATE TRIGGER update_partners_updated_at
  BEFORE UPDATE ON public.partners
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();