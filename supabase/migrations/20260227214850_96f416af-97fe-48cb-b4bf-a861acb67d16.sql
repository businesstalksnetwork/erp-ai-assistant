
-- =============================================
-- OLAP Pivot Analytics Engine — Database Layer
-- =============================================

-- 1.1 GL Entries Cube
CREATE OR REPLACE VIEW public.v_cube_gl_entries AS
SELECT
  je.tenant_id, je.entry_date,
  EXTRACT(YEAR FROM je.entry_date)::int AS year,
  EXTRACT(MONTH FROM je.entry_date)::int AS month,
  'Q' || EXTRACT(QUARTER FROM je.entry_date)::text AS quarter,
  coa.code AS account_code, coa.name AS account_name,
  LEFT(coa.code, 1) AS account_class, LEFT(coa.code, 2) AS account_group,
  COALESCE(cc.name, '') AS cost_center,
  COALESCE(jl.description, '') AS description,
  jl.debit, jl.credit, jl.debit - jl.credit AS balance
FROM journal_lines jl
JOIN journal_entries je ON je.id = jl.journal_entry_id
JOIN chart_of_accounts coa ON coa.id = jl.account_id
LEFT JOIN cost_centers cc ON cc.id = jl.cost_center_id
WHERE je.status = 'posted';

-- 1.2 Invoices Cube
CREATE OR REPLACE VIEW public.v_cube_invoices AS
SELECT
  i.tenant_id, i.invoice_date,
  EXTRACT(YEAR FROM i.invoice_date)::int AS year,
  EXTRACT(MONTH FROM i.invoice_date)::int AS month,
  'Q' || EXTRACT(QUARTER FROM i.invoice_date)::text AS quarter,
  i.invoice_type, i.status,
  COALESCE(p.name, '') AS partner_name, COALESCE(p.city, '') AS partner_city,
  COALESCE(p.type, '') AS partner_type,
  COALESCE(pr.name, il.description) AS product_name,
  COALESCE(pc.name, '') AS product_category,
  COALESCE(emp.first_name || ' ' || emp.last_name, '') AS salesperson,
  COALESCE(i.currency, 'RSD') AS currency,
  il.quantity, il.unit_price, il.line_total, il.tax_amount,
  (il.unit_price * il.quantity) - il.line_total AS discount_amount
FROM invoice_lines il
JOIN invoices i ON i.id = il.invoice_id
LEFT JOIN partners p ON p.id = i.partner_id
LEFT JOIN products pr ON pr.id = il.product_id
LEFT JOIN product_categories pc ON pc.id = pr.category_id
LEFT JOIN employees emp ON emp.user_id = i.created_by;

-- 1.3 Purchases Cube
CREATE OR REPLACE VIEW public.v_cube_purchases AS
SELECT
  si.tenant_id, si.invoice_date,
  EXTRACT(YEAR FROM si.invoice_date)::int AS year,
  EXTRACT(MONTH FROM si.invoice_date)::int AS month,
  'Q' || EXTRACT(QUARTER FROM si.invoice_date)::text AS quarter,
  COALESCE(si.supplier_name, '') AS supplier_name,
  COALESCE(p.city, '') AS supplier_city,
  COALESCE(pr.name, COALESCE(sil.description, '')) AS product_name,
  COALESCE(pc.name, '') AS product_category,
  COALESCE(w.name, '') AS warehouse,
  sil.quantity, sil.unit_price AS unit_cost, sil.line_total, sil.tax_amount
FROM supplier_invoice_lines sil
JOIN supplier_invoices si ON si.id = sil.supplier_invoice_id
LEFT JOIN partners p ON p.id = si.supplier_id
LEFT JOIN products pr ON pr.id = sil.product_id
LEFT JOIN product_categories pc ON pc.id = pr.category_id
LEFT JOIN warehouses w ON w.id = sil.warehouse_id;

