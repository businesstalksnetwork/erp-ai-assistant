
-- Drop functions that need signature changes
DROP FUNCTION IF EXISTS public.process_invoice_post(uuid, uuid);
DROP FUNCTION IF EXISTS public.create_journal_from_invoice(uuid);
DROP FUNCTION IF EXISTS public.calculate_payroll_for_run(uuid);
DROP FUNCTION IF EXISTS public.process_pos_sale(uuid, uuid);

-- Payment journal entry (mark as paid): D:2431 Bank P:2040 Kupci
CREATE FUNCTION public.create_journal_from_invoice(p_invoice_id uuid)
RETURNS uuid
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_invoice RECORD; v_a2040 uuid; v_a2431 uuid; v_fp uuid; v_je uuid; v_en text;
BEGIN
  SELECT * INTO v_invoice FROM invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  SELECT id INTO v_a2040 FROM chart_of_accounts WHERE tenant_id = v_invoice.tenant_id AND code = '2040' AND is_active LIMIT 1;
  SELECT id INTO v_a2431 FROM chart_of_accounts WHERE tenant_id = v_invoice.tenant_id AND code = '2431' AND is_active LIMIT 1;
  IF v_a2040 IS NULL OR v_a2431 IS NULL THEN RAISE EXCEPTION 'Missing accounts 2040/2431'; END IF;
  v_fp := check_fiscal_period_open(v_invoice.tenant_id, CURRENT_DATE::text);
  v_en := 'INV-PAY-' || substr(md5(random()::text), 1, 8);
  INSERT INTO journal_entries (tenant_id, entry_number, entry_date, description, reference, status, fiscal_period_id, posted_at, legal_entity_id)
  VALUES (v_invoice.tenant_id, v_en, CURRENT_DATE, 'Payment - ' || v_invoice.invoice_number, v_invoice.invoice_number, 'posted', v_fp, now(), v_invoice.legal_entity_id)
  RETURNING id INTO v_je;
  INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order) VALUES
    (v_je, v_a2431, v_invoice.total, 0, 'Bank receipt - ' || v_invoice.partner_name, 0),
    (v_je, v_a2040, 0, v_invoice.total, 'Clear receivable - ' || v_invoice.partner_name, 1);
  RETURN v_je;
END; $$;

-- Invoice posting: D:2040 P:6010 P:2470 + COGS
CREATE FUNCTION public.process_invoice_post(p_invoice_id uuid, p_default_warehouse_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_inv RECORD; v_je uuid; v_en text;
  v_a2040 uuid; v_a6010 uuid; v_a2470 uuid; v_a5010 uuid; v_a1300 uuid;
  v_fp uuid; v_cogs numeric := 0; v_line RECORD; v_cost numeric;
BEGIN
  SELECT * INTO v_inv FROM invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  SELECT id INTO v_a2040 FROM chart_of_accounts WHERE tenant_id = v_inv.tenant_id AND code = '2040' AND is_active LIMIT 1;
  SELECT id INTO v_a6010 FROM chart_of_accounts WHERE tenant_id = v_inv.tenant_id AND code = '6010' AND is_active LIMIT 1;
  SELECT id INTO v_a2470 FROM chart_of_accounts WHERE tenant_id = v_inv.tenant_id AND code = '2470' AND is_active LIMIT 1;
  SELECT id INTO v_a5010 FROM chart_of_accounts WHERE tenant_id = v_inv.tenant_id AND code = '5010' AND is_active LIMIT 1;
  SELECT id INTO v_a1300 FROM chart_of_accounts WHERE tenant_id = v_inv.tenant_id AND code = '1300' AND is_active LIMIT 1;
  IF v_a2040 IS NULL OR v_a6010 IS NULL OR v_a2470 IS NULL THEN RAISE EXCEPTION 'Missing accounts 2040/6010/2470'; END IF;
  v_fp := check_fiscal_period_open(v_inv.tenant_id, v_inv.invoice_date::text);
  v_en := 'INV-' || substr(md5(random()::text), 1, 8);
  INSERT INTO journal_entries (tenant_id, entry_number, entry_date, description, reference, status, fiscal_period_id, posted_at, legal_entity_id)
  VALUES (v_inv.tenant_id, v_en, v_inv.invoice_date, 'Invoice - ' || v_inv.invoice_number, v_inv.invoice_number, 'posted', v_fp, now(), v_inv.legal_entity_id)
  RETURNING id INTO v_je;
  INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order) VALUES
    (v_je, v_a2040, v_inv.total, 0, 'Receivable - ' || v_inv.partner_name, 0),
    (v_je, v_a6010, 0, v_inv.subtotal, 'Revenue - ' || v_inv.invoice_number, 1),
    (v_je, v_a2470, 0, v_inv.tax_amount, 'Output VAT - ' || v_inv.invoice_number, 2);
  IF p_default_warehouse_id IS NOT NULL AND v_a5010 IS NOT NULL AND v_a1300 IS NOT NULL THEN
    FOR v_line IN SELECT product_id, quantity FROM invoice_lines WHERE invoice_id = p_invoice_id AND product_id IS NOT NULL
    LOOP
      SELECT COALESCE(purchase_price, 0) INTO v_cost FROM products WHERE id = v_line.product_id;
      IF v_cost > 0 THEN v_cogs := v_cogs + (v_cost * v_line.quantity); END IF;
      UPDATE inventory_stock SET quantity_on_hand = quantity_on_hand - v_line.quantity WHERE product_id = v_line.product_id AND warehouse_id = p_default_warehouse_id;
      INSERT INTO inventory_movements (tenant_id, product_id, warehouse_id, movement_type, quantity, reference) VALUES (v_inv.tenant_id, v_line.product_id, p_default_warehouse_id, 'out', v_line.quantity, v_inv.invoice_number);
    END LOOP;
    IF v_cogs > 0 THEN
      INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order) VALUES
        (v_je, v_a5010, v_cogs, 0, 'COGS - ' || v_inv.invoice_number, 3),
        (v_je, v_a1300, 0, v_cogs, 'Inventory - ' || v_inv.invoice_number, 4);
    END IF;
  END IF;
  UPDATE invoices SET journal_entry_id = v_je WHERE id = p_invoice_id;
