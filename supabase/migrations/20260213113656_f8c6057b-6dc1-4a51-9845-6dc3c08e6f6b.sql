
-- RPC: Post a kalkulacija to the general ledger
-- D: 1320 (retail total), C: 1329 (markup), C: 1300 (cost)
CREATE OR REPLACE FUNCTION public.post_kalkulacija(p_kalkulacija_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kalkulacija RECORD;
  v_item RECORD;
  v_total_retail numeric := 0;
  v_total_cost numeric := 0;
  v_total_markup numeric := 0;
  v_journal_id uuid;
  v_entry_number text;
  v_fiscal_period_id uuid;
BEGIN
  -- Get kalkulacija
  SELECT * INTO v_kalkulacija FROM kalkulacije WHERE id = p_kalkulacija_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Kalkulacija not found'; END IF;
  IF v_kalkulacija.status = 'posted' THEN RAISE EXCEPTION 'Already posted'; END IF;

  -- Sum items
  FOR v_item IN SELECT * FROM kalkulacija_items WHERE kalkulacija_id = p_kalkulacija_id
  LOOP
    v_total_cost := v_total_cost + (v_item.purchase_price * v_item.quantity);
    v_total_retail := v_total_retail + (v_item.retail_price * v_item.quantity);
  END LOOP;

  v_total_markup := v_total_retail - v_total_cost;

  IF v_total_retail <= 0 THEN RAISE EXCEPTION 'No items to post'; END IF;

  -- Check fiscal period
  SELECT check_fiscal_period_open(v_kalkulacija.tenant_id, v_kalkulacija.kalkulacija_date::text) INTO v_fiscal_period_id;

  -- Generate entry number
  v_entry_number := 'KLK-' || upper(to_hex(extract(epoch from now())::bigint));

  -- Create journal entry
  INSERT INTO journal_entries (tenant_id, entry_number, entry_date, description, reference, status, fiscal_period_id, posted_at, posted_by, created_by)
  VALUES (v_kalkulacija.tenant_id, v_entry_number, v_kalkulacija.kalkulacija_date, 'Kalkulacija ' || v_kalkulacija.kalkulacija_number, v_kalkulacija.kalkulacija_number, 'posted', v_fiscal_period_id, now(), v_kalkulacija.created_by, v_kalkulacija.created_by)
  RETURNING id INTO v_journal_id;

  -- D: 1320 Roba u maloprodaji
  INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
  VALUES (v_journal_id, (SELECT id FROM chart_of_accounts WHERE tenant_id = v_kalkulacija.tenant_id AND code = '1320' AND is_active LIMIT 1), v_total_retail, 0, 'Roba u maloprodaji', 0);

  -- C: 1329 Razlika u ceni (markup)
  INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
  VALUES (v_journal_id, (SELECT id FROM chart_of_accounts WHERE tenant_id = v_kalkulacija.tenant_id AND code = '1329' AND is_active LIMIT 1), 0, v_total_markup, 'Razlika u ceni', 1);

  -- C: 1300 Roba (cost)
  INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
  VALUES (v_journal_id, (SELECT id FROM chart_of_accounts WHERE tenant_id = v_kalkulacija.tenant_id AND code = '1300' AND is_active LIMIT 1), 0, v_total_cost, 'Roba - nabavna vrednost', 2);

  -- Update kalkulacija status
  UPDATE kalkulacije SET status = 'posted', journal_entry_id = v_journal_id WHERE id = p_kalkulacija_id;

  RETURN v_journal_id;
END;
$$;

-- RPC: Post a nivelacija to the general ledger
-- If price increase: D: 1320, C: 1329
-- If price decrease: D: 1329, C: 1320
CREATE OR REPLACE FUNCTION public.post_nivelacija(p_nivelacija_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nivelacija RECORD;
  v_item RECORD;
  v_total_diff numeric := 0;
  v_journal_id uuid;
  v_entry_number text;
  v_fiscal_period_id uuid;
BEGIN
  SELECT * INTO v_nivelacija FROM nivelacije WHERE id = p_nivelacija_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nivelacija not found'; END IF;
  IF v_nivelacija.status = 'posted' THEN RAISE EXCEPTION 'Already posted'; END IF;

  -- Sum price differences
  FOR v_item IN SELECT * FROM nivelacija_items WHERE nivelacija_id = p_nivelacija_id
  LOOP
    v_total_diff := v_total_diff + v_item.price_difference;
  END LOOP;

  IF v_total_diff = 0 THEN RAISE EXCEPTION 'No price difference to post'; END IF;

  SELECT check_fiscal_period_open(v_nivelacija.tenant_id, v_nivelacija.nivelacija_date::text) INTO v_fiscal_period_id;

  v_entry_number := 'NIV-' || upper(to_hex(extract(epoch from now())::bigint));

  INSERT INTO journal_entries (tenant_id, entry_number, entry_date, description, reference, status, fiscal_period_id, posted_at, posted_by, created_by)
  VALUES (v_nivelacija.tenant_id, v_entry_number, v_nivelacija.nivelacija_date, 'Nivelacija ' || v_nivelacija.nivelacija_number, v_nivelacija.nivelacija_number, 'posted', v_fiscal_period_id, now(), v_nivelacija.created_by, v_nivelacija.created_by)
  RETURNING id INTO v_journal_id;

  IF v_total_diff > 0 THEN
    -- Price increase: D 1320, C 1329
    INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
    VALUES (v_journal_id, (SELECT id FROM chart_of_accounts WHERE tenant_id = v_nivelacija.tenant_id AND code = '1320' AND is_active LIMIT 1), v_total_diff, 0, 'Povećanje maloprodajne cene', 0);
    INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
    VALUES (v_journal_id, (SELECT id FROM chart_of_accounts WHERE tenant_id = v_nivelacija.tenant_id AND code = '1329' AND is_active LIMIT 1), 0, v_total_diff, 'Povećanje razlike u ceni', 1);
  ELSE
    -- Price decrease: D 1329, C 1320
    INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
    VALUES (v_journal_id, (SELECT id FROM chart_of_accounts WHERE tenant_id = v_nivelacija.tenant_id AND code = '1329' AND is_active LIMIT 1), abs(v_total_diff), 0, 'Smanjenje razlike u ceni', 0);
    INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
    VALUES (v_journal_id, (SELECT id FROM chart_of_accounts WHERE tenant_id = v_nivelacija.tenant_id AND code = '1320' AND is_active LIMIT 1), 0, abs(v_total_diff), 'Smanjenje maloprodajne cene', 1);
  END IF;

  UPDATE nivelacije SET status = 'posted', journal_entry_id = v_journal_id WHERE id = p_nivelacija_id;

  RETURN v_journal_id;
END;
$$;