-- 1.4 Inventory Movements Cube
CREATE OR REPLACE VIEW public.v_cube_inventory_movements AS
SELECT
  im.tenant_id, im.created_at::date AS movement_date,
  EXTRACT(YEAR FROM im.created_at)::int AS year,
  EXTRACT(MONTH FROM im.created_at)::int AS month,
  im.movement_type,
  COALESCE(pr.name, '') AS product_name, COALESCE(pc.name, '') AS product_category,
  COALESCE(w.name, '') AS warehouse_name,
  im.quantity, COALESCE(im.unit_cost, 0) AS unit_cost,
  im.quantity * COALESCE(im.unit_cost, 0) AS total_value
FROM inventory_movements im
JOIN products pr ON pr.id = im.product_id
LEFT JOIN product_categories pc ON pc.id = pr.category_id
JOIN warehouses w ON w.id = im.warehouse_id;

-- 1.5 Payroll Cube
CREATE OR REPLACE VIEW public.v_cube_payroll AS
SELECT
  prun.tenant_id,
  make_date(prun.period_year, prun.period_month, 1) AS pay_period,
  prun.period_year AS year, prun.period_month AS month,
  COALESCE(e.first_name || ' ' || e.last_name, '') AS employee_name,
  COALESCE(d.name, '') AS department, COALESCE(e.position, '') AS position,
  comp.item_type, comp.amount, pi.working_days AS hours
FROM payroll_items pi
JOIN payroll_runs prun ON prun.id = pi.payroll_run_id
JOIN employees e ON e.id = pi.employee_id
LEFT JOIN departments d ON d.id = e.department_id
CROSS JOIN LATERAL (
  VALUES
    ('gross', pi.gross_salary), ('net', pi.net_salary),
    ('tax', pi.income_tax + pi.municipal_tax),
    ('pension', pi.pension_contribution + pi.pension_employer),
    ('health', pi.health_contribution + COALESCE(pi.health_employer, 0)),
    ('total_cost', pi.total_cost)
) AS comp(item_type, amount)
WHERE prun.status != 'draft';

-- 1.6 POS Transactions Cube
CREATE OR REPLACE VIEW public.v_cube_pos_transactions AS
SELECT
  pt.tenant_id, pt.created_at::date AS transaction_date,
  EXTRACT(YEAR FROM pt.created_at)::int AS year,
  EXTRACT(MONTH FROM pt.created_at)::int AS month,
  TRIM(TO_CHAR(pt.created_at, 'Day')) AS day_of_week,
  EXTRACT(HOUR FROM pt.created_at)::int AS hour_of_day,
  COALESCE(e.first_name || ' ' || e.last_name, '') AS cashier_name,
  COALESCE(l.name, '') AS store_location,
  pt.payment_method, pt.receipt_type,
  1 AS quantity, pt.total AS line_total, pt.subtotal,
  pt.total - pt.subtotal AS discount, pt.tax_amount
FROM pos_transactions pt
LEFT JOIN pos_sessions ps ON ps.id = pt.session_id
LEFT JOIN employees e ON e.user_id = ps.opened_by
LEFT JOIN locations l ON l.id = pt.location_id
WHERE pt.status = 'completed';

-- ── 2. pivot_query RPC ─────────────────────────

