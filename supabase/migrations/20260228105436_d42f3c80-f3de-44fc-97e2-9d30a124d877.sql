
-- ══════════════════════════════════════════════════════════════
-- Batch 4: CR-01, CR-02, CR-15c, CR-28b
-- ══════════════════════════════════════════════════════════════

-- ── CR-01: Harden execute_readonly_query ──
CREATE OR REPLACE FUNCTION public.execute_readonly_query(query_text text, tenant_id_param uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  cleaned text;
  caller_id uuid;
BEGIN
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF tenant_id_param IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM tenant_members
      WHERE user_id = caller_id AND tenant_id = tenant_id_param AND status = 'active'
    ) AND NOT EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = caller_id AND role = 'super_admin'
    ) THEN
      RAISE EXCEPTION 'Access denied: not a member of this tenant';
    END IF;
  END IF;

  cleaned := trim(query_text);

  IF NOT (upper(cleaned) ~ '^(SELECT|WITH)\s') THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;

  IF cleaned ~* '(pg_catalog|information_schema|pg_roles|pg_user|pg_shadow|pg_authid|pg_stat)' THEN
    RAISE EXCEPTION 'Access to system schemas is not allowed';
  END IF;

  IF cleaned ~* '\bUNION\b' THEN
    RAISE EXCEPTION 'UNION queries are not allowed';
  END IF;

  IF cleaned ~* '\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|EXECUTE|COPY)\b' THEN
    RAISE EXCEPTION 'Only read-only queries are allowed';
  END IF;

  IF NOT (cleaned ~* '\bLIMIT\s+\d+') THEN
    cleaned := cleaned || ' LIMIT 100';
  END IF;

  SET LOCAL statement_timeout = '5s';

  EXECUTE 'SELECT jsonb_agg(row_to_json(t)) FROM (' || cleaned || ') t' INTO result;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- ── CR-02: Fix invoice double-post guard trigger ──
CREATE OR REPLACE FUNCTION public.guard_invoice_double_post()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.journal_entry_id IS NOT NULL AND 
     (NEW.journal_entry_id IS NULL OR NEW.journal_entry_id != OLD.journal_entry_id) THEN
    RAISE EXCEPTION 'Cannot modify or clear journal_entry_id once an invoice is posted to GL (current: %)', OLD.journal_entry_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_invoice_double_post ON invoices;
CREATE TRIGGER trg_guard_invoice_double_post
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION guard_invoice_double_post();

-- ── CR-15c: Optimize RLS policies — use existing get_user_tenant_ids(_user_id) ──
CREATE OR REPLACE FUNCTION public.get_user_tenant_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM tenant_members WHERE user_id = _user_id AND status = 'active';
$$;

-- tax_loss_carryforward
DROP POLICY IF EXISTS "Users can manage their tenant tax loss carryforward" ON tax_loss_carryforward;
CREATE POLICY "Users can manage their tenant tax loss carryforward"
  ON tax_loss_carryforward FOR ALL
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())))
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- thin_capitalization
DROP POLICY IF EXISTS "Users can manage their tenant thin capitalization" ON thin_capitalization;
CREATE POLICY "Users can manage their tenant thin capitalization"
  ON thin_capitalization FOR ALL
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())))
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- vat_prorata_coefficients
DROP POLICY IF EXISTS "Users can manage their tenant vat prorata" ON vat_prorata_coefficients;
CREATE POLICY "Users can manage their tenant vat prorata"
  ON vat_prorata_coefficients FOR ALL
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())))
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- capital_goods_vat_register
DROP POLICY IF EXISTS "Users can manage their tenant capital goods vat" ON capital_goods_vat_register;
CREATE POLICY "Users can manage their tenant capital goods vat"
  ON capital_goods_vat_register FOR ALL
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())))
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- deferred_tax_items
DROP POLICY IF EXISTS "Users can manage their tenant deferred tax" ON deferred_tax_items;
CREATE POLICY "Users can manage their tenant deferred tax"
  ON deferred_tax_items FOR ALL
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())))
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- intercompany_eliminations
DROP POLICY IF EXISTS "Users can manage their tenant intercompany eliminations" ON intercompany_eliminations;
CREATE POLICY "Users can manage their tenant intercompany eliminations"
  ON intercompany_eliminations FOR ALL
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())))
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- ── CR-28b: Fix thin_capitalization debt_equity_ratio for equity=0 ──
ALTER TABLE thin_capitalization 
  DROP COLUMN IF EXISTS debt_equity_ratio;
ALTER TABLE thin_capitalization 
  ADD COLUMN debt_equity_ratio numeric GENERATED ALWAYS AS (
    CASE WHEN equity_amount > 0 THEN related_party_debt / equity_amount ELSE NULL END
  ) STORED;
