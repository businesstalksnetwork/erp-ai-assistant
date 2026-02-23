-- Add bookkeeper columns to companies table
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS bookkeeper_email TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS bookkeeper_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS bookkeeper_status TEXT DEFAULT NULL;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS bookkeeper_invited_at TIMESTAMPTZ;

-- Add constraint for bookkeeper_status values
ALTER TABLE public.companies ADD CONSTRAINT bookkeeper_status_check 
  CHECK (bookkeeper_status IS NULL OR bookkeeper_status IN ('pending', 'accepted', 'rejected'));

-- Create function to check if user is bookkeeper for a company (new version)
CREATE OR REPLACE FUNCTION public.is_company_bookkeeper(company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.companies c
    WHERE c.id = company_id
      AND c.bookkeeper_id = auth.uid()
      AND c.bookkeeper_status = 'accepted'
  )
$$;

-- Update is_bookkeeper_for function to also check companies table
CREATE OR REPLACE FUNCTION public.is_bookkeeper_for(client_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- Check old bookkeeper_clients table
    SELECT 1
    FROM public.bookkeeper_clients bc
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE bc.client_id = client_user_id
      AND bc.bookkeeper_email = p.email
      AND bc.status = 'accepted'
  ) OR EXISTS (
    -- Check new companies.bookkeeper_id
    SELECT 1
    FROM public.companies c
    WHERE c.user_id = client_user_id
      AND c.bookkeeper_id = auth.uid()
      AND c.bookkeeper_status = 'accepted'
  )
$$;

-- RLS policy: Bookkeepers can view companies where they are assigned
CREATE POLICY "Bookkeepers can view assigned companies"
ON public.companies
FOR SELECT
USING (
  bookkeeper_id = auth.uid() 
  AND bookkeeper_status = 'accepted'
  AND is_approved(auth.uid())
);

-- RLS policy: Bookkeepers can accept invitations (update their own bookkeeper_id)
CREATE POLICY "Bookkeepers can accept company invitations"
ON public.companies
FOR UPDATE
USING (
  bookkeeper_email = (SELECT email FROM profiles WHERE id = auth.uid())
  AND bookkeeper_status = 'pending'
  AND is_approved(auth.uid())
)
WITH CHECK (
  bookkeeper_email = (SELECT email FROM profiles WHERE id = auth.uid())
  AND is_approved(auth.uid())
);