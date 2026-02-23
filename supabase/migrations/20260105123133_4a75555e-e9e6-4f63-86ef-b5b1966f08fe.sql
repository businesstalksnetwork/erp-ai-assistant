-- Create service_catalog table
CREATE TABLE public.service_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  item_type invoice_item_type NOT NULL DEFAULT 'services',
  default_unit_price numeric,
  default_foreign_price numeric,
  unit text DEFAULT 'kom',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.service_catalog ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Require authentication for service_catalog"
  ON public.service_catalog FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can manage own service catalog"
  ON public.service_catalog FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id = service_catalog.company_id
      AND companies.user_id = auth.uid()
    ) AND is_approved(auth.uid())
  );

CREATE POLICY "Bookkeepers can view client service catalog"
  ON public.service_catalog FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = service_catalog.company_id
      AND is_bookkeeper_for(c.user_id)
    ) AND is_approved(auth.uid())
  );

-- Trigger for updated_at
CREATE TRIGGER update_service_catalog_updated_at
  BEFORE UPDATE ON public.service_catalog
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();