-- Create invoice_items table for multiple line items per invoice
CREATE TABLE public.invoice_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  item_type invoice_item_type NOT NULL DEFAULT 'services',
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL,
  total_amount NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

-- Users can manage items for their own invoices
CREATE POLICY "Users can manage own invoice items"
ON public.invoice_items
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM invoices i
    JOIN companies c ON c.id = i.company_id
    WHERE i.id = invoice_items.invoice_id
    AND c.user_id = auth.uid()
  ) AND is_approved(auth.uid())
);

-- Bookkeepers can manage client invoice items
CREATE POLICY "Bookkeepers can manage client invoice items"
ON public.invoice_items
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM invoices i
    JOIN companies c ON c.id = i.company_id
    WHERE i.id = invoice_items.invoice_id
    AND is_bookkeeper_for(c.user_id)
  ) AND is_approved(auth.uid())
);

-- Create index for faster queries
CREATE INDEX idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);