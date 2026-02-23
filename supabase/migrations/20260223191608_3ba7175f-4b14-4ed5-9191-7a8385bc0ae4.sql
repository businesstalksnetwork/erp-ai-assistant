
CREATE OR REPLACE FUNCTION public.dashboard_kpi_summary(_tenant_id uuid)
RETURNS TABLE(revenue numeric, expenses numeric, cash_balance numeric)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    COALESCE((
      SELECT SUM(jl.credit - jl.debit)
      FROM journal_lines jl
      JOIN journal_entries je ON jl.journal_entry_id = je.id
      JOIN chart_of_accounts coa ON jl.account_id = coa.id
      WHERE je.tenant_id = _tenant_id
        AND je.status = 'posted'
        AND coa.tenant_id = _tenant_id
        AND coa.account_type = 'revenue'
    ), 0) AS revenue,
    COALESCE((
      SELECT SUM(jl.debit - jl.credit)
      FROM journal_lines jl
      JOIN journal_entries je ON jl.journal_entry_id = je.id
      JOIN chart_of_accounts coa ON jl.account_id = coa.id
      WHERE je.tenant_id = _tenant_id
        AND je.status = 'posted'
        AND coa.tenant_id = _tenant_id
        AND coa.account_type = 'expense'
    ), 0) AS expenses,
    COALESCE((
      SELECT SUM(total)
      FROM invoices
      WHERE tenant_id = _tenant_id
        AND status = 'paid'
    ), 0) AS cash_balance;
$$;

CREATE OR REPLACE FUNCTION public.dashboard_revenue_expenses_monthly(
  _tenant_id uuid, _months int DEFAULT 6
)
RETURNS TABLE(month_label text, revenue numeric, expenses numeric)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH months AS (
    SELECT generate_series(
      date_trunc('month', CURRENT_DATE) - ((_months - 1) || ' months')::interval,
      date_trunc('month', CURRENT_DATE),
      '1 month'::interval
    )::date AS month_start
  )
  SELECT
    to_char(m.month_start, 'Mon YY') AS month_label,
    COALESCE(SUM(CASE WHEN coa.account_type = 'revenue' THEN jl.credit - jl.debit ELSE 0 END), 0) AS revenue,
    COALESCE(SUM(CASE WHEN coa.account_type = 'expense' THEN jl.debit - jl.credit ELSE 0 END), 0) AS expenses
  FROM months m
  LEFT JOIN journal_entries je ON je.tenant_id = _tenant_id
    AND je.status = 'posted'
    AND je.entry_date >= m.month_start
    AND je.entry_date < (m.month_start + '1 month'::interval)
  LEFT JOIN journal_lines jl ON jl.journal_entry_id = je.id
  LEFT JOIN chart_of_accounts coa ON jl.account_id = coa.id
    AND coa.tenant_id = _tenant_id
    AND coa.account_type IN ('revenue', 'expense')
  GROUP BY m.month_start
  ORDER BY m.month_start;
$$;
