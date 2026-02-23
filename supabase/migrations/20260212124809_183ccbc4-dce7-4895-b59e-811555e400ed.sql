
-- ============================================================
-- Phase 21: PDV Periods, POPDV Reports, Advance Invoices
-- ============================================================

-- 1. PDV PERIODS
CREATE TABLE public.pdv_periods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  period_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', -- open, calculated, submitted, closed
  output_vat NUMERIC NOT NULL DEFAULT 0,
  input_vat NUMERIC NOT NULL DEFAULT 0,
  vat_liability NUMERIC NOT NULL DEFAULT 0,
  submitted_at TIMESTAMPTZ,
  submitted_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pdv_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.pdv_periods FOR ALL
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE INDEX idx_pdv_periods_tenant ON public.pdv_periods(tenant_id);
CREATE INDEX idx_pdv_periods_dates ON public.pdv_periods(start_date, end_date);

-- 2. PDV ENTRIES (individual VAT line items tied to a period)
CREATE TABLE public.pdv_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  pdv_period_id UUID NOT NULL REFERENCES public.pdv_periods(id) ON DELETE CASCADE,
  popdv_section TEXT NOT NULL, -- '3', '3a', '4', '5', '6', '8a', '8b', '8v', '9', '10', '11'
  document_type TEXT NOT NULL, -- 'invoice', 'supplier_invoice', 'advance', 'credit_note'
  document_id UUID,
  document_number TEXT NOT NULL,
  document_date DATE NOT NULL,
  partner_name TEXT,
  partner_pib TEXT,
  base_amount NUMERIC NOT NULL DEFAULT 0,
  vat_amount NUMERIC NOT NULL DEFAULT 0,
  vat_rate NUMERIC NOT NULL DEFAULT 20,
  direction TEXT NOT NULL DEFAULT 'output', -- 'output' or 'input'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pdv_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.pdv_entries FOR ALL
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE INDEX idx_pdv_entries_period ON public.pdv_entries(pdv_period_id);
CREATE INDEX idx_pdv_entries_section ON public.pdv_entries(popdv_section);

-- 3. ADVANCE INVOICE TRACKING
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS invoice_type TEXT NOT NULL DEFAULT 'regular', -- 'regular', 'advance', 'advance_final'
  ADD COLUMN IF NOT EXISTS advance_invoice_id UUID REFERENCES public.invoices(id), -- final invoice links to advance
  ADD COLUMN IF NOT EXISTS advance_amount_applied NUMERIC NOT NULL DEFAULT 0;

CREATE INDEX idx_invoices_type ON public.invoices(invoice_type) WHERE invoice_type != 'regular';
CREATE INDEX idx_invoices_advance ON public.invoices(advance_invoice_id) WHERE advance_invoice_id IS NOT NULL;

-- Trigger for updated_at
CREATE TRIGGER update_pdv_periods_updated_at
  BEFORE UPDATE ON public.pdv_periods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
