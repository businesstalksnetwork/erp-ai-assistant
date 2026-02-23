
-- Item 8: Advance Payment Settlement RPC
-- Settles an advance payment against a final invoice with proper JE reversal
CREATE OR REPLACE FUNCTION public.settle_advance_payment(
  p_tenant_id uuid,
  p_advance_id uuid,
  p_invoice_id uuid,
  p_tax_rate numeric DEFAULT 20,
  p_settlement_amount numeric DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_advance RECORD;
  v_invoice RECORD;
  v_settle_amt numeric;
  v_tax_amt numeric;
  v_net_amt numeric;
  v_je_id uuid;
  v_entry_number text;
  v_fp_id uuid;
  v_adv_recv_acct uuid;  -- 2300 Advance received
  v_ar_acct uuid;         -- 2040 Accounts receivable
  v_vat_adv_acct uuid;    -- 4701 VAT on advances
  v_vat_out_acct uuid;    -- 4700 Output VAT
BEGIN
  PERFORM public.assert_tenant_member(p_tenant_id);

  -- Load advance payment
  SELECT * INTO v_advance FROM advance_payments WHERE id = p_advance_id AND tenant_id = p_tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Advance payment not found'; END IF;
  IF v_advance.status = 'settled' THEN RAISE EXCEPTION 'Advance already fully settled'; END IF;

  -- Load invoice
  SELECT * INTO v_invoice FROM invoices WHERE id = p_invoice_id AND tenant_id = p_tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;

  -- Determine settlement amount (partial or full)
  v_settle_amt := COALESCE(p_settlement_amount, v_advance.amount);
  IF v_settle_amt > v_advance.amount THEN
    RAISE EXCEPTION 'Settlement amount (%) exceeds advance amount (%)', v_settle_amt, v_advance.amount;
  END IF;
  IF v_settle_amt > v_invoice.total THEN
    RAISE EXCEPTION 'Settlement amount (%) exceeds invoice total (%)', v_settle_amt, v_invoice.total;
  END IF;

  -- Calculate tax components using the provided rate (not hardcoded 20%)
  v_tax_amt := ROUND(v_settle_amt * p_tax_rate / (100 + p_tax_rate), 2);
  v_net_amt := v_settle_amt - v_tax_amt;

  -- Resolve accounts
  SELECT id INTO v_adv_recv_acct FROM chart_of_accounts WHERE tenant_id = p_tenant_id AND code = '2300' AND is_active LIMIT 1;
  SELECT id INTO v_ar_acct FROM chart_of_accounts WHERE tenant_id = p_tenant_id AND code = '2040' AND is_active LIMIT 1;
  SELECT id INTO v_vat_adv_acct FROM chart_of_accounts WHERE tenant_id = p_tenant_id AND code = '4701' AND is_active LIMIT 1;
  SELECT id INTO v_vat_out_acct FROM chart_of_accounts WHERE tenant_id = p_tenant_id AND code = '4700' AND is_active LIMIT 1;

  IF v_adv_recv_acct IS NULL OR v_ar_acct IS NULL THEN
    RAISE EXCEPTION 'Required accounts (2300, 2040) not found in chart of accounts';
  END IF;

  -- Check fiscal period
  v_fp_id := check_fiscal_period_open(p_tenant_id, CURRENT_DATE::text);

  -- Generate entry number
  v_entry_number := 'ADV-SETTLE-' || upper(to_hex(extract(epoch from now())::bigint));

  -- Create settlement journal entry:
  -- D: 2300 Advance received (clear the advance liability)
  -- C: 2040 Accounts receivable (offset against invoice)
  -- D: 4701 VAT on advances (reverse the advance VAT)
  -- C: 4700 Output VAT (transfer to regular output VAT on final invoice)
  INSERT INTO journal_entries (tenant_id, entry_number, entry_date, description, reference, status, posted_at, posted_by, created_by, fiscal_period_id, source, legal_entity_id)
  VALUES (p_tenant_id, v_entry_number, CURRENT_DATE, 
    'Advance settlement: ' || COALESCE(v_advance.reference, v_advance.id::text) || ' → ' || v_invoice.invoice_number,
    v_invoice.invoice_number, 'posted', now(), auth.uid(), auth.uid(), v_fp_id, 'advance_settlement', v_invoice.legal_entity_id)
  RETURNING id INTO v_je_id;

  -- Line 1: D: Clear advance liability
  INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
  VALUES (v_je_id, v_adv_recv_acct, v_settle_amt, 0, 'Clear advance: ' || COALESCE(v_advance.reference, ''), 0);

  -- Line 2: C: Offset AR
  INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
  VALUES (v_je_id, v_ar_acct, 0, v_settle_amt, 'Offset AR: ' || v_invoice.invoice_number, 1);

  -- Lines 3-4: PDV reversal (only if VAT accounts exist and tax > 0)
  IF v_vat_adv_acct IS NOT NULL AND v_vat_out_acct IS NOT NULL AND v_tax_amt > 0 THEN
    INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
    VALUES (v_je_id, v_vat_adv_acct, v_tax_amt, 0, 'Reverse advance VAT', 2);

    INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
    VALUES (v_je_id, v_vat_out_acct, 0, v_tax_amt, 'Transfer to output VAT', 3);
  END IF;

  -- Update advance payment record
  UPDATE advance_payments SET
    status = CASE WHEN v_settle_amt >= amount THEN 'settled' ELSE 'partial' END,
    settled_at = now(),
    settlement_journal_entry_id = v_je_id,
    invoice_id = p_invoice_id
  WHERE id = p_advance_id;

  -- Update invoice advance_amount_applied
  UPDATE invoices SET
    advance_amount_applied = COALESCE(advance_amount_applied, 0) + v_settle_amt
  WHERE id = p_invoice_id;

  RETURN v_je_id;
END;
$function$;

-- Item 14: Add payroll enhancement columns to payroll_items
ALTER TABLE public.payroll_items ADD COLUMN IF NOT EXISTS meal_allowance numeric DEFAULT 0;
ALTER TABLE public.payroll_items ADD COLUMN IF NOT EXISTS transport_allowance numeric DEFAULT 0;
ALTER TABLE public.payroll_items ADD COLUMN IF NOT EXISTS overtime_multiplier numeric DEFAULT 1.26;

-- Add payroll enhancement columns to payroll_parameters
ALTER TABLE public.payroll_parameters ADD COLUMN IF NOT EXISTS meal_allowance_daily numeric DEFAULT 0;
ALTER TABLE public.payroll_parameters ADD COLUMN IF NOT EXISTS transport_allowance_monthly numeric DEFAULT 0;
ALTER TABLE public.payroll_parameters ADD COLUMN IF NOT EXISTS overtime_multiplier numeric DEFAULT 1.26;
ALTER TABLE public.payroll_parameters ADD COLUMN IF NOT EXISTS night_work_multiplier numeric DEFAULT 0.26;

-- Add municipal tax rate to employees
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS municipal_tax_rate numeric DEFAULT 0;

-- Item 11: Add 4701 (VAT on advances) to chart_of_accounts seed if missing
-- This ensures the advance settlement function has the account it needs
CREATE OR REPLACE FUNCTION public.seed_tenant_chart_of_accounts(_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only add 4701 if it doesn't exist (additive, won't break existing seed)
  INSERT INTO public.chart_of_accounts (tenant_id, code, name, name_sr, account_type, account_class, is_active)
  VALUES (_tenant_id, '4701', 'VAT on Advances', 'ПДВ на аванс', 'liability', '4', true)
  ON CONFLICT DO NOTHING;
END;
$function$;
