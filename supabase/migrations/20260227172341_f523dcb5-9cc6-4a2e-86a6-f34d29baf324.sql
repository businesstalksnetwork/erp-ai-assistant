
-- =============================================
-- PRD v1.1: Per-Location Kalkulacija/Nivelacija
-- Fix broken RPCs + add location/legal_entity columns
-- =============================================

-- 1. Add location_id and legal_entity_id to kalkulacije
ALTER TABLE public.kalkulacije ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.locations(id);
ALTER TABLE public.kalkulacije ADD COLUMN IF NOT EXISTS legal_entity_id uuid REFERENCES public.legal_entities(id);
CREATE INDEX IF NOT EXISTS idx_kalkulacije_location_id ON public.kalkulacije(location_id);

-- 2. Add location_id and legal_entity_id to nivelacije
ALTER TABLE public.nivelacije ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.locations(id);
ALTER TABLE public.nivelacije ADD COLUMN IF NOT EXISTS legal_entity_id uuid REFERENCES public.legal_entities(id);
CREATE INDEX IF NOT EXISTS idx_nivelacije_location_id ON public.nivelacije(location_id);

-- 3. Add pdv_rate to nivelacija_items for embedded VAT split
ALTER TABLE public.nivelacija_items ADD COLUMN IF NOT EXISTS pdv_rate numeric NOT NULL DEFAULT 20;

-- 4. Unique active retail price list per location
CREATE UNIQUE INDEX IF NOT EXISTS idx_retail_price_lists_location_active
  ON public.retail_price_lists(tenant_id, location_id)
  WHERE is_active = true AND location_id IS NOT NULL;

