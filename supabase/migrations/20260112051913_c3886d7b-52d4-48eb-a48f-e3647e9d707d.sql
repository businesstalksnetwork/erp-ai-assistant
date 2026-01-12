-- Create invoice_templates table
CREATE TABLE public.invoice_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  invoice_type TEXT NOT NULL, -- 'regular', 'proforma', 'advance'
  
  -- Client data
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  client_address TEXT,
  client_pib TEXT,
  client_maticni_broj TEXT,
  client_type TEXT NOT NULL DEFAULT 'domestic',
  
  -- Foreign currency
  foreign_currency TEXT,
  
  -- Items (JSON array)
  items JSONB NOT NULL DEFAULT '[]',
  
  -- Other data
  payment_method TEXT,
  note TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invoice_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own company templates"
  ON invoice_templates FOR SELECT
  USING (company_id IN (
    SELECT id FROM companies WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can create templates for own companies"
  ON invoice_templates FOR INSERT
  WITH CHECK (company_id IN (
    SELECT id FROM companies WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update own company templates"
  ON invoice_templates FOR UPDATE
  USING (company_id IN (
    SELECT id FROM companies WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own company templates"
  ON invoice_templates FOR DELETE
  USING (company_id IN (
    SELECT id FROM companies WHERE user_id = auth.uid()
  ));

-- Update trigger
CREATE TRIGGER update_invoice_templates_updated_at
  BEFORE UPDATE ON invoice_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();