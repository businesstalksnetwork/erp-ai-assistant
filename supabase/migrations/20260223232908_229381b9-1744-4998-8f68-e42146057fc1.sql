
-- Item 22: Generate Opening Balance Journal Entry RPC
CREATE OR REPLACE FUNCTION public.generate_opening_balance(
  p_tenant_id uuid,
  p_fiscal_year int DEFAULT NULL,
  p_legal_entity_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_year int;
  v_prev_end date;
  v_new_start date;
  v_je_id uuid;
  v_fp_id uuid;
  v_entry_number text;
  v_retained_earnings_acct uuid;
  v_net_income numeric := 0;
  rec RECORD;
BEGIN
  PERFORM public.assert_tenant_member(p_tenant_id);

  v_year := COALESCE(p_fiscal_year, EXTRACT(YEAR FROM CURRENT_DATE)::int);
  v_prev_end := make_date(v_year - 1, 12, 31);
  v_new_start := make_date(v_year, 1, 1);

  -- Check if opening balance already exists for this year
  PERFORM 1 FROM journal_entries
    WHERE tenant_id = p_tenant_id AND source = 'opening_balance'
    AND entry_date = v_new_start;
  IF FOUND THEN
    RAISE EXCEPTION 'Opening balance for year % already exists', v_year;
  END IF;

  -- Find or create fiscal period
  v_fp_id := check_fiscal_period_open(p_tenant_id, v_new_start::text);

  -- Resolve retained earnings account (Class 340)
  SELECT id INTO v_retained_earnings_acct
    FROM chart_of_accounts
    WHERE tenant_id = p_tenant_id AND code = '3400' AND is_active
    LIMIT 1;
  IF v_retained_earnings_acct IS NULL THEN
    SELECT id INTO v_retained_earnings_acct
      FROM chart_of_accounts
      WHERE tenant_id = p_tenant_id AND code LIKE '340%' AND is_active
      LIMIT 1;
  END IF;

  v_entry_number := 'OB-' || v_year;

  -- Create the opening balance journal entry
  INSERT INTO journal_entries (
    tenant_id, entry_number, entry_date, description, reference,
    status, posted_at, posted_by, created_by, fiscal_period_id,
    source, legal_entity_id
  )
  VALUES (
    p_tenant_id, v_entry_number, v_new_start,
    'Početno stanje / Opening balance ' || v_year,
    v_entry_number, 'posted', now(), auth.uid(), auth.uid(),
    v_fp_id, 'opening_balance', p_legal_entity_id
  )
  RETURNING id INTO v_je_id;

  -- Insert balance sheet account balances (Classes 0-4)
  -- These carry forward their closing balances
  FOR rec IN
    SELECT
      jl.account_id,
      ca.code,
      ca.account_class,
      SUM(jl.debit) - SUM(jl.credit) AS net_balance
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.journal_entry_id
    JOIN chart_of_accounts ca ON ca.id = jl.account_id
    WHERE je.tenant_id = p_tenant_id
      AND je.status = 'posted'
      AND je.entry_date <= v_prev_end
      AND ca.account_class IN ('0', '1', '2', '3', '4')
      AND (p_legal_entity_id IS NULL OR je.legal_entity_id = p_legal_entity_id)
    GROUP BY jl.account_id, ca.code, ca.account_class
    HAVING ABS(SUM(jl.debit) - SUM(jl.credit)) > 0.005
    ORDER BY ca.code
  LOOP
    IF rec.net_balance > 0 THEN
      INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
      VALUES (v_je_id, rec.account_id, rec.net_balance, 0, 'OB ' || rec.code, 
              (rec.code::numeric)::int);
    ELSE
      INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
      VALUES (v_je_id, rec.account_id, 0, ABS(rec.net_balance), 'OB ' || rec.code,
              (rec.code::numeric)::int);
    END IF;
  END LOOP;

  -- Calculate net income from Classes 5-8 (income/expense)
  SELECT COALESCE(SUM(
    CASE WHEN ca.account_class IN ('6') THEN jl.credit - jl.debit
         WHEN ca.account_class IN ('5', '7', '8') THEN -(jl.debit - jl.credit)
         ELSE 0 END
  ), 0) INTO v_net_income
  FROM journal_lines jl
  JOIN journal_entries je ON je.id = jl.journal_entry_id
  JOIN chart_of_accounts ca ON ca.id = jl.account_id
  WHERE je.tenant_id = p_tenant_id
    AND je.status = 'posted'
    AND je.entry_date <= v_prev_end
    AND ca.account_class IN ('5', '6', '7', '8')
    AND (p_legal_entity_id IS NULL OR je.legal_entity_id = p_legal_entity_id);

  -- Post net income to retained earnings (Class 3400)
  IF v_retained_earnings_acct IS NOT NULL AND ABS(v_net_income) > 0.005 THEN
    IF v_net_income > 0 THEN
      INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
      VALUES (v_je_id, v_retained_earnings_acct, 0, v_net_income, 
              'Neraspoređeni dobitak prethodne godine', 99999);
    ELSE
      INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
      VALUES (v_je_id, v_retained_earnings_acct, ABS(v_net_income), 0,
              'Neraspoređeni gubitak prethodne godine', 99999);
    END IF;
  END IF;

  RETURN v_je_id;
END;
$function$;