END; $$;

-- POS Sale RPC
CREATE FUNCTION public.process_pos_sale(p_transaction_id uuid, p_tenant_id uuid)
RETURNS uuid
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_tx RECORD; v_je uuid; v_en text;
  v_acash uuid; v_abank uuid; v_a6010 uuid; v_a2470 uuid; v_a5010 uuid; v_a1320 uuid; v_a1329 uuid; v_a1300 uuid;
  v_fp uuid; v_cogs numeric := 0; v_markup numeric := 0; v_pcost numeric; v_da uuid;
  v_item jsonb; v_pid uuid; v_qty numeric;
BEGIN
  SELECT * INTO v_tx FROM pos_transactions WHERE id = p_transaction_id AND tenant_id = p_tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'POS transaction not found'; END IF;
  SELECT id INTO v_acash FROM chart_of_accounts WHERE tenant_id = p_tenant_id AND code = '2430' AND is_active LIMIT 1;
  SELECT id INTO v_abank FROM chart_of_accounts WHERE tenant_id = p_tenant_id AND code = '2431' AND is_active LIMIT 1;
  SELECT id INTO v_a6010 FROM chart_of_accounts WHERE tenant_id = p_tenant_id AND code = '6010' AND is_active LIMIT 1;
  SELECT id INTO v_a2470 FROM chart_of_accounts WHERE tenant_id = p_tenant_id AND code = '2470' AND is_active LIMIT 1;
  SELECT id INTO v_a5010 FROM chart_of_accounts WHERE tenant_id = p_tenant_id AND code = '5010' AND is_active LIMIT 1;
  SELECT id INTO v_a1320 FROM chart_of_accounts WHERE tenant_id = p_tenant_id AND code = '1320' AND is_active LIMIT 1;
  SELECT id INTO v_a1329 FROM chart_of_accounts WHERE tenant_id = p_tenant_id AND code = '1329' AND is_active LIMIT 1;
  SELECT id INTO v_a1300 FROM chart_of_accounts WHERE tenant_id = p_tenant_id AND code = '1300' AND is_active LIMIT 1;
  IF v_a6010 IS NULL OR v_a2470 IS NULL THEN RAISE EXCEPTION 'Missing accounts 6010/2470'; END IF;
  IF v_tx.payment_method = 'cash' THEN v_da := v_acash; ELSE v_da := v_abank; END IF;
  IF v_da IS NULL THEN RAISE EXCEPTION 'Missing cash/bank account'; END IF;
  v_fp := check_fiscal_period_open(p_tenant_id, CURRENT_DATE::text);
  v_en := 'POS-' || substr(md5(random()::text), 1, 8);
  INSERT INTO journal_entries (tenant_id, entry_number, entry_date, description, reference, status, fiscal_period_id, posted_at)
  VALUES (p_tenant_id, v_en, CURRENT_DATE, 'POS - ' || v_tx.transaction_number, v_tx.transaction_number, 'posted', v_fp, now())
  RETURNING id INTO v_je;
  INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order) VALUES
    (v_je, v_da, v_tx.total, 0, 'POS receipt', 0),
    (v_je, v_a6010, 0, v_tx.subtotal, 'Revenue', 1),
    (v_je, v_a2470, 0, v_tx.tax_amount, 'Output VAT', 2);
  IF v_tx.warehouse_id IS NOT NULL AND v_a5010 IS NOT NULL THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_tx.items::jsonb) LOOP
      v_pid := (v_item->>'product_id')::uuid;
      v_qty := (v_item->>'quantity')::numeric;
      IF v_pid IS NULL THEN CONTINUE; END IF;
      SELECT COALESCE(purchase_price, 0) INTO v_pcost FROM products WHERE id = v_pid;
      IF v_pcost > 0 THEN v_cogs := v_cogs + (v_pcost * v_qty); END IF;
      UPDATE inventory_stock SET quantity_on_hand = quantity_on_hand - v_qty WHERE product_id = v_pid AND warehouse_id = v_tx.warehouse_id;
      INSERT INTO inventory_movements (tenant_id, product_id, warehouse_id, movement_type, quantity, reference) VALUES (p_tenant_id, v_pid, v_tx.warehouse_id, 'out', v_qty, v_tx.transaction_number);
    END LOOP;
    IF v_cogs > 0 THEN
      IF v_a1320 IS NOT NULL AND v_a1329 IS NOT NULL THEN
        v_markup := v_tx.subtotal - v_cogs;
        INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order) VALUES
          (v_je, v_a5010, v_cogs, 0, 'COGS', 3), (v_je, v_a1329, v_markup, 0, 'Reverse markup', 4), (v_je, v_a1320, 0, v_tx.subtotal, 'Retail inv out', 5);
      ELSIF v_a1300 IS NOT NULL THEN
        INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order) VALUES
          (v_je, v_a5010, v_cogs, 0, 'COGS', 3), (v_je, v_a1300, 0, v_cogs, 'Inventory out', 4);
      END IF;
    END IF;
  END IF;
  UPDATE pos_transactions SET journal_entry_id = v_je WHERE id = p_transaction_id;
  RETURN v_je;
