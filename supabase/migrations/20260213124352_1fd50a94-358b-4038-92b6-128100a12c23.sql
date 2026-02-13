-- Critical Fix 2: Correct PIO employer rate from 11.5% to 12% (CROSO 2026)
-- Also update the calculate_payroll_for_run RPC

CREATE OR REPLACE FUNCTION public.calculate_payroll_for_run(p_payroll_run_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run RECORD; v_contract RECORD;
  v_gross numeric; v_pio_e numeric; v_health_e numeric; v_unemp_e numeric;
  v_taxbase numeric; v_tax numeric; v_net numeric; v_pio_r numeric; v_health_r numeric; v_tcost numeric;
  v_tg numeric := 0; v_tn numeric := 0; v_tt numeric := 0; v_tc numeric := 0;
  v_wd int := 22; v_ad int; v_ot_amt numeric; v_nt_amt numeric; v_ld_amt numeric;
  v_ot_cnt numeric; v_nt_cnt numeric; v_ld_cnt int;
  -- Statutory rates (CROSO 2026)
  v_pio_emp_rate numeric := 0.14;
  v_health_emp_rate numeric := 0.0515;
  v_unemp_emp_rate numeric := 0.0075;
  v_pio_empr_rate numeric := 0.12;  -- Fixed: was 0.115, CROSO says 12%
  v_health_empr_rate numeric := 0.0515;
  v_tax_rate numeric := 0.10;
  v_nontaxable numeric := 34221;  -- Ministry of Finance 2026
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
    v_pio_e := ROUND(v_gross * v_pio_emp_rate, 2);
    v_health_e := ROUND(v_gross * v_health_emp_rate, 2);
    v_unemp_e := ROUND(v_gross * v_unemp_emp_rate, 2);
    v_taxbase := GREATEST(v_gross - v_nontaxable, 0);
    v_tax := ROUND(v_taxbase * v_tax_rate, 2);
    v_net := v_gross - v_pio_e - v_health_e - v_unemp_e - v_tax;
    v_pio_r := ROUND(v_gross * v_pio_empr_rate, 2);
    v_health_r := ROUND(v_gross * v_health_empr_rate, 2);
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
END;
$$;

-- Critical Fix 3: POS sale posting — add embedded VAT (1340) release
CREATE OR REPLACE FUNCTION public.process_pos_sale(p_transaction_id uuid, p_tenant_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx RECORD; v_je uuid; v_en text;
  v_acash uuid; v_abank uuid; v_a6010 uuid; v_a2470 uuid; v_a5010 uuid; v_a1320 uuid; v_a1329 uuid; v_a1300 uuid; v_a1340 uuid;
  v_fp uuid; v_cogs numeric := 0; v_markup numeric := 0; v_embedded_vat numeric := 0; v_pcost numeric; v_da uuid;
  v_item jsonb; v_pid uuid; v_qty numeric;
  v_retail_total numeric;
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
  SELECT id INTO v_a1340 FROM chart_of_accounts WHERE tenant_id = p_tenant_id AND code = '1340' AND is_active LIMIT 1;
  SELECT id INTO v_a1300 FROM chart_of_accounts WHERE tenant_id = p_tenant_id AND code = '1300' AND is_active LIMIT 1;
  IF v_a6010 IS NULL OR v_a2470 IS NULL THEN RAISE EXCEPTION 'Missing accounts 6010/2470'; END IF;
  -- Payment account: cash (2430) or card clearing (2431)
  IF v_tx.payment_method = 'cash' THEN v_da := v_acash; ELSE v_da := v_abank; END IF;
  IF v_da IS NULL THEN RAISE EXCEPTION 'Missing cash/bank account'; END IF;
  v_fp := check_fiscal_period_open(p_tenant_id, CURRENT_DATE::text);
  v_en := 'POS-' || substr(md5(random()::text), 1, 8);
  INSERT INTO journal_entries (tenant_id, entry_number, entry_date, description, reference, status, fiscal_period_id, posted_at)
  VALUES (p_tenant_id, v_en, CURRENT_DATE, 'POS - ' || v_tx.transaction_number, v_tx.transaction_number, 'posted', v_fp, now())
  RETURNING id INTO v_je;
  -- Revenue recognition: D: Cash/Bank, C: Revenue + Output VAT
  INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order) VALUES
    (v_je, v_da, v_tx.total, 0, 'POS receipt', 0),
    (v_je, v_a6010, 0, v_tx.subtotal, 'Revenue', 1),
    (v_je, v_a2470, 0, v_tx.tax_amount, 'Output VAT', 2);
  -- Inventory COGS entries
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
        -- Retail accounting: 1320 is at retail price INCLUDING embedded VAT
        -- On sale: release embedded VAT (1340) and reverse markup (1329)
        v_retail_total := v_tx.subtotal + v_tx.tax_amount;  -- full retail price incl. VAT
        v_embedded_vat := v_tx.tax_amount;
        v_markup := v_retail_total - v_embedded_vat - v_cogs;  -- margin = retail - VAT - cost
        INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order) VALUES
          (v_je, v_a5010, v_cogs, 0, 'COGS', 3),
          (v_je, v_a1329, v_markup, 0, 'Reverse markup', 4);
        -- Release embedded VAT if account 1340 exists
        IF v_a1340 IS NOT NULL THEN
          INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order) VALUES
            (v_je, v_a1340, v_embedded_vat, 0, 'Release embedded VAT', 5);
        END IF;
        -- Credit retail inventory at full retail price (incl. VAT)
        INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order) VALUES
          (v_je, v_a1320, 0, v_retail_total, 'Retail inv out (incl. VAT)', 6);
      ELSIF v_a1300 IS NOT NULL THEN
        INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order) VALUES
          (v_je, v_a5010, v_cogs, 0, 'COGS', 3), (v_je, v_a1300, 0, v_cogs, 'Inventory out', 4);
      END IF;
    END IF;
  END IF;
  UPDATE pos_transactions SET journal_entry_id = v_je WHERE id = p_transaction_id;
  RETURN v_je;
END;
$$;