CREATE OR REPLACE FUNCTION public.pivot_query(
  p_tenant_id UUID, p_cube TEXT, p_rows TEXT[],
  p_columns TEXT[] DEFAULT '{}',
  p_measures JSONB DEFAULT '[{"col":"balance","agg":"sum","alias":"total"}]',
  p_filters JSONB DEFAULT '{}',
  p_sort_by TEXT DEFAULT NULL, p_sort_dir TEXT DEFAULT 'desc',
  p_limit INT DEFAULT 1000, p_offset INT DEFAULT 0
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_view TEXT; v_select TEXT := ''; v_group TEXT := '';
  v_where TEXT := format('WHERE tenant_id = %L', p_tenant_id);
  v_order TEXT := ''; v_sql TEXT; v_result JSONB; v_count BIGINT;
  v_measure JSONB; v_col TEXT; v_agg TEXT; v_alias TEXT;
  v_key TEXT; v_vals JSONB; i INT;
  v_allowed_views TEXT[] := ARRAY[
    'v_cube_gl_entries','v_cube_invoices','v_cube_purchases',
    'v_cube_inventory_movements','v_cube_payroll','v_cube_pos_transactions'];
BEGIN
  v_view := 'v_cube_' || p_cube;
  IF NOT v_view = ANY(v_allowed_views) THEN RAISE EXCEPTION 'Invalid cube: %', p_cube; END IF;
  IF p_rows IS NULL OR array_length(p_rows, 1) IS NULL THEN RAISE EXCEPTION 'At least one row dimension required'; END IF;

  FOR i IN 1..array_length(p_rows, 1) LOOP
    IF i > 1 THEN v_select := v_select || ', '; v_group := v_group || ', '; END IF;
    v_select := v_select || quote_ident(p_rows[i]);
    v_group := v_group || quote_ident(p_rows[i]);
  END LOOP;

  FOR v_measure IN SELECT * FROM jsonb_array_elements(p_measures) LOOP
    v_col := v_measure->>'col'; v_agg := COALESCE(v_measure->>'agg', 'sum');
    v_alias := COALESCE(v_measure->>'alias', v_col || '_' || v_agg);
    IF v_agg NOT IN ('sum','avg','count','min','max','count_distinct') THEN RAISE EXCEPTION 'Invalid agg: %', v_agg; END IF;
    IF v_agg = 'count_distinct' THEN
      v_select := v_select || format(', COUNT(DISTINCT %I) AS %I', v_col, v_alias);
    ELSE
      v_select := v_select || format(', %s(%I) AS %I', v_agg, v_col, v_alias);
    END IF;
  END LOOP;

  FOR v_key IN SELECT * FROM jsonb_object_keys(p_filters) LOOP
    v_vals := p_filters -> v_key;
    IF jsonb_typeof(v_vals) = 'array' AND jsonb_array_length(v_vals) > 0 THEN
      v_where := v_where || format(' AND %I::text = ANY(ARRAY(SELECT jsonb_array_elements_text(%L::jsonb)))', v_key, v_vals::text);
    END IF;
  END LOOP;

  IF p_sort_by IS NOT NULL THEN
    v_order := format('ORDER BY %I %s NULLS LAST', p_sort_by, CASE WHEN p_sort_dir = 'asc' THEN 'ASC' ELSE 'DESC' END);
  ELSE v_order := 'ORDER BY 1'; END IF;

  v_sql := format('SELECT COUNT(*) FROM (SELECT %s FROM %I %s GROUP BY %s) sub', v_select, v_view, v_where, v_group);
  EXECUTE v_sql INTO v_count;
  v_sql := format('SELECT jsonb_agg(row_to_json(sub)) FROM (SELECT %s FROM %I %s GROUP BY %s %s LIMIT %s OFFSET %s) sub',
    v_select, v_view, v_where, v_group, v_order, p_limit, p_offset);
  EXECUTE v_sql INTO v_result;

  RETURN jsonb_build_object('rows', COALESCE(v_result, '[]'::jsonb), 'total_count', v_count,
    'cube', p_cube, 'dimensions', to_jsonb(p_rows), 'offset', p_offset, 'limit', p_limit);
END; $$;

-- ── 3. get_cube_metadata ───────────────────────

CREATE OR REPLACE FUNCTION public.get_cube_metadata(p_cube TEXT) RETURNS JSONB
LANGUAGE plpgsql STABLE SET search_path = public AS $$
BEGIN
  RETURN CASE p_cube
    WHEN 'gl_entries' THEN '{"dimensions":["entry_date","year","month","quarter","account_code","account_name","account_class","account_group","cost_center","description"],"measures":[{"col":"debit","label":"Duguje","aggs":["sum","avg","count"]},{"col":"credit","label":"Potražuje","aggs":["sum","avg","count"]},{"col":"balance","label":"Saldo","aggs":["sum","avg"]}],"default_rows":["account_class","account_group"],"default_measure":{"col":"balance","agg":"sum","alias":"saldo"}}'::jsonb
    WHEN 'invoices' THEN '{"dimensions":["invoice_date","year","month","quarter","invoice_type","status","partner_name","partner_city","partner_type","product_name","product_category","salesperson","currency"],"measures":[{"col":"line_total","label":"Iznos","aggs":["sum","avg","min","max","count"]},{"col":"quantity","label":"Količina","aggs":["sum","avg"]},{"col":"tax_amount","label":"PDV","aggs":["sum"]},{"col":"discount_amount","label":"Popust","aggs":["sum","avg"]}],"default_rows":["partner_name"],"default_measure":{"col":"line_total","agg":"sum","alias":"ukupno"}}'::jsonb
    WHEN 'purchases' THEN '{"dimensions":["invoice_date","year","month","quarter","supplier_name","supplier_city","product_name","product_category","warehouse"],"measures":[{"col":"line_total","label":"Iznos","aggs":["sum","avg","count"]},{"col":"quantity","label":"Količina","aggs":["sum","avg"]},{"col":"tax_amount","label":"PDV","aggs":["sum"]},{"col":"unit_cost","label":"Jed. cena","aggs":["avg","min","max"]}],"default_rows":["supplier_name"],"default_measure":{"col":"line_total","agg":"sum","alias":"ukupno"}}'::jsonb
    WHEN 'inventory' THEN '{"dimensions":["movement_date","year","month","movement_type","product_name","product_category","warehouse_name"],"measures":[{"col":"quantity","label":"Količina","aggs":["sum","avg","count"]},{"col":"total_value","label":"Vrednost","aggs":["sum","avg"]},{"col":"unit_cost","label":"Jed. cena","aggs":["avg","min","max"]}],"default_rows":["product_name","warehouse_name"],"default_measure":{"col":"quantity","agg":"sum","alias":"kolicina"}}'::jsonb
    WHEN 'payroll' THEN '{"dimensions":["pay_period","year","month","employee_name","department","position","item_type"],"measures":[{"col":"amount","label":"Iznos","aggs":["sum","avg","min","max"]},{"col":"hours","label":"Radni dani","aggs":["sum","avg"]}],"default_rows":["department","employee_name"],"default_measure":{"col":"amount","agg":"sum","alias":"iznos"}}'::jsonb
    WHEN 'pos' THEN '{"dimensions":["transaction_date","year","month","day_of_week","hour_of_day","cashier_name","store_location","payment_method","receipt_type"],"measures":[{"col":"line_total","label":"Iznos","aggs":["sum","avg","count"]},{"col":"quantity","label":"Transakcije","aggs":["sum","count"]},{"col":"discount","label":"Popust","aggs":["sum","avg"]},{"col":"tax_amount","label":"PDV","aggs":["sum"]}],"default_rows":["store_location"],"default_measure":{"col":"line_total","agg":"sum","alias":"promet"}}'::jsonb
    ELSE '{}'::jsonb
  END;
END; $$;

-- ── 4. Saved Views Table ───────────────────────

CREATE TABLE IF NOT EXISTS public.pivot_saved_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, description TEXT, cube TEXT NOT NULL,
  config_json JSONB NOT NULL DEFAULT '{}',
  is_shared BOOLEAN NOT NULL DEFAULT false,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_pivot_view_name UNIQUE (tenant_id, user_id, name)
);

