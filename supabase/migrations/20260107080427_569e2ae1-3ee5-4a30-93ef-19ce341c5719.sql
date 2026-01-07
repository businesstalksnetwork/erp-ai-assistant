-- Add subscription management columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS pib text,
ADD COLUMN IF NOT EXISTS company_name text,
ADD COLUMN IF NOT EXISTS subscription_end date,
ADD COLUMN IF NOT EXISTS block_reason text,
ADD COLUMN IF NOT EXISTS is_trial boolean DEFAULT true;

-- Update the handle_new_user function to set subscription_end to +7 days for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, pib, company_name, status, subscription_end, is_trial)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'pib',
    NEW.raw_user_meta_data->>'company_name',
    'approved',
    CURRENT_DATE + INTERVAL '7 days',
    true
  );
  RETURN NEW;
END;
$$;