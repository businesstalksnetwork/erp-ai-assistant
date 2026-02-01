-- Add email_verified column to profiles for application-level verification
-- Since auto_confirm is enabled to avoid Lovable email-hook, we track verification ourselves

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT false;

-- Set existing users who already confirmed their email as verified
UPDATE public.profiles 
SET email_verified = true 
WHERE id IN (
  SELECT id FROM auth.users WHERE email_confirmed_at IS NOT NULL
);