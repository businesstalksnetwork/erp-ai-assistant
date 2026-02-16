
-- =============================================
-- Phase 2: Harden check_fiscal_period_open and perform_year_end_closing
-- =============================================

-- 1. Add assert_tenant_member to check_fiscal_period_open
CREATE OR REPLACE FUNCTION public.check_fiscal_period_open(p_tenant_id uuid, p_entry_date date)
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_period RECORD;
  v_pdv_period RECORD;
BEGIN
  -- Enforce tenant membership
  PERFORM public.assert_tenant_member(p_tenant_id);

  -- Check fiscal period
  SELECT * INTO v_period FROM public.fiscal_periods
  WHERE tenant_id = p_tenant_id
    AND p_entry_date >= start_date::date
    AND p_entry_date <= end_date::date
  LIMIT 1;

  IF v_period IS NOT NULL AND v_period.status IN ('closed', 'locked') THEN
    RAISE EXCEPTION 'Cannot post to closed/locked fiscal period: %', v_period.name;
  END IF;

  -- Also check PDV period: if submitted or closed, block posting
  SELECT * INTO v_pdv_period FROM public.pdv_periods
  WHERE tenant_id = p_tenant_id
    AND p_entry_date >= start_date::date
    AND p_entry_date <= end_date::date
    AND status IN ('submitted', 'closed')
  LIMIT 1;

  IF v_pdv_period IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot post to a submitted/closed PDV period: %', v_pdv_period.period_name;
  END IF;

  RETURN v_period.id;
END;
$$;

-- 2. Harden perform_year_end_closing: add assert_tenant_member, use auth.uid() internally
CREATE OR REPLACE FUNCTION public.perform_year_end_closing(
  p_tenant_id UUID,
  p_fiscal_period_id UUID,
  p_user_id UUID  -- kept for backward compatibility, ignored internally
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_period RECORD;
  v_entry_id UUID;
  v_entry_number TEXT;
  v_retained_earnings_id UUID;
  v_revenue_total NUMERIC := 0;
  v_expense_total NUMERIC := 0;
  v_net_income NUMERIC;
  v_line_order INT := 0;
  v_account RECORD;
  v_uid UUID;
BEGIN
  -- Enforce tenant membership
  PERFORM public.assert_tenant_member(p_tenant_id);

  -- Use auth.uid() instead of p_user_id
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Unauthorized: no authenticated user'; END IF;

  -- Get fiscal period
  SELECT * INTO v_period FROM public.fiscal_periods WHERE id = p_fiscal_period_id AND tenant_id = p_tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fiscal period not found'; END IF;
  IF v_period.status = 'locked' THEN RAISE EXCEPTION 'Period already locked (year-end already performed)'; END IF;

  -- Find retained earnings account (3000 Equity/Kapital)
  SELECT id INTO v_retained_earnings_id FROM public.chart_of_accounts
  WHERE tenant_id = p_tenant_id AND code = '3000' AND is_active = true LIMIT 1;
  IF v_retained_earnings_id IS NULL THEN RAISE EXCEPTION 'Retained earnings account (3000) not found'; END IF;

  -- Generate closing entry number
  v_entry_number := 'CLOSE-' || v_period.name || '-' || to_char(now(), 'YYYYMMDD');

  -- Create closing journal entry (using auth.uid() for created_by/posted_by)
  INSERT INTO public.journal_entries (
    tenant_id, entry_number, entry_date, description, reference, status, source,
    created_by, posted_at, posted_by
  ) VALUES (
    p_tenant_id, v_entry_number, v_period.end_date::date,
    'Year-end closing entry for ' || v_period.name,
    'YEAR-END-' || v_period.name, 'posted', 'auto_closing',
    v_uid, now(), v_uid
  ) RETURNING id INTO v_entry_id;

  -- Close revenue accounts
  FOR v_account IN
    SELECT coa.id, coa.code, coa.name,
      COALESCE(SUM(jl.credit), 0) - COALESCE(SUM(jl.debit), 0) AS balance
    FROM public.chart_of_accounts coa
    LEFT JOIN public.journal_lines jl ON jl.account_id = coa.id
    LEFT JOIN public.journal_entries je ON je.id = jl.journal_entry_id
      AND je.tenant_id = p_tenant_id
      AND je.status = 'posted'
      AND je.entry_date >= v_period.start_date::date
      AND je.entry_date <= v_period.end_date::date
    WHERE coa.tenant_id = p_tenant_id
      AND coa.account_type = 'revenue'
      AND coa.is_active = true
    GROUP BY coa.id, coa.code, coa.name
    HAVING COALESCE(SUM(jl.credit), 0) - COALESCE(SUM(jl.debit), 0) <> 0
  LOOP
    v_line_order := v_line_order + 1;
    INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
    VALUES (v_entry_id, v_account.id, v_account.balance, 0, 'Close ' || v_account.code || ' ' || v_account.name, v_line_order);
    v_revenue_total := v_revenue_total + v_account.balance;
  END LOOP;

  -- Close expense accounts
  FOR v_account IN
    SELECT coa.id, coa.code, coa.name,
      COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0) AS balance
    FROM public.chart_of_accounts coa
    LEFT JOIN public.journal_lines jl ON jl.account_id = coa.id
    LEFT JOIN public.journal_entries je ON je.id = jl.journal_entry_id
      AND je.tenant_id = p_tenant_id
      AND je.status = 'posted'
      AND je.entry_date >= v_period.start_date::date
      AND je.entry_date <= v_period.end_date::date
    WHERE coa.tenant_id = p_tenant_id
      AND coa.account_type = 'expense'
      AND coa.is_active = true
    GROUP BY coa.id, coa.code, coa.name
    HAVING COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0) <> 0
  LOOP
    v_line_order := v_line_order + 1;
    INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
    VALUES (v_entry_id, v_account.id, 0, v_account.balance, 'Close ' || v_account.code || ' ' || v_account.name, v_line_order);
    v_expense_total := v_expense_total + v_account.balance;
  END LOOP;

  -- Net income = revenue - expense
  v_net_income := v_revenue_total - v_expense_total;

  -- Post to retained earnings
  v_line_order := v_line_order + 1;
  IF v_net_income >= 0 THEN
    INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
    VALUES (v_entry_id, v_retained_earnings_id, 0, v_net_income, 'Net income to retained earnings', v_line_order);
  ELSE
    INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
    VALUES (v_entry_id, v_retained_earnings_id, ABS(v_net_income), 0, 'Net loss to retained earnings', v_line_order);
  END IF;

  -- Lock the fiscal period
  UPDATE public.fiscal_periods SET status = 'locked', updated_at = now() WHERE id = p_fiscal_period_id;

  RETURN v_entry_id;
END;
$$;
