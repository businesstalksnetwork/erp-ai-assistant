
-- Add role_type and default_location_id to salespeople
ALTER TABLE public.salespeople
  ADD COLUMN role_type text NOT NULL DEFAULT 'in_store',
  ADD COLUMN default_location_id uuid REFERENCES public.locations(id);

-- Add index for filtering by role_type
CREATE INDEX idx_salespeople_role_type ON public.salespeople(role_type);
