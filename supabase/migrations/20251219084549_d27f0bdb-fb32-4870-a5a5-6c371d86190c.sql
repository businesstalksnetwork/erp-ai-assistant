-- Create bookkeeper relationship status enum
CREATE TYPE public.bookkeeper_status AS ENUM ('pending', 'accepted', 'rejected');

-- Create bookkeeper_clients table for managing relationships
CREATE TABLE public.bookkeeper_clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bookkeeper_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  bookkeeper_email TEXT NOT NULL,
  status bookkeeper_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_id, bookkeeper_email)
);

-- Enable RLS
ALTER TABLE public.bookkeeper_clients ENABLE ROW LEVEL SECURITY;

-- Clients can create invitations
CREATE POLICY "Clients can create invitations"
ON public.bookkeeper_clients
FOR INSERT
WITH CHECK (client_id = auth.uid() AND is_approved(auth.uid()));

-- Clients can view their own invitations
CREATE POLICY "Clients can view own invitations"
ON public.bookkeeper_clients
FOR SELECT
USING (client_id = auth.uid() AND is_approved(auth.uid()));

-- Clients can delete/cancel their own invitations
CREATE POLICY "Clients can delete own invitations"
ON public.bookkeeper_clients
FOR DELETE
USING (client_id = auth.uid() AND is_approved(auth.uid()));

-- Bookkeepers can view invitations sent to them (by email)
CREATE POLICY "Bookkeepers can view invitations to them"
ON public.bookkeeper_clients
FOR SELECT
USING (
  bookkeeper_email = (SELECT email FROM profiles WHERE id = auth.uid())
  AND is_approved(auth.uid())
);

-- Bookkeepers can update invitations sent to them (to accept/reject)
CREATE POLICY "Bookkeepers can accept invitations"
ON public.bookkeeper_clients
FOR UPDATE
USING (
  bookkeeper_email = (SELECT email FROM profiles WHERE id = auth.uid())
  AND is_approved(auth.uid())
)
WITH CHECK (
  bookkeeper_email = (SELECT email FROM profiles WHERE id = auth.uid())
  AND is_approved(auth.uid())
);

-- Function to check if user is bookkeeper for a company owner
CREATE OR REPLACE FUNCTION public.is_bookkeeper_for(client_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.bookkeeper_clients bc
    JOIN public.profiles p ON p.email = bc.bookkeeper_email
    WHERE bc.client_id = client_user_id
      AND p.id = auth.uid()
      AND bc.status = 'accepted'
  )
$$;

-- Update companies RLS to allow bookkeepers to view client companies
CREATE POLICY "Bookkeepers can view client companies"
ON public.companies
FOR SELECT
USING (is_bookkeeper_for(user_id) AND is_approved(auth.uid()));

-- Update invoices RLS to allow bookkeepers to view client invoices
CREATE POLICY "Bookkeepers can view client invoices"
ON public.invoices
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM companies c 
    WHERE c.id = invoices.company_id 
    AND is_bookkeeper_for(c.user_id)
  )
  AND is_approved(auth.uid())
);

-- Update clients RLS to allow bookkeepers to view/manage client's customers
CREATE POLICY "Bookkeepers can manage client customers"
ON public.clients
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM companies c 
    WHERE c.id = clients.company_id 
    AND is_bookkeeper_for(c.user_id)
  )
  AND is_approved(auth.uid())
);

-- Update kpo_entries RLS for bookkeepers
CREATE POLICY "Bookkeepers can view client KPO"
ON public.kpo_entries
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM companies c 
    WHERE c.id = kpo_entries.company_id 
    AND is_bookkeeper_for(c.user_id)
  )
  AND is_approved(auth.uid())
);

-- Update payment_reminders RLS for bookkeepers
CREATE POLICY "Bookkeepers can manage client reminders"
ON public.payment_reminders
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM companies c 
    WHERE c.id = payment_reminders.company_id 
    AND is_bookkeeper_for(c.user_id)
  )
  AND is_approved(auth.uid())
);

-- Trigger to update updated_at
CREATE TRIGGER update_bookkeeper_clients_updated_at
BEFORE UPDATE ON public.bookkeeper_clients
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to set bookkeeper_id when accepted
CREATE OR REPLACE FUNCTION public.set_bookkeeper_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    NEW.bookkeeper_id := (SELECT id FROM profiles WHERE email = NEW.bookkeeper_email LIMIT 1);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_bookkeeper_id_on_accept
BEFORE UPDATE ON public.bookkeeper_clients
FOR EACH ROW
EXECUTE FUNCTION public.set_bookkeeper_id();