-- ============================================================
-- Serbian Compliance Enhancements 2026
-- Comprehensive implementation of all compliance recommendations
-- ============================================================

-- =============================================
-- 1. ENHANCED AUDIT TRAIL
-- =============================================

-- Enhance audit_log table with additional fields for Serbian law compliance
ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS action_type TEXT, -- 'create', 'update', 'delete', 'post', 'reverse', 'submit', 'approve', etc.
  ADD COLUMN IF NOT EXISTS ip_address TEXT,
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  ADD COLUMN IF NOT EXISTS authorization_level TEXT, -- 'admin', 'accountant', 'manager', etc.
  ADD COLUMN IF NOT EXISTS reason TEXT, -- Reason/justification for critical actions
  ADD COLUMN IF NOT EXISTS old_values JSONB, -- Previous values for updates
  ADD COLUMN IF NOT EXISTS new_values JSONB; -- New values for updates

-- Create comprehensive audit logging function
CREATE OR REPLACE FUNCTION public.log_audit_action(
  p_tenant_id UUID,
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_action_type TEXT DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_details JSONB DEFAULT '{}'::jsonb,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_role TEXT;
  v_audit_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  -- Get user's role for this tenant
  SELECT role::TEXT INTO v_role
  FROM tenant_members
  WHERE tenant_id = p_tenant_id AND user_id = v_user_id AND status = 'active'
  LIMIT 1;
  
  INSERT INTO public.audit_log (
    tenant_id, user_id, action, entity_type, entity_id,
    action_type, authorization_level, reason, details,
    old_values, new_values, created_at
  ) VALUES (
    p_tenant_id, v_user_id, p_action, p_entity_type, p_entity_id,
    p_action_type, v_role, p_reason, p_details,
    p_old_values, p_new_values, now()
  ) RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$$;

-- =============================================
-- 2. STORNO REASON REQUIREMENT
-- =============================================

-- Add storno_reason column to journal_entries
ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS storno_reason TEXT,
  ADD COLUMN IF NOT EXISTS storno_authorized_by UUID REFERENCES auth.users(id);

-- Update storno function to require reason
CREATE OR REPLACE FUNCTION public.storno_journal_entry(
  p_journal_entry_id UUID,
  p_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_original RECORD;
  v_storno_id UUID;
  v_line RECORD;
  v_entry_number TEXT;
  v_fiscal_period_id UUID;
  i INT := 0;
BEGIN
  -- Validate reason is provided
  IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
    RAISE EXCEPTION 'Storno reason is required per Serbian accounting law';
  END IF;
  
  SELECT * INTO v_original FROM journal_entries WHERE id = p_journal_entry_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Journal entry not found'; END IF;
  IF v_original.status <> 'posted' THEN RAISE EXCEPTION 'Only posted entries can be reversed'; END IF;
  IF v_original.storno_by_id IS NOT NULL THEN RAISE EXCEPTION 'Entry already reversed'; END IF;

  PERFORM public.assert_tenant_member(v_original.tenant_id);

  v_entry_number := 'STORNO-' || v_original.entry_number;
  SELECT public.check_fiscal_period_open(v_original.tenant_id, CURRENT_DATE::text) INTO v_fiscal_period_id;

  INSERT INTO journal_entries (
    tenant_id, entry_number, entry_date, description, reference, status,
    posted_at, posted_by, created_by, storno_of_id, is_storno, source,
    fiscal_period_id, legal_entity_id, storno_reason, storno_authorized_by
  ) VALUES (
    v_original.tenant_id, v_entry_number, CURRENT_DATE,
    'Storno: ' || v_original.entry_number || ' — ' || COALESCE(v_original.description, ''),
    v_original.reference, 'posted', now(), auth.uid(), auth.uid(),
    p_journal_entry_id, true, 'auto_storno', v_fiscal_period_id,
    v_original.legal_entity_id, p_reason, auth.uid()
  ) RETURNING id INTO v_storno_id;

  FOR v_line IN SELECT * FROM journal_lines WHERE journal_entry_id = p_journal_entry_id ORDER BY sort_order
  LOOP
    INSERT INTO journal_lines (journal_entry_id, account_id, description, debit, credit, sort_order)
    VALUES (v_storno_id, v_line.account_id, 'Storno: ' || COALESCE(v_line.description, ''), v_line.credit, v_line.debit, i);
    i := i + 1;
  END LOOP;

  UPDATE journal_entries
  SET storno_by_id = v_storno_id, status = 'reversed', storno_reason = p_reason, storno_authorized_by = auth.uid()
  WHERE id = p_journal_entry_id;

  -- Log audit trail
  PERFORM public.log_audit_action(
    v_original.tenant_id,
    'storno_journal_entry',
    'journal_entry',
    p_journal_entry_id,
    'reverse',
    p_reason,
    jsonb_build_object('storno_entry_id', v_storno_id, 'original_entry_number', v_original.entry_number),
    NULL,
    jsonb_build_object('status', 'reversed', 'storno_entry_id', v_storno_id)
  );

  RETURN v_storno_id;
END;
$$;

-- =============================================
-- 3. PERIOD OVERLAP PREVENTION
-- =============================================

-- Function to check for overlapping fiscal periods
CREATE OR REPLACE FUNCTION public.assert_no_overlapping_fiscal_period(
  p_tenant_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_exclude_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_overlap RECORD;
BEGIN
  -- Validate date range
  IF p_start_date > p_end_date THEN
    RAISE EXCEPTION 'Start date must be before or equal to end date';
  END IF;
  
  -- Check for overlaps
  SELECT id, name, start_date, end_date INTO v_overlap
  FROM public.fiscal_periods
  WHERE tenant_id = p_tenant_id
    AND (p_exclude_id IS NULL OR id <> p_exclude_id)
    AND (
      (p_start_date BETWEEN start_date AND end_date) OR
      (p_end_date BETWEEN start_date AND end_date) OR
      (p_start_date <= start_date AND p_end_date >= end_date)
    )
  LIMIT 1;
  
  IF v_overlap IS NOT NULL THEN
    RAISE EXCEPTION 'Fiscal period overlaps with existing period: % (% to %)',
      v_overlap.name, v_overlap.start_date, v_overlap.end_date;
  END IF;
END;
$$;

-- Trigger function for fiscal periods
CREATE OR REPLACE FUNCTION public.check_fiscal_period_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.assert_no_overlapping_fiscal_period(
    NEW.tenant_id,
    NEW.start_date,
    NEW.end_date,
    NEW.id
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_fiscal_period_overlap
  BEFORE INSERT OR UPDATE ON public.fiscal_periods
  FOR EACH ROW
  EXECUTE FUNCTION public.check_fiscal_period_overlap();

-- Similar function for PDV periods
CREATE OR REPLACE FUNCTION public.assert_no_overlapping_pdv_period(
  p_tenant_id UUID,
  p_legal_entity_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_exclude_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_overlap RECORD;
BEGIN
  IF p_start_date > p_end_date THEN
    RAISE EXCEPTION 'Start date must be before or equal to end date';
  END IF;
  
  SELECT id, period_name, start_date, end_date INTO v_overlap
  FROM public.pdv_periods
  WHERE tenant_id = p_tenant_id
    AND (p_legal_entity_id IS NULL OR legal_entity_id = p_legal_entity_id)
    AND (p_exclude_id IS NULL OR id <> p_exclude_id)
    AND (
      (p_start_date BETWEEN start_date AND end_date) OR
      (p_end_date BETWEEN start_date AND end_date) OR
      (p_start_date <= start_date AND p_end_date >= end_date)
    )
  LIMIT 1;
  
  IF v_overlap IS NOT NULL THEN
    RAISE EXCEPTION 'PDV period overlaps with existing period: % (% to %)',
      v_overlap.period_name, v_overlap.start_date, v_overlap.end_date;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_pdv_period_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.assert_no_overlapping_pdv_period(
    NEW.tenant_id,
    NEW.legal_entity_id,
    NEW.start_date,
    NEW.end_date,
    NEW.id
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_pdv_period_overlap
  BEFORE INSERT OR UPDATE ON public.pdv_periods
  FOR EACH ROW
  EXECUTE FUNCTION public.check_pdv_period_overlap();

-- =============================================
-- 4. ACCOUNT CODE VALIDATION
-- =============================================

-- Function to validate Serbian account code format (4 digits)
CREATE OR REPLACE FUNCTION public.validate_serbian_account_code(p_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Must be exactly 4 digits
  IF p_code !~ '^[0-9]{4}$' THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$;

-- Function to validate account code matches account type per Serbian standards
CREATE OR REPLACE FUNCTION public.validate_account_code_type(
  p_code TEXT,
  p_account_type TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_first_digit CHAR(1);
BEGIN
  IF NOT public.validate_serbian_account_code(p_code) THEN
    RETURN FALSE;
  END IF;
  
  v_first_digit := SUBSTRING(p_code, 1, 1);
  
  -- Serbian account classification:
  -- 0: Dugotrajna imovina (Fixed Assets) - asset
  -- 1: Kratkotrajna imovina (Current Assets) - asset
  -- 2: Kratkoročne obaveze (Current Liabilities) - liability
  -- 3: Dugoročne obaveze (Long-term Liabilities) - liability
  -- 4: Kapital i rezerve (Equity) - equity
  -- 5: Prihodi (Revenue) - revenue
  -- 6: Rashodi (Expenses) - expense
  -- 7: Prihodi i rashodi po osnovu finansijskih ulaganja - revenue/expense
  -- 8: Vanbilančni računi - off-balance sheet
  
  CASE v_first_digit
    WHEN '0', '1' THEN
      RETURN p_account_type = 'asset';
    WHEN '2', '3' THEN
      RETURN p_account_type = 'liability';
    WHEN '4' THEN
      RETURN p_account_type = 'equity';
    WHEN '5' THEN
      RETURN p_account_type = 'revenue';
    WHEN '6' THEN
      RETURN p_account_type = 'expense';
    WHEN '7' THEN
      RETURN p_account_type IN ('revenue', 'expense');
    WHEN '8' THEN
      -- Off-balance sheet accounts can be any type
      RETURN TRUE;
    ELSE
      RETURN FALSE;
  END CASE;
END;
$$;

-- Add CHECK constraint for account code format
ALTER TABLE public.chart_of_accounts
  ADD CONSTRAINT chk_account_code_format
  CHECK (public.validate_serbian_account_code(code));

-- Trigger to validate account code matches account type
CREATE OR REPLACE FUNCTION public.check_account_code_type()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT public.validate_account_code_type(NEW.code, NEW.account_type) THEN
    RAISE EXCEPTION 'Account code % does not match account type % per Serbian accounting standards',
      NEW.code, NEW.account_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_account_code_type
  BEFORE INSERT OR UPDATE ON public.chart_of_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.check_account_code_type();

-- =============================================
-- 5. POPDV SECTION COMPLETENESS VALIDATION
-- =============================================

-- Function to validate POPDV section completeness before submission
CREATE OR REPLACE FUNCTION public.validate_pdv_period_submission(p_pdv_period_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period RECORD;
  v_entry_count INT;
  v_required_sections TEXT[] := ARRAY['3', '3a', '8a', '8b']; -- Minimum required sections
  v_missing_sections TEXT[];
  v_section TEXT;
BEGIN
  -- Get period
  SELECT * INTO v_period FROM pdv_periods WHERE id = p_pdv_period_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'PDV period not found'; END IF;
  
  IF v_period.status <> 'calculated' THEN
    RAISE EXCEPTION 'PDV period must be calculated before submission';
  END IF;
  
  -- Check if period has any entries
  SELECT COUNT(*) INTO v_entry_count
  FROM pdv_entries
  WHERE pdv_period_id = p_pdv_period_id;
  
  IF v_entry_count = 0 THEN
    RAISE EXCEPTION 'PDV period has no entries. Calculate PDV before submission.';
  END IF;
  
  -- Check for required sections (at least one entry in key sections)
  -- Note: Sections 3, 3a, 8a, 8b should have entries if there's any activity
  -- But we'll be lenient - only require if there's output/input VAT
  
  -- Validate that output VAT sections (3, 3a) have entries if output_vat > 0
  IF v_period.output_vat > 0 THEN
    SELECT COUNT(*) INTO v_entry_count
    FROM pdv_entries
    WHERE pdv_period_id = p_pdv_period_id
      AND direction = 'output'
      AND popdv_section IN ('3', '3a');
    
    IF v_entry_count = 0 THEN
      RAISE EXCEPTION 'PDV period has output VAT but no entries in required sections (3 or 3a)';
    END IF;
  END IF;
  
  -- Validate that input VAT sections (8a, 8b) have entries if input_vat > 0
  IF v_period.input_vat > 0 THEN
    SELECT COUNT(*) INTO v_entry_count
    FROM pdv_entries
    WHERE pdv_period_id = p_pdv_period_id
      AND direction = 'input'
      AND popdv_section IN ('8a', '8b');
    
    IF v_entry_count = 0 THEN
      RAISE EXCEPTION 'PDV period has input VAT but no entries in required sections (8a or 8b)';
    END IF;
  END IF;
  
  -- Validate totals match entries
  DECLARE
    v_calc_output NUMERIC := 0;
    v_calc_input NUMERIC := 0;
  BEGIN
    SELECT COALESCE(SUM(vat_amount), 0) INTO v_calc_output
    FROM pdv_entries
    WHERE pdv_period_id = p_pdv_period_id AND direction = 'output';
    
    SELECT COALESCE(SUM(vat_amount), 0) INTO v_calc_input
    FROM pdv_entries
    WHERE pdv_period_id = p_pdv_period_id AND direction = 'input';
    
    IF ABS(v_period.output_vat - v_calc_output) > 0.01 THEN
      RAISE EXCEPTION 'Output VAT total (%) does not match entries (%)',
        v_period.output_vat, v_calc_output;
    END IF;
    
    IF ABS(v_period.input_vat - v_calc_input) > 0.01 THEN
      RAISE EXCEPTION 'Input VAT total (%) does not match entries (%)',
        v_period.input_vat, v_calc_input;
    END IF;
  END;
END;
$$;

-- Function to submit PDV period with validation
CREATE OR REPLACE FUNCTION public.submit_pdv_period(
  p_pdv_period_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period RECORD;
BEGIN
  -- Validate tenant membership
  SELECT * INTO v_period FROM pdv_periods WHERE id = p_pdv_period_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'PDV period not found'; END IF;
  
  PERFORM public.assert_tenant_member(v_period.tenant_id);
  
  -- Validate completeness
  PERFORM public.validate_pdv_period_submission(p_pdv_period_id);
  
  -- Update status
  UPDATE pdv_periods
  SET status = 'submitted',
      submitted_at = now(),
      submitted_by = auth.uid()
  WHERE id = p_pdv_period_id;
  
  -- Log audit trail
  PERFORM public.log_audit_action(
    v_period.tenant_id,
    'submit_pdv_period',
    'pdv_period',
    p_pdv_period_id,
    'submit',
    NULL,
    jsonb_build_object(
      'period_name', v_period.period_name,
      'output_vat', v_period.output_vat,
      'input_vat', v_period.input_vat,
      'vat_liability', v_period.vat_liability
    )
  );
END;
$$;

-- =============================================
-- 6. ENHANCE YEAR-END CLOSING WITH AUDIT TRAIL
-- =============================================

-- Update year-end closing to log audit trail
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

  -- Log audit trail
  PERFORM public.log_audit_action(
    p_tenant_id,
    'perform_year_end_closing',
    'fiscal_period',
    p_fiscal_period_id,
    'close',
    'Year-end closing for period ' || v_period.name,
    jsonb_build_object(
      'entry_id', v_entry_id,
      'entry_number', v_entry_number,
      'revenue_total', v_revenue_total,
      'expense_total', v_expense_total,
      'net_income', v_net_income
    )
  );

  RETURN v_entry_id;
END;
$$;

-- =============================================
-- 7. ADD AUDIT TRAIL TO INVOICE POSTING
-- =============================================

-- Update process_invoice_post to include audit trail
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
  v_revenue_account_id uuid;
  v_ar_account_id uuid;
  v_vat_account_id uuid;
  v_cogs_account_id uuid;
  v_inventory_account_id uuid;
  v_entry_number text;
  v_fiscal_period_id uuid;
  v_total_cost numeric := 0;
BEGIN
  SELECT * INTO v_invoice FROM invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  v_tenant_id := v_invoice.tenant_id;

  PERFORM public.assert_tenant_member(v_tenant_id);

  SELECT public.check_fiscal_period_open(v_tenant_id, v_invoice.invoice_date::text) INTO v_fiscal_period_id;

  SELECT id INTO v_revenue_account_id FROM chart_of_accounts WHERE tenant_id = v_tenant_id AND code = '6000' AND is_active LIMIT 1;
  SELECT id INTO v_ar_account_id FROM chart_of_accounts WHERE tenant_id = v_tenant_id AND code = '2040' AND is_active LIMIT 1;
  SELECT id INTO v_vat_account_id FROM chart_of_accounts WHERE tenant_id = v_tenant_id AND code = '4700' AND is_active LIMIT 1;
  SELECT id INTO v_cogs_account_id FROM chart_of_accounts WHERE tenant_id = v_tenant_id AND code = '5000' AND is_active LIMIT 1;
  SELECT id INTO v_inventory_account_id FROM chart_of_accounts WHERE tenant_id = v_tenant_id AND code = '1320' AND is_active LIMIT 1;

  IF v_revenue_account_id IS NULL OR v_ar_account_id IS NULL THEN
    RAISE EXCEPTION 'Required accounts (6000, 2040) not found';
  END IF;

  v_entry_number := 'INV-' || upper(to_hex(extract(epoch from now())::bigint));

  INSERT INTO journal_entries (tenant_id, entry_number, entry_date, description, reference, status, posted_at, posted_by, created_by, fiscal_period_id, source, legal_entity_id)
  VALUES (v_tenant_id, v_entry_number, v_invoice.invoice_date, 'Invoice posting: ' || v_invoice.invoice_number, v_invoice.invoice_number, 'posted', now(), auth.uid(), auth.uid(), v_fiscal_period_id, 'auto_invoice', v_invoice.legal_entity_id)
  RETURNING id INTO v_je_id;

  INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
  VALUES (v_je_id, v_ar_account_id, v_invoice.total, 0, 'AR: ' || v_invoice.partner_name, 0);

  INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
  VALUES (v_je_id, v_revenue_account_id, 0, v_invoice.subtotal, 'Revenue: ' || v_invoice.invoice_number, 1);

  IF v_vat_account_id IS NOT NULL AND v_invoice.tax_amount > 0 THEN
    INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
    VALUES (v_je_id, v_vat_account_id, 0, v_invoice.tax_amount, 'Output VAT', 2);
  END IF;

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
      VALUES (v_je_id, v_cogs_account_id, v_total_cost, 0, 'COGS: ' || v_invoice.invoice_number, 10);
      INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, sort_order)
      VALUES (v_je_id, v_inventory_account_id, 0, v_total_cost, 'Inventory reduction', 11);
    END IF;
  END IF;

  UPDATE invoices SET journal_entry_id = v_je_id WHERE id = p_invoice_id;

  -- Log audit trail
  PERFORM public.log_audit_action(
    v_tenant_id,
    'process_invoice_post',
    'invoice',
    p_invoice_id,
    'post',
    NULL,
    jsonb_build_object(
      'invoice_number', v_invoice.invoice_number,
      'journal_entry_id', v_je_id,
      'total', v_invoice.total,
      'subtotal', v_invoice.subtotal,
      'tax_amount', v_invoice.tax_amount
    )
  );

  RETURN v_je_id;
END;
$$;

-- =============================================
-- 8. CREATE INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_date ON public.audit_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON public.audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON public.audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_journal_entries_storno ON public.journal_entries(storno_of_id) WHERE storno_of_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_journal_entries_storno_reason ON public.journal_entries(storno_reason) WHERE storno_reason IS NOT NULL;
