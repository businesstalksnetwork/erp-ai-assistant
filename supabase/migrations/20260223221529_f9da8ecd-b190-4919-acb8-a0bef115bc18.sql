
-- =============================================================
-- Phase 3: POPDV Validation + Bank Reconciliation
-- =============================================================

-- A5. POPDV Validation RPC
CREATE OR REPLACE FUNCTION public.validate_popdv_completeness(p_tenant_id uuid, p_pdv_period_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_period RECORD;
  v_issues jsonb := '[]'::jsonb;
  v_count int;
BEGIN
  PERFORM public.assert_tenant_member(p_tenant_id);

  SELECT * INTO v_period FROM pdv_periods WHERE id = p_pdv_period_id AND tenant_id = p_tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'PDV period not found'; END IF;

  -- Check for unposted invoices in period
  SELECT COUNT(*) INTO v_count FROM invoices
    WHERE tenant_id = p_tenant_id AND status = 'draft'
    AND invoice_date >= v_period.start_date AND invoice_date <= v_period.end_date;
  IF v_count > 0 THEN
    v_issues := v_issues || jsonb_build_object('type', 'unposted_invoices', 'count', v_count, 'severity', 'error',
      'message', v_count || ' draft invoices found in period');
  END IF;

  -- Check for unposted supplier invoices
  SELECT COUNT(*) INTO v_count FROM supplier_invoices
    WHERE tenant_id = p_tenant_id AND status = 'draft'
    AND invoice_date >= v_period.start_date AND invoice_date <= v_period.end_date;
  IF v_count > 0 THEN
    v_issues := v_issues || jsonb_build_object('type', 'unposted_supplier_invoices', 'count', v_count, 'severity', 'error',
      'message', v_count || ' draft supplier invoices found in period');
  END IF;

  -- Check for unreconciled bank statements
  SELECT COUNT(*) INTO v_count FROM bank_statements
    WHERE tenant_id = p_tenant_id AND status != 'reconciled'
    AND statement_date >= v_period.start_date AND statement_date <= v_period.end_date;
  IF v_count > 0 THEN
    v_issues := v_issues || jsonb_build_object('type', 'unreconciled_statements', 'count', v_count, 'severity', 'warning',
      'message', v_count || ' unreconciled bank statements in period');
  END IF;

  RETURN jsonb_build_object(
    'period_id', p_pdv_period_id,
    'period_name', v_period.period_name,
    'is_valid', jsonb_array_length(v_issues) = 0 OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_issues) e WHERE e->>'severity' = 'error'),
    'issues', v_issues
  );
END;
$fn$;

