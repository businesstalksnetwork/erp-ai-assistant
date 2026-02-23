
-- =============================================================
-- Phase 2: Partial Payments, Advance Payments, Credit Notes
-- =============================================================

-- A2. Add amount_paid and balance_due to invoices
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS amount_paid numeric NOT NULL DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS balance_due numeric GENERATED ALWAYS AS (total - amount_paid) STORED;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS proforma_id uuid;

-- A2. Payment Allocations table
CREATE TABLE IF NOT EXISTS public.payment_allocations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id),
  amount numeric NOT NULL CHECK (amount > 0),
  payment_method text NOT NULL DEFAULT 'bank_transfer',
  journal_entry_id uuid REFERENCES public.journal_entries(id),
  reference text,
  notes text,
  allocated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view payment_allocations"
  ON public.payment_allocations FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant members can insert payment_allocations"
  ON public.payment_allocations FOR INSERT
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- A2. Allocate Payment RPC
CREATE OR REPLACE FUNCTION public.allocate_payment(
  p_tenant_id uuid,
  p_invoice_id uuid,
  p_amount numeric,
  p_payment_method text DEFAULT 'bank_transfer',
  p_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_invoice RECORD;
  v_je_id uuid;
  v_entry_number text;
  v_fp_id uuid;
  v_bank_account_id uuid;
  v_ar_account_id uuid;
  v_alloc_id uuid;
  v_new_paid numeric;
BEGIN
  PERFORM public.assert_tenant_member(p_tenant_id);

  SELECT * INTO v_invoice FROM invoices WHERE id = p_invoice_id AND tenant_id = p_tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;

  IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF p_amount > (v_invoice.total - v_invoice.amount_paid) THEN
    RAISE EXCEPTION 'Payment amount (%) exceeds remaining balance (%)', p_amount, (v_invoice.total - v_invoice.amount_paid);
  END IF;

  -- Resolve accounts
  SELECT id INTO v_bank_account_id FROM chart_of_accounts WHERE tenant_id = p_tenant_id AND code = '2410' AND is_active LIMIT 1;
  SELECT id INTO v_ar_account_id FROM chart_of_accounts WHERE tenant_id = p_tenant_id AND code = '2040' AND is_active LIMIT 1;
  IF v_bank_account_id IS NULL OR v_ar_account_id IS NULL THEN
    RAISE EXCEPTION 'Missing accounts 2410/2040';
  END IF;

  v_fp_id := check_fiscal_period_open(p_tenant_id, CURRENT_DATE::text);
  v_entry_number := 'PAY-' || upper(to_hex(extract(epoch from now())::bigint));

  -- Create JE
  INSERT INTO journal_entries (tenant_id, entry_number, entry_date, description, reference, status, posted_at, posted_by, created_by, fiscal_period_id, source, legal_entity_id)
  VALUES (p_tenant_id, v_entry_number, CURRENT_DATE, 'Payment: ' || v_invoice.invoice_number || ' (' || p_amount || ')', v_invoice.invoice_number, 'posted', now(), auth.uid(), auth.uid(), v_fp_id, 'auto_payment', v_invoice.legal_entity_id)
  RETURNING id INTO v_je_id;

  INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order) VALUES
    (v_je_id, v_bank_account_id, p_amount, 0, 'Bank receipt - ' || COALESCE(v_invoice.partner_name, ''), 0),
    (v_je_id, v_ar_account_id, 0, p_amount, 'Clear receivable - ' || COALESCE(v_invoice.partner_name, ''), 1);

  -- Update invoice amount_paid
  v_new_paid := v_invoice.amount_paid + p_amount;
  UPDATE invoices SET amount_paid = v_new_paid,
    status = CASE
      WHEN v_new_paid >= total THEN 'paid'
      WHEN v_new_paid > 0 THEN 'partial'
      ELSE status
    END
  WHERE id = p_invoice_id;

  -- Create allocation record
  INSERT INTO payment_allocations (tenant_id, invoice_id, amount, payment_method, journal_entry_id, reference, notes, created_by)
  VALUES (p_tenant_id, p_invoice_id, p_amount, p_payment_method, v_je_id, p_reference, p_notes, auth.uid())
  RETURNING id INTO v_alloc_id;

  RETURN v_alloc_id;
