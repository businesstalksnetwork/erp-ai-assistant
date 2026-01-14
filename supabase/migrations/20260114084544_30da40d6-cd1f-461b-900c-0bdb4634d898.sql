-- Create table for foreign payment instructions
CREATE TABLE public.foreign_payment_instructions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  currency TEXT NOT NULL,
  instructions TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(company_id, currency)
);

-- Enable RLS
ALTER TABLE public.foreign_payment_instructions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own company instructions"
  ON public.foreign_payment_instructions FOR SELECT
  USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own company instructions"
  ON public.foreign_payment_instructions FOR INSERT
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own company instructions"
  ON public.foreign_payment_instructions FOR UPDATE
  USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own company instructions"
  ON public.foreign_payment_instructions FOR DELETE
  USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));

-- Bookkeeper access policies
CREATE POLICY "Bookkeepers can view client company instructions"
  ON public.foreign_payment_instructions FOR SELECT
  USING (company_id IN (
    SELECT c.id FROM companies c
    JOIN bookkeeper_clients bc ON bc.client_id = c.user_id
    WHERE bc.bookkeeper_id = auth.uid() AND bc.status = 'accepted'
  ));

CREATE POLICY "Bookkeepers can insert client company instructions"
  ON public.foreign_payment_instructions FOR INSERT
  WITH CHECK (company_id IN (
    SELECT c.id FROM companies c
    JOIN bookkeeper_clients bc ON bc.client_id = c.user_id
    WHERE bc.bookkeeper_id = auth.uid() AND bc.status = 'accepted'
  ));

CREATE POLICY "Bookkeepers can update client company instructions"
  ON public.foreign_payment_instructions FOR UPDATE
  USING (company_id IN (
    SELECT c.id FROM companies c
    JOIN bookkeeper_clients bc ON bc.client_id = c.user_id
    WHERE bc.bookkeeper_id = auth.uid() AND bc.status = 'accepted'
  ));

CREATE POLICY "Bookkeepers can delete client company instructions"
  ON public.foreign_payment_instructions FOR DELETE
  USING (company_id IN (
    SELECT c.id FROM companies c
    JOIN bookkeeper_clients bc ON bc.client_id = c.user_id
    WHERE bc.bookkeeper_id = auth.uid() AND bc.status = 'accepted'
  ));

-- Trigger for updated_at
CREATE TRIGGER update_foreign_payment_instructions_updated_at
  BEFORE UPDATE ON public.foreign_payment_instructions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();