-- A7. Bank Reconciliation tables
CREATE TABLE IF NOT EXISTS public.bank_reconciliations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  bank_account_id uuid NOT NULL REFERENCES public.bank_accounts(id),
  statement_id uuid REFERENCES public.bank_statements(id),
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'cancelled')),
  opening_balance numeric NOT NULL DEFAULT 0,
  closing_balance numeric NOT NULL DEFAULT 0,
  reconciled_at timestamptz,
  reconciled_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_reconciliations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can manage bank_reconciliations"
  ON public.bank_reconciliations FOR ALL
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE TABLE IF NOT EXISTS public.bank_reconciliation_lines (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reconciliation_id uuid NOT NULL REFERENCES public.bank_reconciliations(id) ON DELETE CASCADE,
  statement_line_id uuid REFERENCES public.bank_statement_lines(id),
  journal_entry_id uuid REFERENCES public.journal_entries(id),
  match_type text NOT NULL DEFAULT 'manual' CHECK (match_type IN ('exact', 'fuzzy', 'ai', 'manual')),
  confidence numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_reconciliation_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can manage bank_reconciliation_lines"
  ON public.bank_reconciliation_lines FOR ALL
  USING (reconciliation_id IN (
    SELECT id FROM bank_reconciliations WHERE tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
  ));

-- =============================================================
-- Phase 4: Fixed Asset Depreciation + FX
-- =============================================================

-- A8. Run Monthly Depreciation RPC
CREATE OR REPLACE FUNCTION public.run_monthly_depreciation(p_tenant_id uuid, p_month int, p_year int)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_asset RECORD;
  v_je_id uuid;
  v_entry_number text;
  v_fp_id uuid;
  v_depr_acct_id uuid;
  v_accum_acct_id uuid;
  v_total_depr numeric := 0;
  v_monthly_depr numeric;
  v_depr_date date;
BEGIN
  PERFORM public.assert_tenant_member(p_tenant_id);

  v_depr_date := make_date(p_year, p_month, 28);
  v_fp_id := check_fiscal_period_open(p_tenant_id, v_depr_date::text);

  SELECT id INTO v_depr_acct_id FROM chart_of_accounts WHERE tenant_id = p_tenant_id AND code = '8100' AND is_active LIMIT 1;
  SELECT id INTO v_accum_acct_id FROM chart_of_accounts WHERE tenant_id = p_tenant_id AND code = '1290' AND is_active LIMIT 1;

  IF v_depr_acct_id IS NULL OR v_accum_acct_id IS NULL THEN
    RAISE EXCEPTION 'Missing accounts 8100/1290';
  END IF;

  v_entry_number := 'DEPR-' || p_year || '-' || lpad(p_month::text, 2, '0');

  INSERT INTO journal_entries (tenant_id, entry_number, entry_date, description, status, posted_at, posted_by, created_by, fiscal_period_id, source)
  VALUES (p_tenant_id, v_entry_number, v_depr_date, 'Monthly depreciation ' || p_month || '/' || p_year, 'posted', now(), auth.uid(), auth.uid(), v_fp_id, 'auto_depreciation')
  RETURNING id INTO v_je_id;

  FOR v_asset IN
    SELECT * FROM fixed_assets WHERE tenant_id = p_tenant_id AND status = 'active'
  LOOP
    v_monthly_depr := ROUND(
      CASE COALESCE(v_asset.depreciation_method, 'straight_line')
        WHEN 'straight_line' THEN v_asset.acquisition_cost / NULLIF(v_asset.useful_life_months, 0)
        WHEN 'declining_balance' THEN (v_asset.acquisition_cost - COALESCE(v_asset.accumulated_depreciation, 0)) * 2.0 / NULLIF(v_asset.useful_life_months, 0)
        ELSE v_asset.acquisition_cost / NULLIF(v_asset.useful_life_months, 0)
      END, 2
    );

    IF v_monthly_depr > 0 AND (COALESCE(v_asset.accumulated_depreciation, 0) + v_monthly_depr) <= v_asset.acquisition_cost THEN
      v_total_depr := v_total_depr + v_monthly_depr;

      UPDATE fixed_assets SET
        accumulated_depreciation = COALESCE(accumulated_depreciation, 0) + v_monthly_depr,
        net_book_value = acquisition_cost - COALESCE(accumulated_depreciation, 0) - v_monthly_depr
      WHERE id = v_asset.id;
    END IF;
  END LOOP;

  IF v_total_depr > 0 THEN
    INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order) VALUES
      (v_je_id, v_depr_acct_id, v_total_depr, 0, 'Depreciation expense ' || p_month || '/' || p_year, 0),
      (v_je_id, v_accum_acct_id, 0, v_total_depr, 'Accumulated depreciation', 1);
  ELSE
    -- Delete empty JE
    DELETE FROM journal_entries WHERE id = v_je_id;
    RETURN NULL;
  END IF;

  RETURN v_je_id;
END;
$fn$;

-- =============================================================
-- Phase 5: Proforma Invoices + 3-Way Match + Opening Balances
-- =============================================================

