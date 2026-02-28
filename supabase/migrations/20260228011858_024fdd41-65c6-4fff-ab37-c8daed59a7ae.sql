
-- DB-CRIT-3: Double-entry balance constraint trigger on journal_lines
-- Validates SUM(debit) = SUM(credit) per journal entry after all lines are inserted
-- DEFERRABLE INITIALLY DEFERRED so batch inserts within a transaction work

CREATE OR REPLACE FUNCTION public.trg_check_journal_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_debit  numeric;
  v_total_credit numeric;
  v_entry_id     uuid;
BEGIN
  -- Get the entry_id from the affected row
  IF TG_OP = 'DELETE' THEN
    v_entry_id := OLD.journal_entry_id;
  ELSE
    v_entry_id := NEW.journal_entry_id;
  END IF;

  SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0)
    INTO v_total_debit, v_total_credit
    FROM journal_lines
   WHERE journal_entry_id = v_entry_id;

  IF v_total_debit <> v_total_credit THEN
    RAISE EXCEPTION 'Journal entry % is unbalanced: total debit (%) <> total credit (%)',
      v_entry_id, v_total_debit, v_total_credit;
  END IF;

  RETURN NULL; -- AFTER trigger, return value ignored for CONSTRAINT triggers
END;
$$;

-- Create the constraint trigger (DEFERRABLE so RPC batch inserts work)
CREATE CONSTRAINT TRIGGER trg_check_journal_balance
  AFTER INSERT OR UPDATE OR DELETE ON public.journal_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_check_journal_balance();

-- INTER-HIGH-1: RPC to sync products.current_stock from WMS bin stock
CREATE OR REPLACE FUNCTION public.update_product_stock_from_wms(
  p_tenant_id uuid,
  p_product_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total numeric;
BEGIN
  SELECT COALESCE(SUM(quantity), 0)
    INTO v_total
    FROM wms_bin_stock
   WHERE tenant_id = p_tenant_id
     AND product_id = p_product_id;

  UPDATE products
     SET current_stock = v_total
   WHERE id = p_product_id
     AND tenant_id = p_tenant_id;
END;
$$;

-- PROD-HIGH-1: Add superseded_at column to bom_lines for soft-versioning
ALTER TABLE public.bom_lines ADD COLUMN IF NOT EXISTS superseded_at timestamptz DEFAULT NULL;