END; $$;

-- Kalkulacija & Nivelacija tables
CREATE TABLE IF NOT EXISTS public.kalkulacije (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  kalkulacija_number text NOT NULL,
  kalkulacija_date date NOT NULL DEFAULT CURRENT_DATE,
  warehouse_id uuid REFERENCES warehouses(id),
  internal_receipt_id uuid,
  status text NOT NULL DEFAULT 'draft',
  journal_entry_id uuid REFERENCES journal_entries(id),
  notes text, created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.kalkulacije ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kalkulacije_tenant" ON public.kalkulacije FOR ALL USING (tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE TABLE IF NOT EXISTS public.kalkulacija_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kalkulacija_id uuid NOT NULL REFERENCES kalkulacije(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  quantity numeric NOT NULL DEFAULT 1, purchase_price numeric NOT NULL DEFAULT 0,
  markup_percent numeric NOT NULL DEFAULT 0, pdv_rate numeric NOT NULL DEFAULT 20,
  retail_price numeric NOT NULL DEFAULT 0, sort_order int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.nivelacije (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  nivelacija_number text NOT NULL,
  nivelacija_date date NOT NULL DEFAULT CURRENT_DATE,
  warehouse_id uuid REFERENCES warehouses(id),
  status text NOT NULL DEFAULT 'draft',
  journal_entry_id uuid REFERENCES journal_entries(id),
  notes text, created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.nivelacije ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nivelacije_tenant" ON public.nivelacije FOR ALL USING (tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE TABLE IF NOT EXISTS public.nivelacija_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nivelacija_id uuid NOT NULL REFERENCES nivelacije(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  old_retail_price numeric NOT NULL DEFAULT 0, new_retail_price numeric NOT NULL DEFAULT 0,
  quantity_on_hand numeric NOT NULL DEFAULT 0, price_difference numeric NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0
);

-- Add employer contribution columns to payroll_items
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payroll_items' AND column_name = 'pension_employer') THEN
    ALTER TABLE payroll_items ADD COLUMN pension_employer numeric NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payroll_items' AND column_name = 'health_employer') THEN
    ALTER TABLE payroll_items ADD COLUMN health_employer numeric NOT NULL DEFAULT 0;
  END IF;
END; $$;

-- Add journal_entry_id to pos_transactions
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pos_transactions' AND column_name = 'journal_entry_id') THEN
    ALTER TABLE pos_transactions ADD COLUMN journal_entry_id uuid REFERENCES journal_entries(id);
  END IF;
END; $$;

-- Mark old Anglo-Saxon accounts inactive
UPDATE chart_of_accounts SET is_active = false WHERE code IN ('1000', '2100', '4700', '6000', '8000', '8100', '8200', '8210', '8300') AND is_active = true;

-- Payroll calculation with 2026 Serbian values (34,221 RSD nontaxable)
CREATE FUNCTION public.calculate_payroll_for_run(p_payroll_run_id uuid)
RETURNS void
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_run RECORD; v_contract RECORD;
  v_gross numeric; v_pio_e numeric; v_health_e numeric; v_unemp_e numeric;
  v_taxbase numeric; v_tax numeric; v_net numeric; v_pio_r numeric; v_health_r numeric; v_tcost numeric;
  v_tg numeric := 0; v_tn numeric := 0; v_tt numeric := 0; v_tc numeric := 0;
  v_wd int := 22; v_ad int; v_ot_amt numeric; v_nt_amt numeric; v_ld_amt numeric;
  v_ot_cnt numeric; v_nt_cnt numeric; v_ld_cnt int;
BEGIN
  SELECT * INTO v_run FROM payroll_runs WHERE id = p_payroll_run_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payroll run not found'; END IF;
  DELETE FROM payroll_items WHERE payroll_run_id = p_payroll_run_id;
  FOR v_contract IN
    SELECT ec.*, e.id as emp_id FROM employee_contracts ec JOIN employees e ON e.id = ec.employee_id
    WHERE e.tenant_id = v_run.tenant_id AND e.status = 'active'
      AND ec.start_date <= make_date(v_run.period_year, v_run.period_month, 1)
      AND (ec.end_date IS NULL OR ec.end_date >= make_date(v_run.period_year, v_run.period_month, 1))
    ORDER BY ec.start_date DESC
  LOOP
    v_gross := COALESCE(v_contract.gross_salary, 0);
    IF v_gross = 0 THEN CONTINUE; END IF;
    SELECT COALESCE(SUM(hours),0) INTO v_ot_cnt FROM overtime_hours WHERE employee_id=v_contract.emp_id AND month=v_run.period_month AND year=v_run.period_year;
    v_ot_amt := (v_gross/(v_wd*8))*v_ot_cnt*1.26;
    SELECT COALESCE(SUM(hours),0) INTO v_nt_cnt FROM night_work_records WHERE employee_id=v_contract.emp_id AND month=v_run.period_month AND year=v_run.period_year;
    v_nt_amt := (v_gross/(v_wd*8))*v_nt_cnt*0.26;
    SELECT COALESCE(COUNT(*),0) INTO v_ld_cnt FROM leave_requests WHERE employee_id=v_contract.emp_id AND status='approved' AND leave_type='unpaid'
      AND start_date<=make_date(v_run.period_year,v_run.period_month,28) AND end_date>=make_date(v_run.period_year,v_run.period_month,1);
    v_ld_amt := (v_gross/v_wd)*v_ld_cnt; v_ad := v_wd - v_ld_cnt;
    v_gross := v_gross + v_ot_amt + v_nt_amt - v_ld_amt;
    v_pio_e := ROUND(v_gross*0.14,2); v_health_e := ROUND(v_gross*0.0515,2); v_unemp_e := ROUND(v_gross*0.0075,2);
    v_taxbase := GREATEST(v_gross - 34221, 0); v_tax := ROUND(v_taxbase*0.10,2);
    v_net := v_gross - v_pio_e - v_health_e - v_unemp_e - v_tax;
    v_pio_r := ROUND(v_gross*0.115,2); v_health_r := ROUND(v_gross*0.0515,2);
    v_tcost := v_gross + v_pio_r + v_health_r;
    INSERT INTO payroll_items (payroll_run_id, employee_id, gross_salary, net_salary, income_tax,
      pension_contribution, health_contribution, unemployment_contribution, pension_employer, health_employer,
      taxable_base, total_cost, working_days, actual_working_days,
      overtime_hours_count, night_work_hours_count, overtime_amount, night_work_amount,
      leave_days_deducted, leave_deduction_amount)
    VALUES (p_payroll_run_id, v_contract.emp_id, v_gross, v_net, v_tax,
      v_pio_e, v_health_e, v_unemp_e, v_pio_r, v_health_r,
      v_taxbase, v_tcost, v_wd, v_ad, v_ot_cnt, v_nt_cnt, v_ot_amt, v_nt_amt, v_ld_cnt, v_ld_amt);
    v_tg := v_tg + v_gross; v_tn := v_tn + v_net; v_tt := v_tt + v_tax;
    v_tc := v_tc + v_pio_e + v_health_e + v_unemp_e + v_pio_r + v_health_r;
  END LOOP;
  UPDATE payroll_runs SET status='calculated', total_gross=v_tg, total_net=v_tn, total_taxes=v_tt, total_contributions=v_tc WHERE id=p_payroll_run_id;
END; $$;