-- A11. Proforma Invoices
CREATE TABLE IF NOT EXISTS public.proforma_invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  proforma_number text NOT NULL,
  partner_id uuid REFERENCES public.partners(id),
  partner_name text,
  legal_entity_id uuid REFERENCES public.legal_entities(id),
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  valid_until date,
  subtotal numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'RSD',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'converted', 'expired', 'cancelled')),
  converted_invoice_id uuid REFERENCES public.invoices(id),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.proforma_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can manage proforma_invoices"
  ON public.proforma_invoices FOR ALL
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE TABLE IF NOT EXISTS public.proforma_invoice_lines (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proforma_id uuid NOT NULL REFERENCES public.proforma_invoices(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id),
  description text,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  tax_rate numeric NOT NULL DEFAULT 20,
  total numeric NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.proforma_invoice_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can manage proforma_invoice_lines"
  ON public.proforma_invoice_lines FOR ALL
  USING (proforma_id IN (
    SELECT id FROM proforma_invoices WHERE tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
  ));

-- A12. Three-Way Match RPC
CREATE OR REPLACE FUNCTION public.three_way_match(p_supplier_invoice_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_si RECORD;
  v_po RECORD;
  v_gr RECORD;
  v_tolerance numeric := 0.02; -- 2%
  v_po_total numeric;
  v_gr_qty numeric;
  v_result jsonb;
  v_match_status text;
BEGIN
  SELECT * INTO v_si FROM supplier_invoices WHERE id = p_supplier_invoice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Supplier invoice not found'; END IF;

  PERFORM public.assert_tenant_member(v_si.tenant_id);

  -- Find related PO
  IF v_si.purchase_order_id IS NOT NULL THEN
    SELECT * INTO v_po FROM purchase_orders WHERE id = v_si.purchase_order_id;
    v_po_total := COALESCE(v_po.total, 0);
  ELSE
    v_po_total := 0;
  END IF;

  -- Find related goods receipt
  IF v_si.purchase_order_id IS NOT NULL THEN
    SELECT COALESCE(SUM(grl.quantity_received), 0) INTO v_gr_qty
    FROM goods_receipt_lines grl
    JOIN goods_receipts gr ON gr.id = grl.goods_receipt_id
    WHERE gr.purchase_order_id = v_si.purchase_order_id AND gr.tenant_id = v_si.tenant_id;
  ELSE
    v_gr_qty := 0;
  END IF;

  -- Check match
  IF v_po_total = 0 THEN
    v_match_status := 'no_po';
  ELSIF ABS(v_si.total - v_po_total) / NULLIF(v_po_total, 0) <= v_tolerance THEN
    v_match_status := 'matched';
  ELSE
    v_match_status := 'discrepancy';
  END IF;

  v_result := jsonb_build_object(
    'supplier_invoice_id', p_supplier_invoice_id,
    'invoice_total', v_si.total,
    'po_total', v_po_total,
    'gr_quantity', v_gr_qty,
    'tolerance', v_tolerance,
    'variance_pct', CASE WHEN v_po_total > 0 THEN ROUND(ABS(v_si.total - v_po_total) / v_po_total * 100, 2) ELSE NULL END,
    'match_status', v_match_status
  );

  RETURN v_result;
END;
$fn$;

-- A13. Generate Opening Balances RPC
CREATE OR REPLACE FUNCTION public.generate_opening_balances(p_tenant_id uuid, p_fiscal_period_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_period RECORD;
  v_je_id uuid;
  v_entry_number text;
  v_new_fp_id uuid;
  v_next_year_start date;
  v_balance RECORD;
  v_sort int := 0;
  v_total_debit numeric := 0;
  v_total_credit numeric := 0;
BEGIN
  PERFORM public.assert_tenant_member(p_tenant_id);

  SELECT * INTO v_period FROM fiscal_periods WHERE id = p_fiscal_period_id AND tenant_id = p_tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fiscal period not found'; END IF;

  v_next_year_start := (v_period.end_date + interval '1 day')::date;

  -- Find or use next period
  SELECT id INTO v_new_fp_id FROM fiscal_periods
    WHERE tenant_id = p_tenant_id AND start_date = v_next_year_start LIMIT 1;

  v_entry_number := 'OPEN-' || extract(year from v_next_year_start)::text;

  INSERT INTO journal_entries (tenant_id, entry_number, entry_date, description, status, posted_at, posted_by, created_by, fiscal_period_id, source)
  VALUES (p_tenant_id, v_entry_number, v_next_year_start, 'Opening balances ' || extract(year from v_next_year_start)::text, 'posted', now(), auth.uid(), auth.uid(), v_new_fp_id, 'auto_opening')
  RETURNING id INTO v_je_id;

  -- Get balances for balance sheet accounts (Classes 0-4)
  FOR v_balance IN
    SELECT coa.id as account_id, coa.code, coa.name,
      COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0) as net_balance
    FROM chart_of_accounts coa
    LEFT JOIN journal_lines jl ON jl.account_id = coa.id
    LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id
      AND je.tenant_id = p_tenant_id AND je.status = 'posted'
      AND je.entry_date <= v_period.end_date
    WHERE coa.tenant_id = p_tenant_id AND coa.is_active = true
      AND coa.code < '5000' -- Only balance sheet accounts (Classes 0-4)
    GROUP BY coa.id, coa.code, coa.name
    HAVING ABS(COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0)) > 0.001
    ORDER BY coa.code
  LOOP
    IF v_balance.net_balance > 0 THEN
      INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
      VALUES (v_je_id, v_balance.account_id, v_balance.net_balance, 0, 'Opening: ' || v_balance.code || ' ' || v_balance.name, v_sort);
      v_total_debit := v_total_debit + v_balance.net_balance;
    ELSE
      INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
      VALUES (v_je_id, v_balance.account_id, 0, ABS(v_balance.net_balance), 'Opening: ' || v_balance.code || ' ' || v_balance.name, v_sort);
      v_total_credit := v_total_credit + ABS(v_balance.net_balance);
    END IF;
    v_sort := v_sort + 1;
  END LOOP;

  -- Balance with retained earnings if needed
  IF ABS(v_total_debit - v_total_credit) > 0.01 THEN
    DECLARE
      v_re_acct_id uuid;
      v_diff numeric;
    BEGIN
      SELECT id INTO v_re_acct_id FROM chart_of_accounts WHERE tenant_id = p_tenant_id AND code = '3300' AND is_active LIMIT 1;
      IF v_re_acct_id IS NOT NULL THEN
        v_diff := v_total_debit - v_total_credit;
        IF v_diff > 0 THEN
          INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
          VALUES (v_je_id, v_re_acct_id, 0, v_diff, 'Retained earnings - opening balance', v_sort);
        ELSE
          INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
          VALUES (v_je_id, v_re_acct_id, ABS(v_diff), 0, 'Retained earnings - opening balance', v_sort);
        END IF;
      END IF;
    END;
  END IF;

  RETURN v_je_id;
END;
$fn$;

-- Triggers for updated_at
CREATE TRIGGER update_bank_reconciliations_updated_at
  BEFORE UPDATE ON public.bank_reconciliations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_proforma_invoices_updated_at
  BEFORE UPDATE ON public.proforma_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