END;
$fn$;

-- A3. Enhance credit_notes
ALTER TABLE public.credit_notes ADD COLUMN IF NOT EXISTS tax_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.credit_notes ADD COLUMN IF NOT EXISTS subtotal numeric NOT NULL DEFAULT 0;
ALTER TABLE public.credit_notes ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES public.partners(id);
ALTER TABLE public.credit_notes ADD COLUMN IF NOT EXISTS legal_entity_id uuid REFERENCES public.legal_entities(id);
ALTER TABLE public.credit_notes ADD COLUMN IF NOT EXISTS journal_entry_id uuid REFERENCES public.journal_entries(id);
ALTER TABLE public.credit_notes ADD COLUMN IF NOT EXISTS sef_status text DEFAULT 'draft';

-- A3. Process Credit Note Post RPC
CREATE OR REPLACE FUNCTION public.process_credit_note_post(p_credit_note_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_cn RECORD;
  v_invoice RECORD;
  v_je_id uuid;
  v_entry_number text;
  v_fp_id uuid;
  v_revenue_id uuid;
  v_ar_id uuid;
  v_vat_id uuid;
BEGIN
  SELECT * INTO v_cn FROM credit_notes WHERE id = p_credit_note_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Credit note not found'; END IF;
  IF v_cn.status = 'posted' THEN RAISE EXCEPTION 'Already posted'; END IF;

  PERFORM public.assert_tenant_member(v_cn.tenant_id);

  SELECT * INTO v_invoice FROM invoices WHERE id = v_cn.invoice_id;

  SELECT id INTO v_revenue_id FROM chart_of_accounts WHERE tenant_id = v_cn.tenant_id AND code = '6000' AND is_active LIMIT 1;
  SELECT id INTO v_ar_id FROM chart_of_accounts WHERE tenant_id = v_cn.tenant_id AND code = '2040' AND is_active LIMIT 1;
  SELECT id INTO v_vat_id FROM chart_of_accounts WHERE tenant_id = v_cn.tenant_id AND code = '4700' AND is_active LIMIT 1;

  IF v_revenue_id IS NULL OR v_ar_id IS NULL THEN RAISE EXCEPTION 'Missing accounts 6000/2040'; END IF;

  v_fp_id := check_fiscal_period_open(v_cn.tenant_id, CURRENT_DATE::text);
  v_entry_number := 'CN-' || upper(to_hex(extract(epoch from now())::bigint));

  INSERT INTO journal_entries (tenant_id, entry_number, entry_date, description, reference, status, posted_at, posted_by, created_by, fiscal_period_id, source, legal_entity_id)
  VALUES (v_cn.tenant_id, v_entry_number, CURRENT_DATE, 'Credit note: ' || v_cn.credit_number, v_cn.credit_number, 'posted', now(), auth.uid(), auth.uid(), v_fp_id, 'auto_credit_note', v_cn.legal_entity_id)
  RETURNING id INTO v_je_id;

  -- Reverse: D: Revenue, D: VAT, C: AR
  INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order) VALUES
    (v_je_id, v_revenue_id, v_cn.subtotal, 0, 'Revenue reversal - CN ' || v_cn.credit_number, 0),
    (v_je_id, v_ar_id, 0, v_cn.amount, 'AR reversal - CN ' || v_cn.credit_number, 2);

  IF v_vat_id IS NOT NULL AND v_cn.tax_amount > 0 THEN
    INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
    VALUES (v_je_id, v_vat_id, v_cn.tax_amount, 0, 'VAT reversal - CN ' || v_cn.credit_number, 1);
  END IF;

  -- Update credit note
  UPDATE credit_notes SET status = 'posted', journal_entry_id = v_je_id WHERE id = p_credit_note_id;

  -- Update invoice balance
  IF v_cn.invoice_id IS NOT NULL THEN
    UPDATE invoices SET amount_paid = amount_paid + v_cn.amount WHERE id = v_cn.invoice_id;
  END IF;

  RETURN v_je_id;
