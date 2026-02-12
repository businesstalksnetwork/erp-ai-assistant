
-- ============================================================
-- Phase 20: Bank Statements, Open Items, Storno Journals
-- ============================================================

-- 1. BANK STATEMENTS
CREATE TABLE public.bank_statements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id),
  statement_date DATE NOT NULL,
  statement_number TEXT,
  opening_balance NUMERIC NOT NULL DEFAULT 0,
  closing_balance NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'RSD',
  status TEXT NOT NULL DEFAULT 'imported',
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  imported_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_statements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.bank_statements FOR ALL
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- 2. BANK STATEMENT LINES
CREATE TABLE public.bank_statement_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  statement_id UUID NOT NULL REFERENCES public.bank_statements(id) ON DELETE CASCADE,
  line_date DATE NOT NULL,
  description TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  direction TEXT NOT NULL DEFAULT 'credit',
  partner_name TEXT,
  partner_account TEXT,
  payment_reference TEXT,
  payment_purpose TEXT,
  match_status TEXT NOT NULL DEFAULT 'unmatched',
  matched_invoice_id UUID REFERENCES public.invoices(id),
  matched_supplier_invoice_id UUID REFERENCES public.supplier_invoices(id),
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_statement_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.bank_statement_lines FOR ALL
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE INDEX idx_bsl_statement ON public.bank_statement_lines(statement_id);
CREATE INDEX idx_bsl_payment_ref ON public.bank_statement_lines(payment_reference);
CREATE INDEX idx_bsl_match_status ON public.bank_statement_lines(match_status);

-- 3. OPEN ITEMS LEDGER
CREATE TABLE public.open_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  partner_id UUID REFERENCES public.partners(id),
  document_type TEXT NOT NULL,
  document_id UUID,
  document_number TEXT NOT NULL,
  document_date DATE NOT NULL,
  due_date DATE,
  currency TEXT NOT NULL DEFAULT 'RSD',
  original_amount NUMERIC NOT NULL DEFAULT 0,
  paid_amount NUMERIC NOT NULL DEFAULT 0,
  remaining_amount NUMERIC NOT NULL DEFAULT 0,
  direction TEXT NOT NULL DEFAULT 'receivable',
  status TEXT NOT NULL DEFAULT 'open',
  closed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.open_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.open_items FOR ALL
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE INDEX idx_open_items_partner ON public.open_items(partner_id);
CREATE INDEX idx_open_items_status ON public.open_items(status);
CREATE INDEX idx_open_items_direction ON public.open_items(direction);
CREATE INDEX idx_open_items_document ON public.open_items(document_type, document_id);

-- 4. OPEN ITEM PAYMENTS
CREATE TABLE public.open_item_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  open_item_id UUID NOT NULL REFERENCES public.open_items(id),
  amount NUMERIC NOT NULL DEFAULT 0,
  payment_date DATE NOT NULL,
  payment_type TEXT NOT NULL DEFAULT 'bank',
  reference TEXT,
  bank_statement_line_id UUID REFERENCES public.bank_statement_lines(id),
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.open_item_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.open_item_payments FOR ALL
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- 5. STORNO COLUMNS ON JOURNAL ENTRIES
ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS storno_of_id UUID REFERENCES public.journal_entries(id),
  ADD COLUMN IF NOT EXISTS storno_by_id UUID REFERENCES public.journal_entries(id),
  ADD COLUMN IF NOT EXISTS is_storno BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_je_storno_of ON public.journal_entries(storno_of_id) WHERE storno_of_id IS NOT NULL;

-- Triggers for updated_at
CREATE TRIGGER update_bank_statements_updated_at
  BEFORE UPDATE ON public.bank_statements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_open_items_updated_at
  BEFORE UPDATE ON public.open_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
