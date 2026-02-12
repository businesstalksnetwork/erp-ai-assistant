
-- Part 1: Add journal_entry_id to invoices for traceability
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS journal_entry_id uuid REFERENCES public.journal_entries(id);

-- Part 2: Seed standard chart of accounts for new tenants
CREATE OR REPLACE FUNCTION public.seed_tenant_chart_of_accounts(_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.chart_of_accounts (tenant_id, code, name, name_sr, account_type, level, is_system, is_active)
  VALUES
    (_tenant_id, '1000', 'Cash and Bank', 'Gotovina i banka', 'asset', 1, true, true),
    (_tenant_id, '1200', 'Accounts Receivable', 'Potraživanja od kupaca', 'asset', 1, true, true),
    (_tenant_id, '2100', 'Accounts Payable', 'Obaveze prema dobavljačima', 'liability', 1, true, true),
    (_tenant_id, '4700', 'Tax Payable (VAT)', 'Obaveze za PDV', 'liability', 1, true, true),
    (_tenant_id, '3000', 'Equity', 'Kapital', 'equity', 1, true, true),
    (_tenant_id, '6000', 'Sales Revenue', 'Prihodi od prodaje', 'revenue', 1, true, true),
    (_tenant_id, '7000', 'Cost of Goods Sold', 'Nabavna vrednost prodate robe', 'expense', 1, true, true),
    (_tenant_id, '8000', 'General Expenses', 'Opšti troškovi', 'expense', 1, true, true)
  ON CONFLICT DO NOTHING;
END;
$$;

-- Trigger to auto-seed chart of accounts on tenant creation
CREATE OR REPLACE FUNCTION public.trigger_seed_chart_of_accounts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.seed_tenant_chart_of_accounts(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS seed_chart_of_accounts_on_tenant ON public.tenants;
CREATE TRIGGER seed_chart_of_accounts_on_tenant
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_seed_chart_of_accounts();

-- Part 3: Atomic inventory adjustment RPC
CREATE OR REPLACE FUNCTION public.adjust_inventory_stock(
  p_tenant_id uuid,
  p_product_id uuid,
  p_warehouse_id uuid,
  p_quantity numeric,
  p_movement_type text DEFAULT 'adjustment',
  p_notes text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL,
  p_reference text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_movement_id uuid;
BEGIN
  -- Insert movement record
  INSERT INTO public.inventory_movements (tenant_id, product_id, warehouse_id, movement_type, quantity, notes, created_by, reference)
  VALUES (p_tenant_id, p_product_id, p_warehouse_id, p_movement_type, p_quantity, p_notes, p_created_by, p_reference)
  RETURNING id INTO v_movement_id;

  -- Upsert stock record
  INSERT INTO public.inventory_stock (tenant_id, product_id, warehouse_id, quantity_on_hand)
  VALUES (p_tenant_id, p_product_id, p_warehouse_id, p_quantity)
  ON CONFLICT (product_id, warehouse_id)
  DO UPDATE SET quantity_on_hand = inventory_stock.quantity_on_hand + p_quantity,
               updated_at = now();

  RETURN v_movement_id;
END;
$$;

-- Part 4: Create journal entry from invoice
CREATE OR REPLACE FUNCTION public.create_journal_from_invoice(p_invoice_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_invoice RECORD;
  v_entry_id uuid;
  v_entry_number text;
  v_receivable_id uuid;
  v_revenue_id uuid;
  v_tax_payable_id uuid;
  v_cash_id uuid;
  v_entry_count int;
BEGIN
  -- Get the invoice
  SELECT * INTO v_invoice FROM public.invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found: %', p_invoice_id;
  END IF;

  -- Look up standard accounts by convention codes
  SELECT id INTO v_receivable_id FROM public.chart_of_accounts WHERE tenant_id = v_invoice.tenant_id AND code = '1200' AND is_active = true LIMIT 1;
  SELECT id INTO v_revenue_id FROM public.chart_of_accounts WHERE tenant_id = v_invoice.tenant_id AND code = '6000' AND is_active = true LIMIT 1;
  SELECT id INTO v_tax_payable_id FROM public.chart_of_accounts WHERE tenant_id = v_invoice.tenant_id AND code = '4700' AND is_active = true LIMIT 1;
  SELECT id INTO v_cash_id FROM public.chart_of_accounts WHERE tenant_id = v_invoice.tenant_id AND code = '1000' AND is_active = true LIMIT 1;

  IF v_invoice.status = 'sent' THEN
    -- Sales journal entry: Debit Receivable, Credit Revenue + Tax Payable
    IF v_receivable_id IS NULL OR v_revenue_id IS NULL THEN
      RAISE EXCEPTION 'Standard accounts (1200, 6000) not found. Please set up your chart of accounts.';
    END IF;

    -- Generate entry number
    SELECT COUNT(*) + 1 INTO v_entry_count FROM public.journal_entries WHERE tenant_id = v_invoice.tenant_id;
    v_entry_number := 'JE-' || to_char(now(), 'YYYY') || '-' || lpad(v_entry_count::text, 5, '0');

    INSERT INTO public.journal_entries (tenant_id, entry_number, entry_date, description, reference, status, created_by, posted_at, posted_by)
    VALUES (v_invoice.tenant_id, v_entry_number, v_invoice.invoice_date, 'Invoice ' || v_invoice.invoice_number, v_invoice.invoice_number, 'posted', v_invoice.created_by, now(), v_invoice.created_by)
    RETURNING id INTO v_entry_id;

    -- Debit: Accounts Receivable (total including tax)
    INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
    VALUES (v_entry_id, v_receivable_id, v_invoice.total, 0, 'Receivable from ' || v_invoice.partner_name, 1);

    -- Credit: Revenue (subtotal)
    INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
    VALUES (v_entry_id, v_revenue_id, 0, v_invoice.subtotal, 'Revenue from ' || v_invoice.invoice_number, 2);

    -- Credit: Tax Payable (tax amount) if > 0
    IF v_invoice.tax_amount > 0 AND v_tax_payable_id IS NOT NULL THEN
      INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
      VALUES (v_entry_id, v_tax_payable_id, 0, v_invoice.tax_amount, 'VAT on ' || v_invoice.invoice_number, 3);
    END IF;

    -- Link journal entry to invoice
    UPDATE public.invoices SET journal_entry_id = v_entry_id WHERE id = p_invoice_id;

  ELSIF v_invoice.status = 'paid' THEN
    -- Payment journal entry: Debit Cash, Credit Receivable
    IF v_cash_id IS NULL OR v_receivable_id IS NULL THEN
      RAISE EXCEPTION 'Standard accounts (1000, 1200) not found. Please set up your chart of accounts.';
    END IF;

    SELECT COUNT(*) + 1 INTO v_entry_count FROM public.journal_entries WHERE tenant_id = v_invoice.tenant_id;
    v_entry_number := 'JE-' || to_char(now(), 'YYYY') || '-' || lpad(v_entry_count::text, 5, '0');

    INSERT INTO public.journal_entries (tenant_id, entry_number, entry_date, description, reference, status, created_by, posted_at, posted_by)
    VALUES (v_invoice.tenant_id, v_entry_number, CURRENT_DATE, 'Payment for ' || v_invoice.invoice_number, v_invoice.invoice_number, 'posted', v_invoice.created_by, now(), v_invoice.created_by)
    RETURNING id INTO v_entry_id;

    -- Debit: Cash/Bank
    INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
    VALUES (v_entry_id, v_cash_id, v_invoice.total, 0, 'Payment received from ' || v_invoice.partner_name, 1);

    -- Credit: Accounts Receivable
    INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
    VALUES (v_entry_id, v_receivable_id, 0, v_invoice.total, 'Clear receivable for ' || v_invoice.invoice_number, 2);

  ELSE
    RAISE EXCEPTION 'Journal entries are only created for sent or paid invoices, current status: %', v_invoice.status;
  END IF;

  RETURN v_entry_id;
END;
$$;

-- Part 5: Process invoice posting (journal + inventory movements)
CREATE OR REPLACE FUNCTION public.process_invoice_post(p_invoice_id uuid, p_default_warehouse_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_entry_id uuid;
  v_invoice RECORD;
  v_line RECORD;
BEGIN
  -- Create journal entry
  v_entry_id := public.create_journal_from_invoice(p_invoice_id);

  -- Get invoice for tenant_id
  SELECT * INTO v_invoice FROM public.invoices WHERE id = p_invoice_id;

  -- Create inventory movements for product lines (only if warehouse provided)
  IF p_default_warehouse_id IS NOT NULL THEN
    FOR v_line IN
      SELECT * FROM public.invoice_lines WHERE invoice_id = p_invoice_id AND product_id IS NOT NULL
    LOOP
      PERFORM public.adjust_inventory_stock(
        v_invoice.tenant_id,
        v_line.product_id,
        p_default_warehouse_id,
        -v_line.quantity,  -- negative = outbound
        'out',
        'Invoice ' || v_invoice.invoice_number,
        v_invoice.created_by,
        v_invoice.invoice_number
      );
    END LOOP;
  END IF;

  RETURN v_entry_id;
END;
$$;
