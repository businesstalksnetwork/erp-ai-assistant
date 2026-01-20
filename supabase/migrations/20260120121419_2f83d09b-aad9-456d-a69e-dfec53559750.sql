-- Create sef_invoices table for permanent storage of SEF invoices
CREATE TABLE public.sef_invoices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sef_invoice_id text NOT NULL,
  invoice_type text NOT NULL CHECK (invoice_type IN ('purchase', 'sales')),
  invoice_number text NOT NULL,
  issue_date date NOT NULL,
  delivery_date date,
  due_date date,
  
  -- Counterparty data
  counterparty_name text NOT NULL,
  counterparty_pib text,
  counterparty_maticni_broj text,
  counterparty_address text,
  
  -- Financial data
  total_amount numeric NOT NULL DEFAULT 0,
  vat_amount numeric DEFAULT 0,
  currency text DEFAULT 'RSD',
  
  -- Status
  sef_status text NOT NULL,
  local_status text DEFAULT 'pending' CHECK (local_status IN ('pending', 'approved', 'rejected', 'imported')),
  
  -- UBL content for preview
  ubl_xml text,
  
  -- Link to local invoice
  linked_invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  
  -- Metadata
  fetched_at timestamptz DEFAULT now(),
  processed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(company_id, sef_invoice_id, invoice_type)
);

-- Enable RLS
ALTER TABLE public.sef_invoices ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own company SEF invoices"
ON public.sef_invoices
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM companies
    WHERE companies.id = sef_invoices.company_id
    AND companies.user_id = auth.uid()
  ) AND is_approved(auth.uid())
);

CREATE POLICY "Users can manage own company SEF invoices"
ON public.sef_invoices
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM companies
    WHERE companies.id = sef_invoices.company_id
    AND companies.user_id = auth.uid()
  ) AND is_approved(auth.uid())
);

CREATE POLICY "Bookkeepers can view client SEF invoices"
ON public.sef_invoices
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = sef_invoices.company_id
    AND is_bookkeeper_for(c.user_id)
  ) AND is_approved(auth.uid())
);

CREATE POLICY "Bookkeepers can manage client SEF invoices"
ON public.sef_invoices
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = sef_invoices.company_id
    AND is_bookkeeper_for(c.user_id)
  ) AND is_approved(auth.uid())
);

-- Require authentication
CREATE POLICY "Require authentication for sef_invoices"
ON public.sef_invoices
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Create update trigger
CREATE TRIGGER update_sef_invoices_updated_at
BEFORE UPDATE ON public.sef_invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_sef_invoices_company_id ON public.sef_invoices(company_id);
CREATE INDEX idx_sef_invoices_invoice_type ON public.sef_invoices(invoice_type);
CREATE INDEX idx_sef_invoices_issue_date ON public.sef_invoices(issue_date);
CREATE INDEX idx_sef_invoices_sef_status ON public.sef_invoices(sef_status);