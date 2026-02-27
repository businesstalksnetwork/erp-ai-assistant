
-- Upgrade process_invoice_post to support item-type-aware revenue accounts
-- goods → 6120, service → 6500, product → 6100 (fallback to 6000)
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
  v_ar_account_id uuid;
  v_vat_account_id uuid;
  v_cogs_account_id uuid;
  v_inventory_account_id uuid;
  v_entry_number text;
  v_fiscal_period_id uuid;
  v_total_cost numeric := 0;
  v_rev_account_id uuid;
  v_rev_code text;
  v_sort_order int := 1;
  v_revenue_by_type jsonb := '{}'::jsonb;
  v_type_key text;
  v_type_amount numeric;
BEGIN
  SELECT * INTO v_invoice FROM invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  v_tenant_id := v_invoice.tenant_id;

  PERFORM public.assert_tenant_member(v_tenant_id);

  SELECT public.check_fiscal_period_open(v_tenant_id, v_invoice.invoice_date::text) INTO v_fiscal_period_id;

  SELECT id INTO v_ar_account_id FROM chart_of_accounts WHERE tenant_id = v_tenant_id AND code = '2040' AND is_active LIMIT 1;
  SELECT id INTO v_vat_account_id FROM chart_of_accounts WHERE tenant_id = v_tenant_id AND code = '4700' AND is_active LIMIT 1;
  SELECT id INTO v_cogs_account_id FROM chart_of_accounts WHERE tenant_id = v_tenant_id AND code = '5000' AND is_active LIMIT 1;
  SELECT id INTO v_inventory_account_id FROM chart_of_accounts WHERE tenant_id = v_tenant_id AND code = '1320' AND is_active LIMIT 1;

  IF v_ar_account_id IS NULL THEN
    RAISE EXCEPTION 'Required account (2040) not found';
  END IF;

  v_entry_number := 'INV-' || upper(to_hex(extract(epoch from now())::bigint));

  -- Create journal entry
  INSERT INTO journal_entries (tenant_id, entry_number, entry_date, description, reference, status, posted_at, posted_by, created_by, fiscal_period_id, source, legal_entity_id)
  VALUES (v_tenant_id, v_entry_number, v_invoice.invoice_date, 'Invoice posting: ' || v_invoice.invoice_number, v_invoice.invoice_number, 'posted', now(), auth.uid(), auth.uid(), v_fiscal_period_id, 'auto_invoice', v_invoice.legal_entity_id)
  RETURNING id INTO v_je_id;

  -- DR: Accounts Receivable
  INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
  VALUES (v_je_id, v_ar_account_id, v_invoice.total, 0, 'AR: ' || COALESCE(v_invoice.partner_name, ''), 0);

  -- Aggregate revenue by item_type from invoice_lines
  FOR v_line IN SELECT COALESCE(item_type, 'service') as item_type, SUM(line_total) as type_total 
                FROM invoice_lines WHERE invoice_id = p_invoice_id 
                GROUP BY COALESCE(item_type, 'service') LOOP
    -- Determine revenue account by item type
    v_rev_code := CASE v_line.item_type
      WHEN 'goods' THEN '6120'
      WHEN 'product' THEN '6100'
      WHEN 'service' THEN '6500'
      ELSE '6000'
    END;
    
    SELECT id INTO v_rev_account_id FROM chart_of_accounts 
    WHERE tenant_id = v_tenant_id AND code = v_rev_code AND is_active LIMIT 1;
    
    -- Fallback to 6000 if specific account not found
    IF v_rev_account_id IS NULL THEN
      SELECT id INTO v_rev_account_id FROM chart_of_accounts 
      WHERE tenant_id = v_tenant_id AND code = '6000' AND is_active LIMIT 1;
    END IF;
    
    IF v_rev_account_id IS NOT NULL AND v_line.type_total > 0 THEN
      INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
      VALUES (v_je_id, v_rev_account_id, 0, v_line.type_total, 
              CASE v_line.item_type WHEN 'goods' THEN 'Prihod od robe' WHEN 'product' THEN 'Prihod od proizvoda' ELSE 'Prihod od usluga' END || ': ' || v_invoice.invoice_number, 
              v_sort_order);
      v_sort_order := v_sort_order + 1;
    END IF;
  END LOOP;

  -- If no lines exist, fall back to subtotal on generic revenue
  IF v_sort_order = 1 THEN
    SELECT id INTO v_rev_account_id FROM chart_of_accounts WHERE tenant_id = v_tenant_id AND code = '6000' AND is_active LIMIT 1;
    IF v_rev_account_id IS NOT NULL THEN
      INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
      VALUES (v_je_id, v_rev_account_id, 0, v_invoice.subtotal, 'Revenue: ' || v_invoice.invoice_number, 1);
      v_sort_order := 2;
    END IF;
  END IF;

  -- CR: Output VAT
  IF v_vat_account_id IS NOT NULL AND v_invoice.tax_amount > 0 THEN
    INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
    VALUES (v_je_id, v_vat_account_id, 0, v_invoice.tax_amount, 'Output VAT', v_sort_order);
    v_sort_order := v_sort_order + 1;
  END IF;

  -- Inventory & COGS (if warehouse specified)
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
      VALUES (v_je_id, v_cogs_account_id, v_total_cost, 0, 'COGS: ' || v_invoice.invoice_number, v_sort_order);
      INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
      VALUES (v_je_id, v_inventory_account_id, 0, v_total_cost, 'Inventory reduction', v_sort_order + 1);
    END IF;
  END IF;

  UPDATE invoices SET journal_entry_id = v_je_id WHERE id = p_invoice_id;

  RETURN v_je_id;
END;
$$;