-- =============================================
-- 5. Fix post_kalkulacija RPC
-- Merges correct table names (kalkulacija_items, journal_lines, account_id)
-- with embedded VAT logic (account 1340) and per-location GL
-- =============================================
CREATE OR REPLACE FUNCTION public.post_kalkulacija(p_kalkulacija_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kal RECORD;
  v_item RECORD;
  v_total_cost numeric := 0;
  v_total_retail numeric := 0;
  v_total_markup numeric := 0;
  v_total_embedded_vat numeric := 0;
  v_journal_id uuid;
  v_entry_number text;
  v_fiscal_period_id uuid;
  v_loc_code text := '';
  v_acct_1320 uuid;
  v_acct_1329 uuid;
  v_acct_1300 uuid;
  v_acct_1340 uuid;
BEGIN
  -- Get kalkulacija
  SELECT * INTO v_kal FROM kalkulacije WHERE id = p_kalkulacija_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Kalkulacija not found'; END IF;
  IF v_kal.status = 'posted' THEN RAISE EXCEPTION 'Already posted'; END IF;

  -- Get location code for GL sub-accounts (optional)
  IF v_kal.location_id IS NOT NULL THEN
    SELECT COALESCE(l.name, '') INTO v_loc_code FROM locations l WHERE l.id = v_kal.location_id;
  END IF;

  -- Sum items with embedded VAT
  FOR v_item IN SELECT * FROM kalkulacija_items WHERE kalkulacija_id = p_kalkulacija_id
  LOOP
    v_total_cost := v_total_cost + (v_item.purchase_price * v_item.quantity);
    v_total_retail := v_total_retail + (v_item.retail_price * v_item.quantity);
    v_total_embedded_vat := v_total_embedded_vat +
      (v_item.retail_price * v_item.quantity * COALESCE(v_item.pdv_rate, 20) / (100 + COALESCE(v_item.pdv_rate, 20)));
  END LOOP;

  v_total_markup := v_total_retail - v_total_embedded_vat - v_total_cost;

  IF v_total_retail <= 0 THEN RAISE EXCEPTION 'No items to post'; END IF;

  -- Check fiscal period
  SELECT check_fiscal_period_open(v_kal.tenant_id, v_kal.kalkulacija_date::text) INTO v_fiscal_period_id;

  -- Resolve GL accounts
  SELECT id INTO v_acct_1320 FROM chart_of_accounts WHERE tenant_id = v_kal.tenant_id AND code = '1320' AND is_active LIMIT 1;
  SELECT id INTO v_acct_1329 FROM chart_of_accounts WHERE tenant_id = v_kal.tenant_id AND code = '1329' AND is_active LIMIT 1;
  SELECT id INTO v_acct_1300 FROM chart_of_accounts WHERE tenant_id = v_kal.tenant_id AND code = '1300' AND is_active LIMIT 1;
  SELECT id INTO v_acct_1340 FROM chart_of_accounts WHERE tenant_id = v_kal.tenant_id AND code = '1340' AND is_active LIMIT 1;

  -- Generate entry number
  v_entry_number := 'KLK-' || upper(to_hex(extract(epoch from now())::bigint));

  -- Create journal entry
  INSERT INTO journal_entries (
    tenant_id, legal_entity_id, entry_number, entry_date, description, reference,
    status, fiscal_period_id, posted_at, posted_by, created_by
  ) VALUES (
    v_kal.tenant_id, v_kal.legal_entity_id, v_entry_number, v_kal.kalkulacija_date,
    'Kalkulacija ' || v_kal.kalkulacija_number || CASE WHEN v_loc_code != '' THEN ' [' || v_loc_code || ']' ELSE '' END,
    v_kal.kalkulacija_number, 'posted', v_fiscal_period_id, now(), v_kal.created_by, v_kal.created_by
  ) RETURNING id INTO v_journal_id;

  -- D: 1320 Roba u maloprodaji (total retail incl. VAT)
  INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
  VALUES (v_journal_id, v_acct_1320, v_total_retail, 0, 'Roba u maloprodaji', 0);

  -- C: 1300 Roba - nabavna vrednost
  INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
  VALUES (v_journal_id, v_acct_1300, 0, v_total_cost, 'Nabavna vrednost robe', 1);

  -- C: 1329 Razlika u ceni (margin, excl VAT)
  INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
  VALUES (v_journal_id, v_acct_1329, 0, v_total_markup, 'Razlika u ceni robe', 2);

  -- C: 1340 Ukalkulisani PDV u prometu na malo (embedded VAT)
  IF v_acct_1340 IS NOT NULL AND v_total_embedded_vat > 0 THEN
    INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
    VALUES (v_journal_id, v_acct_1340, 0, v_total_embedded_vat, 'Ukalkulisani PDV u prometu na malo', 3);
  END IF;

  -- Update kalkulacija status
  UPDATE kalkulacije SET status = 'posted', journal_entry_id = v_journal_id, updated_at = now()
  WHERE id = p_kalkulacija_id;

  RETURN v_journal_id;
END;
$$;

-- =============================================
-- 6. Fix post_nivelacija RPC
-- Correct table names + embedded VAT split + location-scoped GL
-- =============================================
CREATE OR REPLACE FUNCTION public.post_nivelacija(p_nivelacija_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_niv RECORD;
  v_item RECORD;
  v_total_diff numeric := 0;
  v_total_vat_diff numeric := 0;
  v_total_margin_diff numeric := 0;
  v_journal_id uuid;
  v_entry_number text;
  v_fiscal_period_id uuid;
  v_loc_code text := '';
  v_acct_1320 uuid;
  v_acct_1329 uuid;
  v_acct_1340 uuid;
BEGIN
  SELECT * INTO v_niv FROM nivelacije WHERE id = p_nivelacija_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nivelacija not found'; END IF;
  IF v_niv.status = 'posted' THEN RAISE EXCEPTION 'Already posted'; END IF;

  -- Get location code
  IF v_niv.location_id IS NOT NULL THEN
    SELECT COALESCE(l.name, '') INTO v_loc_code FROM locations l WHERE l.id = v_niv.location_id;
  END IF;

  -- Sum price differences with embedded VAT split
  FOR v_item IN SELECT * FROM nivelacija_items WHERE nivelacija_id = p_nivelacija_id
  LOOP
    v_total_diff := v_total_diff + v_item.price_difference;
    v_total_vat_diff := v_total_vat_diff +
      (v_item.price_difference * COALESCE(v_item.pdv_rate, 20) / (100 + COALESCE(v_item.pdv_rate, 20)));
  END LOOP;

  v_total_margin_diff := v_total_diff - v_total_vat_diff;

  IF v_total_diff = 0 THEN RAISE EXCEPTION 'No price difference to post'; END IF;

  SELECT check_fiscal_period_open(v_niv.tenant_id, v_niv.nivelacija_date::text) INTO v_fiscal_period_id;

  -- Resolve GL accounts
  SELECT id INTO v_acct_1320 FROM chart_of_accounts WHERE tenant_id = v_niv.tenant_id AND code = '1320' AND is_active LIMIT 1;
  SELECT id INTO v_acct_1329 FROM chart_of_accounts WHERE tenant_id = v_niv.tenant_id AND code = '1329' AND is_active LIMIT 1;
  SELECT id INTO v_acct_1340 FROM chart_of_accounts WHERE tenant_id = v_niv.tenant_id AND code = '1340' AND is_active LIMIT 1;

  v_entry_number := 'NIV-' || upper(to_hex(extract(epoch from now())::bigint));

  INSERT INTO journal_entries (
    tenant_id, legal_entity_id, entry_number, entry_date, description, reference,
    status, fiscal_period_id, posted_at, posted_by, created_by
  ) VALUES (
    v_niv.tenant_id, v_niv.legal_entity_id, v_entry_number, v_niv.nivelacija_date,
    'Nivelacija ' || v_niv.nivelacija_number || CASE WHEN v_loc_code != '' THEN ' [' || v_loc_code || ']' ELSE '' END,
    v_niv.nivelacija_number, 'posted', v_fiscal_period_id, now(), v_niv.created_by, v_niv.created_by
  ) RETURNING id INTO v_journal_id;

  IF v_total_diff > 0 THEN
    -- Price increase
    INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
    VALUES (v_journal_id, v_acct_1320, v_total_diff, 0, 'Povećanje maloprodajne cene', 0);
    INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
    VALUES (v_journal_id, v_acct_1329, 0, v_total_margin_diff, 'Povećanje razlike u ceni', 1);
    IF v_acct_1340 IS NOT NULL AND v_total_vat_diff > 0 THEN
      INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
      VALUES (v_journal_id, v_acct_1340, 0, v_total_vat_diff, 'Povećanje ukalkulisanog PDV', 2);
    END IF;
  ELSE
    -- Price decrease
    INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
    VALUES (v_journal_id, v_acct_1329, ABS(v_total_margin_diff), 0, 'Smanjenje razlike u ceni', 0);
    IF v_acct_1340 IS NOT NULL AND v_total_vat_diff != 0 THEN
      INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
      VALUES (v_journal_id, v_acct_1340, ABS(v_total_vat_diff), 0, 'Smanjenje ukalkulisanog PDV', 1);
    END IF;
    INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
    VALUES (v_journal_id, v_acct_1320, 0, ABS(v_total_diff), 'Smanjenje maloprodajne cene', 2);
  END IF;

  UPDATE nivelacije SET status = 'posted', journal_entry_id = v_journal_id, updated_at = now()
  WHERE id = p_nivelacija_id;

  RETURN v_journal_id;
END;
$$;
