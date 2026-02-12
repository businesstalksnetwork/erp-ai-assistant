
-- =============================================================
-- Phase 22: Accounting Kernel Hardening
-- =============================================================

-- 1. Add source column to journal_entries for auto-generated tracking
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';
-- source values: 'manual', 'auto_invoice', 'auto_depreciation', 'auto_deferral', 'auto_bank', 'auto_storno', 'auto_closing'

-- 2. Add legal_entity_id to core accounting tables
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS legal_entity_id UUID REFERENCES public.legal_entities(id);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS legal_entity_id UUID REFERENCES public.legal_entities(id);
ALTER TABLE public.supplier_invoices ADD COLUMN IF NOT EXISTS legal_entity_id UUID REFERENCES public.legal_entities(id);
ALTER TABLE public.pdv_periods ADD COLUMN IF NOT EXISTS legal_entity_id UUID REFERENCES public.legal_entities(id);

-- Create indexes for legal_entity_id lookups
CREATE INDEX IF NOT EXISTS idx_journal_entries_legal_entity ON public.journal_entries(legal_entity_id);
CREATE INDEX IF NOT EXISTS idx_invoices_legal_entity ON public.invoices(legal_entity_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_legal_entity ON public.supplier_invoices(legal_entity_id);
CREATE INDEX IF NOT EXISTS idx_pdv_periods_legal_entity ON public.pdv_periods(legal_entity_id);

-- 3. DB Trigger: Block UPDATE on posted journal entries (except storno transition)
CREATE OR REPLACE FUNCTION public.block_posted_journal_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('posted', 'reversed') THEN
      RAISE EXCEPTION 'Cannot delete posted or reversed journal entries. Use storno to reverse.';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Allow only: status change posted -> reversed + setting storno_by_id
    IF OLD.status = 'posted' THEN
      -- Check if this is a valid storno transition
      IF NEW.status = 'reversed' AND NEW.storno_by_id IS NOT NULL THEN
        -- Ensure nothing else changed (except updated_at)
        IF OLD.entry_number IS DISTINCT FROM NEW.entry_number
           OR OLD.entry_date IS DISTINCT FROM NEW.entry_date
           OR OLD.description IS DISTINCT FROM NEW.description
           OR OLD.reference IS DISTINCT FROM NEW.reference
           OR OLD.tenant_id IS DISTINCT FROM NEW.tenant_id
           OR OLD.created_by IS DISTINCT FROM NEW.created_by
        THEN
          RAISE EXCEPTION 'Cannot modify fields on a posted journal entry. Only storno reversal is allowed.';
        END IF;
        RETURN NEW;
      ELSE
        RAISE EXCEPTION 'Posted journal entries are immutable. Only storno reversal (status -> reversed) is allowed.';
      END IF;
    END IF;

    -- Block updates on reversed entries entirely
    IF OLD.status = 'reversed' THEN
      RAISE EXCEPTION 'Reversed journal entries are immutable.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_block_posted_journal_mutation
BEFORE UPDATE OR DELETE ON public.journal_entries
FOR EACH ROW
EXECUTE FUNCTION public.block_posted_journal_mutation();

-- 4. DB Trigger: Block modifications to journal_lines of posted/reversed entries
CREATE OR REPLACE FUNCTION public.block_posted_journal_lines_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_status TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT status INTO v_status FROM public.journal_entries WHERE id = NEW.journal_entry_id;
    -- Allow inserting lines for draft or new entries being posted
    IF v_status IN ('posted', 'reversed') THEN
      -- Check if the entry was JUST created (allow lines for newly posted auto-entries)
      -- This is needed because auto-entries are created as 'posted' directly
      IF EXISTS (SELECT 1 FROM public.journal_lines WHERE journal_entry_id = NEW.journal_entry_id LIMIT 1) THEN
        -- Lines already exist for this posted entry; block additional inserts unless it's a brand new entry
        NULL; -- Allow: some auto-entries insert header then lines in sequence
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
    SELECT status INTO v_status FROM public.journal_entries
    WHERE id = COALESCE(
      CASE WHEN TG_OP = 'DELETE' THEN OLD.journal_entry_id ELSE NEW.journal_entry_id END,
      OLD.journal_entry_id
    );
    IF v_status IN ('posted', 'reversed') THEN
      RAISE EXCEPTION 'Cannot modify lines of a posted or reversed journal entry.';
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_block_posted_journal_lines_mutation
BEFORE UPDATE OR DELETE ON public.journal_lines
FOR EACH ROW
EXECUTE FUNCTION public.block_posted_journal_lines_mutation();

-- 5. Enhanced check_fiscal_period_open: also check PDV period status
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

-- 6. Year-end closing function
CREATE OR REPLACE FUNCTION public.perform_year_end_closing(
  p_tenant_id UUID,
  p_fiscal_period_id UUID,
  p_user_id UUID
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
BEGIN
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

  -- Create closing journal entry
  INSERT INTO public.journal_entries (
    tenant_id, entry_number, entry_date, description, reference, status, source,
    created_by, posted_at, posted_by
  ) VALUES (
    p_tenant_id, v_entry_number, v_period.end_date::date,
    'Year-end closing entry for ' || v_period.name,
    'YEAR-END-' || v_period.name, 'posted', 'auto_closing',
    p_user_id, now(), p_user_id
  ) RETURNING id INTO v_entry_id;

  -- Close revenue accounts (class 4xxx and 6xxx): debit revenue, credit retained earnings
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
    -- Debit the revenue account to zero it out
    INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
    VALUES (v_entry_id, v_account.id, v_account.balance, 0, 'Close ' || v_account.code || ' ' || v_account.name, v_line_order);
    v_revenue_total := v_revenue_total + v_account.balance;
  END LOOP;

  -- Close expense accounts (class 5xxx, 7xxx, 8xxx): credit expense, debit retained earnings
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
    -- Credit the expense account to zero it out
    INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
    VALUES (v_entry_id, v_account.id, 0, v_account.balance, 'Close ' || v_account.code || ' ' || v_account.name, v_line_order);
    v_expense_total := v_expense_total + v_account.balance;
  END LOOP;

  -- Net income = revenue - expense
  v_net_income := v_revenue_total - v_expense_total;

  -- Post to retained earnings
  v_line_order := v_line_order + 1;
  IF v_net_income >= 0 THEN
    -- Profit: credit retained earnings
    INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
    VALUES (v_entry_id, v_retained_earnings_id, 0, v_net_income, 'Net income to retained earnings', v_line_order);
  ELSE
    -- Loss: debit retained earnings
    INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
    VALUES (v_entry_id, v_retained_earnings_id, ABS(v_net_income), 0, 'Net loss to retained earnings', v_line_order);
  END IF;

  -- Lock the fiscal period
  UPDATE public.fiscal_periods SET status = 'locked', updated_at = now() WHERE id = p_fiscal_period_id;

  RETURN v_entry_id;
END;
$$;

-- 7. Update existing auto-generated journal entries to set source
UPDATE public.journal_entries SET source = 'auto_storno' WHERE is_storno = true;
UPDATE public.journal_entries SET source = 'auto_invoice'
WHERE id IN (SELECT journal_entry_id FROM public.invoices WHERE journal_entry_id IS NOT NULL);
