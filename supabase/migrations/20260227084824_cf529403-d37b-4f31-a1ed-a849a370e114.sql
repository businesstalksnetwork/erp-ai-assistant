
-- Create debit_notes table (mirror of credit_notes for charge increases)
CREATE TABLE public.debit_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  debit_number TEXT NOT NULL,
  invoice_id UUID REFERENCES public.invoices(id),
  partner_id UUID REFERENCES public.partners(id),
  legal_entity_id UUID REFERENCES public.legal_entities(id),
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'RSD',
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  issued_at TIMESTAMPTZ,
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.debit_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for debit_notes" ON public.debit_notes
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE INDEX idx_debit_notes_tenant ON public.debit_notes(tenant_id);
CREATE INDEX idx_debit_notes_invoice ON public.debit_notes(invoice_id);

-- Add tenant_id to proforma_invoice_lines if not present (for RLS)
-- proforma_invoice_lines lacks tenant_id, add it
ALTER TABLE public.proforma_invoice_lines ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- Create RLS on proforma_invoice_lines if not already
ALTER TABLE public.proforma_invoice_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for proforma_invoice_lines" ON public.proforma_invoice_lines
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active')
    OR proforma_id IN (SELECT id FROM public.proforma_invoices WHERE tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND status = 'active'))
  );