ALTER TABLE public.pivot_saved_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own + shared views" ON public.pivot_saved_views FOR SELECT
  USING (user_id = auth.uid() OR (is_shared = true AND tenant_id IN (
    SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid()
  )));

CREATE POLICY "Users insert own views" ON public.pivot_saved_views FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own views" ON public.pivot_saved_views FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users delete own views" ON public.pivot_saved_views FOR DELETE
  USING (user_id = auth.uid());

CREATE TRIGGER update_pivot_saved_views_updated_at
  BEFORE UPDATE ON public.pivot_saved_views
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── 5. Indexes ─────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_journal_lines_account_entry ON journal_lines(account_id, journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice ON invoice_lines(invoice_id) INCLUDE (quantity, unit_price, line_total, tax_amount);
CREATE INDEX IF NOT EXISTS idx_supplier_invoice_lines_sinv ON supplier_invoice_lines(supplier_invoice_id) INCLUDE (quantity, unit_price, line_total, tax_amount);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_tenant_product ON inventory_movements(tenant_id, product_id);
CREATE INDEX IF NOT EXISTS idx_payroll_items_run ON payroll_items(payroll_run_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_pos_transactions_tenant_created ON pos_transactions(tenant_id, created_at) INCLUDE (total, tax_amount, payment_method);
