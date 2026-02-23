-- Create SEF registry table to store companies registered in Serbian e-Invoice system
CREATE TABLE public.sef_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pib text UNIQUE NOT NULL,
  jbkjs text,
  registration_date date,
  deletion_date date,
  created_at timestamptz DEFAULT now()
);

-- Create index for fast PIB lookups
CREATE INDEX idx_sef_registry_pib ON public.sef_registry(pib);

-- Enable RLS
ALTER TABLE public.sef_registry ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read (this is public registry data)
CREATE POLICY "Authenticated users can read SEF registry"
ON public.sef_registry
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Only admins can insert/update/delete (for importing data)
CREATE POLICY "Admins can manage SEF registry"
ON public.sef_registry
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));