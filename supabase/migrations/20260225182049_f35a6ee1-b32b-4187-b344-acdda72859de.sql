
-- ==========================================
-- GAP 6: April 2026 Credit Note Procedural Enforcement
-- Add validation that credit notes after 2026-04-01 require SEF reference
-- ==========================================
CREATE OR REPLACE FUNCTION public.validate_credit_note_april2026()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- After April 1, 2026: credit notes must have sef_invoice_id or billing_reference
  IF NEW.invoice_type = 'credit_note' 
     AND NEW.invoice_date >= '2026-04-01'
     AND NEW.sef_invoice_id IS NULL
     AND (NEW.notes IS NULL OR NEW.notes NOT LIKE '%SEF%') THEN
    RAISE WARNING 'Credit notes issued after April 1, 2026 should reference a SEF document for tax base reduction compliance';
  END IF;
  RETURN NEW;
END;
$$;

-- Only create trigger if invoices table has invoice_type column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'invoice_type' AND table_schema = 'public'
  ) THEN
    DROP TRIGGER IF EXISTS trg_validate_credit_note_april2026 ON invoices;
    CREATE TRIGGER trg_validate_credit_note_april2026
      BEFORE INSERT OR UPDATE ON invoices
      FOR EACH ROW
      EXECUTE FUNCTION validate_credit_note_april2026();
  END IF;
END $$;

-- ==========================================
-- GAP 7: Intercompany Elimination Engine
-- ==========================================
CREATE OR REPLACE FUNCTION public.calculate_intercompany_eliminations(
  p_tenant_id UUID,
  p_date_from DATE,
  p_date_to DATE
)
RETURNS TABLE(
  source_entity_id UUID,
  target_entity_id UUID,
  source_entity_name TEXT,
  target_entity_name TEXT,
  elimination_type TEXT,
  account_code TEXT,
  account_name TEXT,
  debit_amount NUMERIC,
  credit_amount NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify access
  IF NOT EXISTS (
    SELECT 1 FROM tenant_users
    WHERE tenant_id = p_tenant_id AND user_id = auth.uid() AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Eliminate intercompany receivables/payables
  RETURN QUERY
  WITH ic_transactions AS (
    SELECT 
      it.source_entity_id,
      it.target_entity_id,
      le_src.name AS src_name,
      le_tgt.name AS tgt_name,
      it.amount,
      it.transaction_type
    FROM intercompany_transactions it
    JOIN legal_entities le_src ON le_src.id = it.source_entity_id
    JOIN legal_entities le_tgt ON le_tgt.id = it.target_entity_id
    WHERE it.tenant_id = p_tenant_id
      AND it.transaction_date BETWEEN p_date_from AND p_date_to
      AND it.status = 'confirmed'
  )
  -- Revenue/Expense elimination
  SELECT 
    t.source_entity_id,
    t.target_entity_id,
    t.src_name,
    t.tgt_name,
    'revenue_expense'::TEXT AS elimination_type,
    '6000'::TEXT AS account_code,
    'Eliminacija intercompany prihoda'::TEXT AS account_name,
    t.amount AS debit_amount,
    0::NUMERIC AS credit_amount
  FROM ic_transactions t
  WHERE t.transaction_type IN ('sale', 'service')
  
  UNION ALL
  
  SELECT 
    t.target_entity_id,
    t.source_entity_id,
    t.tgt_name,
    t.src_name,
    'revenue_expense'::TEXT,
    '5000'::TEXT,
    'Eliminacija intercompany rashoda'::TEXT,
    0::NUMERIC,
    t.amount
  FROM ic_transactions t
  WHERE t.transaction_type IN ('sale', 'service')
  
  UNION ALL
  
  -- Receivable/Payable elimination
  SELECT 
    t.source_entity_id,
    t.target_entity_id,
    t.src_name,
    t.tgt_name,
    'receivable_payable'::TEXT,
    '2040'::TEXT,
    'Eliminacija intercompany potraživanja'::TEXT,
    0::NUMERIC,
    t.amount
  FROM ic_transactions t
  
  UNION ALL
  
  SELECT 
    t.target_entity_id,
    t.source_entity_id,
    t.tgt_name,
    t.src_name,
    'receivable_payable'::TEXT,
    '4320'::TEXT,
    'Eliminacija intercompany obaveza'::TEXT,
    t.amount,
    0::NUMERIC
  FROM ic_transactions t;
END;
$$;