END;
$fn$;

-- A4. Advance Payments table
CREATE TABLE IF NOT EXISTS public.advance_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  partner_id uuid REFERENCES public.partners(id),
  amount numeric NOT NULL CHECK (amount > 0),
  tax_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'RSD',
  invoice_id uuid REFERENCES public.invoices(id),
  journal_entry_id uuid REFERENCES public.journal_entries(id),
  settlement_journal_entry_id uuid REFERENCES public.journal_entries(id),
  legal_entity_id uuid REFERENCES public.legal_entities(id),
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'settled', 'refunded')),
  reference text,
  notes text,
  received_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.advance_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view advance_payments"
  ON public.advance_payments FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant members can manage advance_payments"
  ON public.advance_payments FOR ALL
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- A4. Process Advance Payment RPC
CREATE OR REPLACE FUNCTION public.process_advance_payment(
  p_tenant_id uuid,
  p_partner_id uuid,
  p_amount numeric,
  p_legal_entity_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_je_id uuid;
  v_entry_number text;
  v_fp_id uuid;
  v_bank_id uuid;
  v_advance_id uuid;
  v_adv_acct_id uuid;
  v_vat_acct_id uuid;
  v_tax_amount numeric;
  v_partner_name text;
BEGIN
  PERFORM public.assert_tenant_member(p_tenant_id);

  SELECT name INTO v_partner_name FROM partners WHERE id = p_partner_id AND tenant_id = p_tenant_id;

  SELECT id INTO v_bank_id FROM chart_of_accounts WHERE tenant_id = p_tenant_id AND code = '2410' AND is_active LIMIT 1;
  SELECT id INTO v_adv_acct_id FROM chart_of_accounts WHERE tenant_id = p_tenant_id AND code = '4300' AND is_active LIMIT 1;
  SELECT id INTO v_vat_acct_id FROM chart_of_accounts WHERE tenant_id = p_tenant_id AND code = '4700' AND is_active LIMIT 1;

  IF v_bank_id IS NULL OR v_adv_acct_id IS NULL THEN RAISE EXCEPTION 'Missing accounts 2410/4300'; END IF;

  -- PDV on advance: 20% is standard
  v_tax_amount := ROUND(p_amount * 20.0 / 120.0, 2);

  v_fp_id := check_fiscal_period_open(p_tenant_id, CURRENT_DATE::text);
  v_entry_number := 'ADV-' || upper(to_hex(extract(epoch from now())::bigint));

  INSERT INTO journal_entries (tenant_id, entry_number, entry_date, description, reference, status, posted_at, posted_by, created_by, fiscal_period_id, source, legal_entity_id)
  VALUES (p_tenant_id, v_entry_number, CURRENT_DATE, 'Advance payment received: ' || COALESCE(v_partner_name, ''), NULL, 'posted', now(), auth.uid(), auth.uid(), v_fp_id, 'auto_advance', p_legal_entity_id)
  RETURNING id INTO v_je_id;

  -- D: Bank, C: Advance liability, C: VAT on advance
  INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order) VALUES
    (v_je_id, v_bank_id, p_amount, 0, 'Bank receipt - advance ' || COALESCE(v_partner_name, ''), 0),
    (v_je_id, v_adv_acct_id, 0, p_amount - v_tax_amount, 'Advance received - ' || COALESCE(v_partner_name, ''), 1);

  IF v_vat_acct_id IS NOT NULL THEN
    INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
    VALUES (v_je_id, v_vat_acct_id, 0, v_tax_amount, 'VAT on advance', 2);
  END IF;

  INSERT INTO advance_payments (tenant_id, partner_id, amount, tax_amount, journal_entry_id, legal_entity_id, created_by)
  VALUES (p_tenant_id, p_partner_id, p_amount, v_tax_amount, v_je_id, p_legal_entity_id, auth.uid())
  RETURNING id INTO v_advance_id;

  RETURN v_advance_id;
END;
$fn$;

-- Create updated_at trigger for advance_payments
CREATE TRIGGER update_advance_payments_updated_at
  BEFORE UPDATE ON public.advance_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
