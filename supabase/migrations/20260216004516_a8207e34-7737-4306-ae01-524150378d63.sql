
-- Drop the existing function with old return type first
DROP FUNCTION IF EXISTS public.process_invoice_post(uuid, uuid);

-- =============================================
-- 1. Harden process_invoice_post (with correct return type)
-- =============================================
CREATE OR REPLACE FUNCTION public.process_invoice_post(p_invoice_id uuid, p_default_warehouse_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice RECORD;
  v_tenant_id uuid;
  v_je_id uuid;
  v_line RECORD;
  v_revenue_account_id uuid;
  v_ar_account_id uuid;
  v_vat_account_id uuid;
  v_cogs_account_id uuid;
  v_inventory_account_id uuid;
  v_entry_number text;
  v_fiscal_period_id uuid;
  v_total_cost numeric := 0;
BEGIN
  SELECT * INTO v_invoice FROM invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  v_tenant_id := v_invoice.tenant_id;

  PERFORM public.assert_tenant_member(v_tenant_id);

  SELECT public.check_fiscal_period_open(v_tenant_id, v_invoice.invoice_date::text) INTO v_fiscal_period_id;

  SELECT id INTO v_revenue_account_id FROM chart_of_accounts WHERE tenant_id = v_tenant_id AND code = '6000' AND is_active LIMIT 1;
  SELECT id INTO v_ar_account_id FROM chart_of_accounts WHERE tenant_id = v_tenant_id AND code = '2040' AND is_active LIMIT 1;
  SELECT id INTO v_vat_account_id FROM chart_of_accounts WHERE tenant_id = v_tenant_id AND code = '4700' AND is_active LIMIT 1;
  SELECT id INTO v_cogs_account_id FROM chart_of_accounts WHERE tenant_id = v_tenant_id AND code = '5000' AND is_active LIMIT 1;
  SELECT id INTO v_inventory_account_id FROM chart_of_accounts WHERE tenant_id = v_tenant_id AND code = '1320' AND is_active LIMIT 1;

  IF v_revenue_account_id IS NULL OR v_ar_account_id IS NULL THEN
    RAISE EXCEPTION 'Required accounts (6000, 2040) not found';
  END IF;

  v_entry_number := 'INV-' || upper(to_hex(extract(epoch from now())::bigint));

  INSERT INTO journal_entries (tenant_id, entry_number, entry_date, description, reference, status, posted_at, posted_by, created_by, fiscal_period_id, source, legal_entity_id)
  VALUES (v_tenant_id, v_entry_number, v_invoice.invoice_date, 'Invoice posting: ' || v_invoice.invoice_number, v_invoice.invoice_number, 'posted', now(), auth.uid(), auth.uid(), v_fiscal_period_id, 'auto_invoice', v_invoice.legal_entity_id)
  RETURNING id INTO v_je_id;

  INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
  VALUES (v_je_id, v_ar_account_id, v_invoice.total, 0, 'AR: ' || v_invoice.partner_name, 0);

  INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
  VALUES (v_je_id, v_revenue_account_id, 0, v_invoice.subtotal, 'Revenue: ' || v_invoice.invoice_number, 1);

  IF v_vat_account_id IS NOT NULL AND v_invoice.tax_amount > 0 THEN
    INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
    VALUES (v_je_id, v_vat_account_id, 0, v_invoice.tax_amount, 'Output VAT', 2);
  END IF;

  IF p_default_warehouse_id IS NOT NULL AND v_cogs_account_id IS NOT NULL AND v_inventory_account_id IS NOT NULL THEN
    FOR v_line IN SELECT * FROM invoice_lines WHERE invoice_id = p_invoice_id AND product_id IS NOT NULL LOOP
      DECLARE v_unit_cost numeric := 0; v_stock_id uuid;
      BEGIN
        SELECT id, COALESCE(unit_cost, 0) INTO v_stock_id, v_unit_cost
        FROM inventory_stock
        WHERE tenant_id = v_tenant_id AND product_id = v_line.product_id AND warehouse_id = p_default_warehouse_id
        LIMIT 1;

        IF v_stock_id IS NOT NULL THEN
          UPDATE inventory_stock SET quantity_on_hand = quantity_on_hand - v_line.quantity WHERE id = v_stock_id;
          INSERT INTO inventory_movements (tenant_id, product_id, warehouse_id, movement_type, quantity, unit_cost, reference_type, reference_id)
          VALUES (v_tenant_id, v_line.product_id, p_default_warehouse_id, 'sale', -v_line.quantity, v_unit_cost, 'invoice', p_invoice_id);
          v_total_cost := v_total_cost + (v_unit_cost * v_line.quantity);
        END IF;
      END;
    END LOOP;

    IF v_total_cost > 0 THEN
      INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
      VALUES (v_je_id, v_cogs_account_id, v_total_cost, 0, 'COGS: ' || v_invoice.invoice_number, 10);
      INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
      VALUES (v_je_id, v_inventory_account_id, 0, v_total_cost, 'Inventory reduction', 11);
    END IF;
  END IF;

  UPDATE invoices SET journal_entry_id = v_je_id WHERE id = p_invoice_id;

  RETURN v_je_id;
END;
$$;

-- =============================================
-- 2. Atomic journal entry creation RPC
-- =============================================
CREATE OR REPLACE FUNCTION public.create_journal_entry_with_lines(
  p_tenant_id uuid,
  p_entry_number text,
  p_entry_date date,
  p_description text DEFAULT NULL,
  p_reference text DEFAULT NULL,
  p_legal_entity_id uuid DEFAULT NULL,
  p_lines jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_je_id uuid;
  v_total_debit numeric := 0;
  v_total_credit numeric := 0;
  v_line jsonb;
  v_fiscal_period_id uuid;
  i int := 0;
BEGIN
  PERFORM public.assert_tenant_member(p_tenant_id);

  SELECT COALESCE(SUM((l->>'debit')::numeric), 0),
         COALESCE(SUM((l->>'credit')::numeric), 0)
  INTO v_total_debit, v_total_credit
  FROM jsonb_array_elements(p_lines) AS l;

  IF ABS(v_total_debit - v_total_credit) > 0.001 THEN
    RAISE EXCEPTION 'Journal entry must balance: debit=% credit=%', v_total_debit, v_total_credit;
  END IF;

  IF jsonb_array_length(p_lines) < 2 THEN
    RAISE EXCEPTION 'Journal entry must have at least 2 lines';
  END IF;

  SELECT public.check_fiscal_period_open(p_tenant_id, p_entry_date::text) INTO v_fiscal_period_id;

  INSERT INTO journal_entries (tenant_id, entry_number, entry_date, description, reference, created_by, legal_entity_id, fiscal_period_id)
  VALUES (p_tenant_id, p_entry_number, p_entry_date, p_description, p_reference, auth.uid(), p_legal_entity_id, v_fiscal_period_id)
  RETURNING id INTO v_je_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    INSERT INTO journal_lines (journal_entry_id, account_id, description, debit, credit, sort_order)
    VALUES (v_je_id, (v_line->>'account_id')::uuid, v_line->>'description', COALESCE((v_line->>'debit')::numeric, 0), COALESCE((v_line->>'credit')::numeric, 0), i);
    i := i + 1;
  END LOOP;

  RETURN v_je_id;
END;
$$;

-- =============================================
-- 3. Atomic storno RPC
-- =============================================
CREATE OR REPLACE FUNCTION public.storno_journal_entry(p_journal_entry_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_original RECORD;
  v_storno_id uuid;
  v_line RECORD;
  v_entry_number text;
  v_fiscal_period_id uuid;
  i int := 0;
BEGIN
  SELECT * INTO v_original FROM journal_entries WHERE id = p_journal_entry_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Journal entry not found'; END IF;
  IF v_original.status <> 'posted' THEN RAISE EXCEPTION 'Only posted entries can be reversed'; END IF;
  IF v_original.storno_by_id IS NOT NULL THEN RAISE EXCEPTION 'Entry already reversed'; END IF;

  PERFORM public.assert_tenant_member(v_original.tenant_id);

  v_entry_number := 'STORNO-' || v_original.entry_number;
  SELECT public.check_fiscal_period_open(v_original.tenant_id, CURRENT_DATE::text) INTO v_fiscal_period_id;

  INSERT INTO journal_entries (tenant_id, entry_number, entry_date, description, reference, status, posted_at, posted_by, created_by, storno_of_id, is_storno, source, fiscal_period_id, legal_entity_id)
  VALUES (v_original.tenant_id, v_entry_number, CURRENT_DATE, 'Storno: ' || v_original.entry_number || ' — ' || COALESCE(v_original.description, ''), v_original.reference, 'posted', now(), auth.uid(), auth.uid(), p_journal_entry_id, true, 'auto_storno', v_fiscal_period_id, v_original.legal_entity_id)
  RETURNING id INTO v_storno_id;

  FOR v_line IN SELECT * FROM journal_lines WHERE journal_entry_id = p_journal_entry_id ORDER BY sort_order
  LOOP
    INSERT INTO journal_lines (journal_entry_id, account_id, description, debit, credit, sort_order)
    VALUES (v_storno_id, v_line.account_id, 'Storno: ' || COALESCE(v_line.description, ''), v_line.credit, v_line.debit, i);
    i := i + 1;
  END LOOP;

  UPDATE journal_entries SET storno_by_id = v_storno_id, status = 'reversed' WHERE id = p_journal_entry_id;

  RETURN v_storno_id;
END;
$$;
